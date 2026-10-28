import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom;
before(async () => {
  dom = new JSDOM("<body></body>", { url: "http://localhost" });
  for (const k of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[k] = dom.window[k];
  customElements.define("ha-form", class extends HTMLElement {});
  await import("../src/index.js");
});
after(() => dom.window.close());
const s = (value, unit, attributes = {}) => ({
  state: String(value),
  attributes: { unit_of_measurement: unit, ...attributes },
});
function card(config = {}, states = {}) {
  const c = document.createElement("ikio-router-card");
  c.setConfig({ schema_version: 1, ...config });
  c.hass = { states, locale: { language: "en" } };
  document.body.append(c);
  return c;
}
test("generic stub registers and does not invent readings", () => {
  const C = customElements.get("ikio-router-card"),
    c = card(C.getStubConfig());
  assert.ok(window.customCards.some((c) => c.type === "ikio-router-card"));
  assert.match(c.shadowRoot.textContent, /Choose router entities/);
  c.remove();
});
test("connection state does not follow router availability or WAN address", () => {
  const c = card(
    {
      availability_entity: "binary_sensor.router",
      internet_status_entity: "binary_sensor.wan",
      internet_ip_entity: "sensor.ip",
      local_ip_entity: "sensor.local",
      devices_entity: "sensor.devices",
    },
    {
      "binary_sensor.router": s("on"),
      "binary_sensor.wan": s("off"),
      "sensor.ip": s("198.51.100.7"),
      "sensor.local": s("192.0.2.1"),
      "sensor.devices": s(0),
    },
  );
  assert.ok(c.content.querySelector(".router-internet.offline"));
  assert.equal(
    c.content.querySelector(".router-center .router-caption").textContent,
    "192.0.2.1",
  );
  assert.match(c.content.textContent, /0 devices/);
  assert.equal(c.content.querySelector(".router-internet").textContent, "");
  c.hass = {
    states: { ...c.hass.states, "binary_sensor.wan": s("unavailable") },
  };
  assert.ok(c.content.querySelector(".router-internet.unknown"));
  c.remove();
});
test("Internet adapter handles problem semantics, overrides and unknown custom states", async () => {
  const { internetStatus } = await import("../src/adapter.js");
  assert.equal(
    internetStatus(s("off", null, { device_class: "problem" })),
    "online",
  );
  assert.equal(
    internetStatus(s("on", null, { device_class: "problem" })),
    "offline",
  );
  assert.equal(internetStatus(s("ready"), "ready"), "online");
  assert.equal(internetStatus(s("unavailable"), "ready"), "unknown");
  assert.equal(internetStatus(s("custom")), "unknown");
});
test("cellular gauges are conditional, independent and honest about missing data", () => {
  const states = {
    "sensor.rsrp": s(-100, "dBm"),
    "sensor.rsrq": s(-9, "dB"),
    "sensor.snr": s("unavailable", "dB"),
  };
  const config = {
    rsrp_entity: "sensor.rsrp",
    rsrq_entity: "sensor.rsrq",
    snr_entity: "sensor.snr",
  };
  const c = card(config, states);
  assert.equal(c.content.querySelector(".router-cellular"), null);
  c.setConfig({ ...config, connection_type: "cellular" });
  assert.equal(c.content.querySelectorAll(".router-metric").length, 3);
  assert.equal(c.content.querySelectorAll(".router-gauge-fill").length, 2);
  assert.ok(c.content.querySelector(".router-metric.unknown"));
  assert.match(c.content.textContent, /−?100|-100/);
  c.setConfig({ connection_type: "cellular", rsrp_entity: "sensor.rsrp" });
  assert.equal(c.content.querySelectorAll(".router-metric").length, 1);
  c.remove();
});
test("gauge bounds, thresholds and measurement units", async () => {
  const { gauge } = await import("../src/adapter.js");
  assert.equal(gauge(s(-100, "dBm"), "rsrp", {}).level, "warning");
  assert.equal(gauge(s(-120, "dBm"), "rsrp", {}).level, "critical");
  assert.equal(gauge(s(-40, "dBm"), "rsrp", {}).fill, 100);
  assert.equal(gauge(s(-100, "W"), "rsrp", {}).value, null);
  assert.equal(gauge(s(8.4, "dB"), "snr", { snr_warning: 5 }).level, "normal");
  const { validate } = await import("../src/config.js");
  assert.throws(() => validate({ rsrp_min: 0, rsrp_max: -50 }));
  assert.throws(() => validate({ graph_height: 10 }));
  assert.throws(() => validate({ connection_type: "magic" }));
});
test("shared traffic scale normalizes units and marks min, midpoint, max", async () => {
  const { networkPlot } = await import("../src/views.js");
  const now = Date.now();
  const chart = networkPlot(
    [
      { key: "network_rx", entity: "sensor.rx", unit: "Mbit/s" },
      { key: "network_tx", entity: "sensor.tx", unit: "kB/s" },
    ],
    {
      "sensor.rx": [
        { lu: (now - 600000) / 1000, s: "8" },
        { lu: now / 1000, s: "16" },
      ],
      "sensor.tx": [{ lu: (now - 600000) / 1000, s: "0" }],
    },
    now,
    { locale: { language: "en" } },
    10,
    160,
  );
  assert.equal(chart.querySelectorAll("[data-extremum]").length, 3);
  assert.equal(
    chart.querySelector('[data-extremum="max"]').textContent,
    "16 Mbit/s",
  );
  assert.equal(
    chart.querySelector('[data-extremum="mid"]').textContent,
    "8 Mbit/s",
  );
  assert.equal(
    chart.querySelector('[data-extremum="min"]').textContent,
    "0 Mbit/s",
  );
  assert.equal(chart.style.getPropertyValue("--router-plot-height"), "160px");
  assert.equal(
    chart.querySelector("svg").getAttribute("viewBox"),
    "0 0 300 160",
  );
});
test("constant and missing traffic do not fabricate history", async () => {
  const { networkPlot } = await import("../src/views.js");
  const now = Date.now(),
    rows = [{ key: "network_rx", entity: "sensor.rx", unit: "MB/s" }];
  assert.equal(networkPlot(rows, {}, now, {}), null);
  const plot = networkPlot(
    rows,
    { "sensor.rx": [{ lu: (now - 1800000) / 1000, s: "0" }] },
    now,
    {},
  );
  assert.equal(plot.querySelectorAll("[data-extremum]").length, 1);
  assert.match(plot.querySelector("path").getAttribute("d"), /L/);
});
test("native entity details are accessible for status and address independently", () => {
  const c = card(
    {
      internet_status_entity: "binary_sensor.wan",
      internet_ip_entity: "sensor.ip",
    },
    { "binary_sensor.wan": s("on"), "sensor.ip": s("198.51.100.7") },
  );
  let id;
  c.addEventListener("hass-more-info", (e) => (id = e.detail.entityId));
  c.content.querySelector(".router-internet").click();
  assert.equal(id, "binary_sensor.wan");
  c.content.querySelector(".router-address").click();
  assert.equal(id, "sensor.ip");
  c.remove();
});
test("history respects duration, missing history leaves live speeds, and disconnect cancels", async () => {
  const c = card(
    { network_rx_entity: "sensor.rx", history_minutes: 10 },
    { "sensor.rx": s(2, "MB/s") },
  );
  let resolve, request;
  c.hass = {
    ...c.hass,
    connection: {},
    callWS: (msg) => {
      request = msg;
      return new Promise((r) => (resolve = r));
    },
  };
  c.visible = true;
  c.loadNetwork();
  // The initial render may have started the request; do not await its unresolved response.
  assert.ok(request);
  assert.equal(
    Date.parse(request.end_time) - Date.parse(request.start_time),
    600000,
  );
  assert.match(c.content.textContent, /2 MB\/s/);
  c.remove();
  resolve({ "sensor.rx": [] });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(c.networkLoading, false);
});
test("editor hides cellular settings until selected and preserves bindings and HA metadata", async () => {
  const C = customElements.get("ikio-router-card"),
    e = await C.getConfigElement();
  e.setConfig({
    ...C.getStubConfig(),
    rsrp_entity: "sensor.rsrp",
    grid_options: { columns: 6 },
  });
  e.hass = { states: {} };
  document.body.append(e);
  await new Promise((r) => setTimeout(r, 0));
  const names = () =>
    [...e.shadowRoot.querySelectorAll("ha-form")].flatMap((f) =>
      f.schema.map((s) => s.name),
    );
  assert.ok(!names().includes("rsrp_entity"));
  let saved;
  e.addEventListener(
    "config-changed",
    (event) => (saved = event.detail.config),
  );
  const f = [...e.shadowRoot.querySelectorAll("ha-form")].find((f) =>
    f.schema.some((s) => s.name === "connection_type"),
  );
  f.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...f.data, connection_type: "cellular" } },
    }),
  );
  assert.ok(names().includes("rsrp_entity"));
  assert.ok(names().includes("snr_critical"));
  assert.equal(saved.rsrp_entity, "sensor.rsrp");
  assert.deepEqual(saved.grid_options, { columns: 6 });
  e.remove();
});

