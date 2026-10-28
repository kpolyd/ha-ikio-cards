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
    "2 MB/s",
  );
  assert.equal(
    chart.querySelector('[data-extremum="mid"]').textContent,
    "1 MB/s",
  );
  assert.equal(
    chart.querySelector('[data-extremum="min"]').textContent,
    "0 B/s",
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