test("live network rates use HA's native formatter including configured precision", () => {
  const c = card(
    { network_rx_entity: "sensor.rx", network_tx_entity: "sensor.tx" },
    { "sensor.rx": s(1.234567, "Mbit/s"), "sensor.tx": s(2, "kB/s") },
  );
  const calls = [];
  c.hass = {
    ...c.hass,
    entities: {
      "sensor.rx": { display_precision: 2 },
      "sensor.tx": { display_precision: 0 },
    },
    formatEntityState(state) {
      calls.push(state);
      return `${Number(state.state).toFixed(this.entities[state.entity_id].display_precision)} ${state.attributes.unit_of_measurement}`;
    },
  };
  const values = [
    ...c.content.querySelectorAll(".system-network-legend .ae-value"),
  ].map((n) => n.textContent);
  assert.deepEqual(values, ["1.23 Mbit/s", "2 kB/s"]);
  assert.ok(
    calls.some(
      (state) => state.entity_id === "sensor.rx" && state.state === "1.234567",
    ),
  );
  c.remove();
});

test("rate display fallback honors registry zero/three decimal precision, trailing zeroes and locale", async () => {
  const { rateDisplay } = await import("../src/rate-display.js");
  const row = { entity: "sensor.rx", unit: "MB/s" };
  const hass = {
    states: { "sensor.rx": s(1.234567, "MB/s") },
    entities: { "sensor.rx": { display_precision: 0 } },
    locale: { language: "en" },
  };
  assert.equal(rateDisplay(hass, row), "1 MB/s");
  hass.entities["sensor.rx"].display_precision = 3;
  assert.equal(rateDisplay(hass, row, 1000000), "1.000 MB/s");
  hass.locale.number_format = "decimal_comma";
  assert.equal(rateDisplay(hass, row, 1234567), "1,235 MB/s");
  delete hass.entities["sensor.rx"].display_precision;
  hass.locale.number_format = "comma_decimal";
  hass.states["sensor.rx"].state = "0.0020";
  assert.equal(rateDisplay(hass, row), "0.0020 MB/s");
  hass.states["sensor.rx"].state = "1e-7";
  assert.equal(rateDisplay(hass, row), "0.0000001 MB/s");
});

test("axis keeps the reference sensor's unit and precision after normalizing mixed rate units", async () => {
  const { networkPlot } = await import("../src/views.js");
  const now = Date.now(),
    rows = [
      { key: "network_rx", entity: "sensor.rx", unit: "Mbit/s" },
      { key: "network_tx", entity: "sensor.tx", unit: "kB/s" },
    ];
  const hass = {
    states: { "sensor.rx": s(8, "Mbit/s"), "sensor.tx": s(0, "kB/s") },
    entities: {
      "sensor.rx": { display_precision: 2 },
      "sensor.tx": { display_precision: 0 },
    },
    locale: { language: "en" },
  };
  const history = {
    "sensor.rx": [
      { lu: (now - 1800000) / 1000, s: "8" },
      { lu: now / 1000, s: "16" },
    ],
    "sensor.tx": [{ lu: (now - 1800000) / 1000, s: "0" }],
  };
  const chart = networkPlot(rows, history, now, hass);
  assert.deepEqual(
    ["min", "mid", "max"].map(
      (key) => chart.querySelector(`[data-extremum="${key}"]`).textContent,
    ),
    ["0.00 Mbit/s", "8.00 Mbit/s", "16.00 Mbit/s"],
  );
  const geometry = chart.querySelector("path").getAttribute("d");
  hass.entities["sensor.rx"].display_precision = 0;
  const zero = networkPlot(rows, history, now, hass);
  assert.equal(
    zero.querySelector('[data-extremum="mid"]').textContent,
    "8 Mbit/s",
  );
  assert.equal(zero.querySelector("path").getAttribute("d"), geometry);
  const upload = networkPlot([rows[1]], history, now, hass);
  assert.equal(
    upload.querySelector('[data-extremum="constant"]').textContent,
    "0 kB/s",
  );
});

test("axis delegates synthesized tick values to the HA formatter", async () => {
  const { networkPlot } = await import("../src/views.js");
  const now = Date.now(),
    calls = [];
  const hass = {
    states: { "sensor.rx": s("0.300", "MB/s") },
    formatEntityState(state) {
      calls.push(state);
      return Number(state.state).toFixed(3) + " MB/s";
    },
  };
  const chart = networkPlot(
    [{ key: "network_rx", entity: "sensor.rx", unit: "MB/s" }],
    {
      "sensor.rx": [
        { lu: (now - 1800000) / 1000, s: "0" },
        { lu: now / 1000, s: "0.3" },
      ],
    },
    now,
    hass,
  );
  assert.equal(
    chart.querySelector('[data-extremum="mid"]').textContent,
    "0.150 MB/s",
  );
  assert.ok(
    calls.every(
      (state) =>
        state.entity_id === "sensor.rx" &&
        state.attributes.unit_of_measurement === "MB/s",
    ),
  );
  assert.ok(calls.some((state) => Number(state.state) === 0.15));
});

test("quality and SNR remain visible when a router integration reports dBm", () => {
  const c = card(
    {
      connection_type: "cellular",
      rsrq_entity: "sensor.quality",
      snr_entity: "sensor.snr",
    },
    { "sensor.quality": s(-9, "dBm"), "sensor.snr": s(8.4, "dBm") },
  );
  assert.deepEqual(
    [...c.content.querySelectorAll(".router-gauge-value")].map(
      (n) => n.textContent,
    ),
    ["-9 dBm", "8.4 dBm"],
  );
  assert.equal(c.content.querySelectorAll(".router-gauge-fill").length, 2);
  let id;
  c.addEventListener("hass-more-info", (e) => (id = e.detail.entityId));
  c.content.querySelectorAll(".router-metric")[1].click();
  assert.equal(id, "sensor.snr");
  c.hass = {
    ...c.hass,
    entities: {
      "sensor.quality": { display_precision: 2 },
      "sensor.snr": { display_precision: 3 },
    },
  };
  assert.deepEqual(
    [...c.content.querySelectorAll(".router-gauge-value")].map(
      (n) => n.textContent,
    ),
    ["-9.00 dBm", "8.400 dBm"],
  );
  c.hass = {
    ...c.hass,
    states: { ...c.hass.states, "sensor.snr": s("unavailable", "dBm") },
  };
  assert.equal(c.content.querySelectorAll(".router-gauge-fill").length, 1);
  assert.equal(
    c.content.querySelectorAll(".router-gauge-value")[1].textContent,
    "—",
  );
  c.remove();
});

test("radio compatibility tolerates unit casing and whitespace but rejects unrelated units", async () => {
  const { gauge } = await import("../src/adapter.js");
  assert.equal(gauge(s(-9, " dBm "), "rsrq", {}).value, -9);
  assert.equal(gauge(s(8.4, "DBM"), "snr", {}).value, 8.4);
  assert.equal(gauge(s(8.4, "dB"), "snr", {}).unit, "dB");
  assert.equal(gauge(s(8.4), "snr", {}).unit, "dB");
  assert.equal(gauge(s(8.4, "W"), "snr", {}).value, null);
  assert.equal(gauge(s("unknown", "dBm"), "snr", {}).value, null);
  assert.equal(gauge(s("not a number", "dBm"), "snr", {}).value, null);
});
