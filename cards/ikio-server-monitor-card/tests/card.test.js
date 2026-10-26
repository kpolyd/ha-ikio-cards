import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom;
before(async () => {
  dom = new JSDOM("<body></body>", { url: "http://localhost" });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  customElements.define("ha-form", class extends HTMLElement {});
  await import("../src/index.js");
});
after(() => dom.window.close());
test("card registers and safely renders an empty visual-editor stub", () => {
  const Card = customElements.get("ikio-server-monitor-card");
  const card = document.createElement("ikio-server-monitor-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(
    window.customCards.some((c) => c.type === "ikio-server-monitor-card"),
  );
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-server-monitor-card");
  const editor = await Card.getConfigElement();
  const config = {
    ...Card.getStubConfig(),
    ram_free_entity: "sensor.memory_available",
    disk_free_entity: "sensor.disk_free",
    grid_options: { columns: 6 },
    visibility: [{ condition: "user", users: ["owner"] }],
  };
  editor.setConfig(config);
  editor.hass = { states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const forms = editor.shadowRoot.querySelectorAll("ha-form");
  assert.ok(forms.length >= 2);
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  forms[0].dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...forms[0].data, name: "Changed" } },
    }),
  );
  assert.equal(saved.name, "Changed");
  assert.equal(saved.ram_free_entity, config.ram_free_entity);
  assert.equal(saved.disk_free_entity, config.disk_free_entity);
  assert.deepEqual(saved.grid_options, config.grid_options);
  assert.deepEqual(saved.visibility, config.visibility);
  assert.equal(config.name, undefined);
  editor.setConfig(saved);
  assert.equal(editor.shadowRoot.querySelector("ha-form").data.name, "Changed");
  editor.remove();
});

test("storage percentages convert compatible units and reject zero totals", async () => {
  const { utilization, threshold } = await import("../src/adapter.js");
  const s = (v, u) => ({
    state: String(v),
    attributes: { unit_of_measurement: u },
  });
  assert.equal(utilization(null, s(500, "MB"), s(1, "GB")), 50);
  assert.equal(utilization(null, s(1, "GB"), s(0, "GB")), null);
  assert.equal(utilization(s(42, "%")), 42);
  assert.equal(threshold(90, { warning: 70, critical: 85 }), "critical");
});
test("used plus remaining derives storage utilization with compatible units and honest missing data", async () => {
  const { utilization } = await import("../src/adapter.js");
  const s = (state, unit) => ({
    state: String(state),
    attributes: { unit_of_measurement: unit },
  });
  assert.equal(utilization(null, s(1024, "MiB"), null, s(1, "GiB")), 50);
  assert.equal(utilization(null, s(500, "MB"), null, s(0.5, "GB")), 50);
  assert.equal(utilization(null, s(0, "GB"), null, s(1, "GB")), 0);
  assert.equal(utilization(null, s(1, "GB"), null, s(0, "GB")), 100);
  assert.equal(utilization(null, s(0, "GB"), null, s(0, "GB")), null);
  assert.equal(utilization(null, s(1, "GB"), null, s(-1, "GB")), null);
  assert.equal(utilization(null, s(-1, "GB"), null, s(2, "GB")), null);
  assert.equal(
    utilization(null, s(1, "GB"), null, s("unavailable", "GB")),
    null,
  );
  assert.equal(utilization(null, s(1, "GB"), null, s(1, "W")), null);
  assert.equal(utilization(s(25, "%"), s(1, "GB"), null, s(1, "GB")), 25);
  assert.equal(utilization(null, s(1, "GB"), s(4, "GB"), s(1, "GB")), 25);
});
test("used/remaining sensors populate RAM and disk rings and react to live remaining changes", () => {
  const s = (state, unit) => ({
    state: String(state),
    attributes: { unit_of_measurement: unit },
  });
  const card = systemFixture(
    {
      ram_percent_entity: undefined,
      disk_percent_entity: undefined,
      ram_used_entity: "sensor.memory_used",
      ram_free_entity: "sensor.memory_free",
      disk_used_entity: "sensor.storage_used",
      disk_free_entity: "sensor.storage_free",
    },
    {
      "sensor.memory_used": s(8, "GiB"),
      "sensor.memory_free": s(8, "GiB"),
      "sensor.storage_used": s(750, "GB"),
      "sensor.storage_free": s(250, "GB"),
    },
  );
  const resources = () => card.shadowRoot.querySelectorAll(".ikio-resource");
  assert.match(resources()[1].textContent, /50%RAM8 GiB used · 8 GiB free/);
  assert.match(resources()[2].textContent, /75%Disk750 GB used · 250 GB free/);
  assert.ok(resources()[2].querySelector(".warning"));
  assert.ok(card.entityIds.includes("sensor.memory_free"));
  card.hass = {
    ...card.hass,
    states: { ...card.hass.states, "sensor.memory_free": s(0, "GiB") },
  };
  assert.match(resources()[1].textContent, /100%/);
  assert.ok(resources()[1].querySelector(".critical"));
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "sensor.memory_free": s("unavailable", "GiB"),
    },
  };
  assert.ok(resources()[1].querySelector(".unknown"));
  card.remove();
});

test("service restart keeps confirmation inside the card and services stay disclosed", async () => {
  const card = document.createElement("ikio-server-monitor-card");
  card.setConfig({
    services: [{ name: "Example", restart_action: "script.restart" }],
  });
  const calls = [];
  card.hass = {
    states: { "script.restart": { state: "off", attributes: {} } },
    callService: async (...args) => calls.push(args),
  };
  document.body.append(card);
  const details = card.shadowRoot.querySelector("details");
  assert.equal(details.open, false);
  details.open = true;
  details.dispatchEvent(new dom.window.Event("toggle"));
  card.shadowRoot.querySelector('[aria-label="Restart"]').click();
  assert.equal(calls.length, 0);
  assert.equal(card.shadowRoot.querySelector("dialog"), null);
  assert.match(
    card.shadowRoot.querySelector(".ikio-review").textContent,
    /Restart Example/,
  );
  card.shadowRoot.querySelector("[data-key=confirm-review]").click();
  await Promise.resolve();
  assert.equal(calls[0][1], "turn_on");
  assert.equal(calls[0][2].entity_id, "script.restart");
  assert.equal(details.open, true);
  card.remove();
});

test("uptime interprets explicit units and timestamps and chooses days/hours/minutes", async () => {
  const { uptimeSeconds, uptimeLabel, rateFactor, rateHistory } = await import(
    "../src/adapter.js"
  );
  const s = (value, unit) => ({
    state: String(value),
    attributes: { unit_of_measurement: unit },
  });
  assert.equal(uptimeLabel(uptimeSeconds(s(72, "h"))), "Up for 3 days");
  assert.equal(uptimeLabel(uptimeSeconds(s(90, "min"))), "Up for 1 hour");
  assert.equal(uptimeLabel(uptimeSeconds(s(120, "s"))), "Up for 2 minutes");
  assert.equal(uptimeSeconds(s(10, "mystery")), null);
  assert.equal(uptimeSeconds(s(-1, "h")), null);
  assert.equal(
    uptimeSeconds(s(new Date(0).toISOString()), "timestamp", 86400000),
    86400,
  );
  assert.equal(
    uptimeSeconds(s(new Date(86400000).toISOString()), "timestamp", 0),
    null,
  );
  assert.equal(rateFactor("MB/s"), 1e6);
  assert.equal(rateFactor("Mbit/s"), 125000);
  assert.equal(rateFactor("MiB/s"), 1048576);
  assert.equal(rateFactor("Mbps"), 125000);
  assert.equal(rateFactor("MB"), null);
  assert.deepEqual(
    rateHistory(
      [
        { lu: 1, s: "8", a: { unit_of_measurement: "Mbit/s" } },
        { lu: 2, s: "unavailable" },
        { lu: 3, s: "2", a: { unit_of_measurement: "MB/s" } },
      ],
      "B/s",
    ).map((p) => p.value),
    [1e6, null, 2e6],
  );
});
function systemFixture(config = {}, states = {}, callWS) {
  const card = document.createElement("ikio-server-monitor-card");
  card.setConfig({
    availability_entity: "binary_sensor.host",
    uptime_entity: "sensor.uptime",
    temperature_entity: "sensor.temperature",
    cpu_entity: "sensor.cpu",
    ram_percent_entity: "sensor.ram",
    disk_percent_entity: "sensor.disk",
    ...config,
  });
  card.hass = {
    states: {
      "binary_sensor.host": { state: "on", attributes: {} },
      "sensor.uptime": {
        state: "72",
        attributes: { unit_of_measurement: "h" },
      },
      "sensor.temperature": {
        state: "48",
        attributes: { unit_of_measurement: "°C" },
      },
      "sensor.cpu": { state: "12", attributes: { unit_of_measurement: "%" } },
      "sensor.ram": { state: "36", attributes: { unit_of_measurement: "%" } },
      "sensor.disk": { state: "42", attributes: { unit_of_measurement: "%" } },
      ...states,
    },
    connection: {},
  };
  document.body.append(card);
  card.hass = { ...card.hass, callWS };
  return card;
}
test("rings expose measured percentages, unknowns, thresholds and native details without separate temperature/uptime rows", () => {
  const card = systemFixture(
    { thresholds: [{ metric: "cpu", warning: 10, critical: 90 }] },
    {
      "sensor.cpu": { state: "70", attributes: { unit_of_measurement: "%" } },
      "sensor.ram": {
        state: "unavailable",
        attributes: { unit_of_measurement: "%" },
      },
    },
  );
  assert.equal(card.shadowRoot.querySelectorAll(".system-ring").length, 3);
  assert.equal(card.shadowRoot.querySelector("progress"), null);
  assert.ok(card.shadowRoot.querySelector(".system-ring.warning"));
  assert.equal(card.shadowRoot.querySelectorAll(".system-ring-arc").length, 2);
  assert.match(
    card.shadowRoot.querySelector(".system-ring.unknown").textContent,
    /—/,
  );
  assert.match(
    card.shadowRoot.querySelector("header").textContent,
    /48 °C.*Up for 3 days/,
  );
  assert.equal(
    card.shadowRoot.querySelector(".ikio-server-monitor-metadata"),
    null,
  );
  let id;
  card.addEventListener(
    "hass-more-info",
    (event) => (id = event.detail.entityId),
  );
  card.shadowRoot.querySelector("[data-key=header-temperature]").click();
  assert.equal(id, "sensor.temperature");
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "binary_sensor.host": { state: "off", attributes: {} },
    },
  };
  assert.match(card.shadowRoot.querySelector("header").textContent, /Offline/);
  assert.doesNotMatch(
    card.shadowRoot.querySelector("header").textContent,
    /Up for|Online/,
  );
  card.remove();
});
const settle = () => new Promise(setImmediate);
test("uptime alone supplies the status dot and unavailable/invalid uptime never looks online", () => {
  const card = systemFixture({ availability_entity: undefined });
  assert.ok(card.shadowRoot.querySelector(".system-online-dot"));
  assert.match(
    card.shadowRoot.querySelector("header").textContent,
    /Up for 3 days/,
  );
  for (const [value, label] of [
    ["unavailable", "Offline"],
    ["unknown", "Unknown"],
    ["invalid", "Unknown"],
  ]) {
    card.hass = {
      ...card.hass,
      states: {
        ...card.hass.states,
        "sensor.uptime": { state: value, attributes: {} },
      },
    };
    assert.equal(card.shadowRoot.querySelector(".system-online-dot"), null);
    assert.equal(
      Boolean(card.shadowRoot.querySelector(".system-offline-dot")),
      value === "unavailable",
    );
    assert.match(
      card.shadowRoot.querySelector("header").textContent,
      new RegExp(label),
    );
  }
  card.remove();
});

test("recorded zero traffic fills the window on first open while missing history stays empty", async () => {
  const now = Date.now() / 1000;
  const card = systemFixture(
    { network_rx_entity: "sensor.rx" },
    {
      "sensor.rx": { state: "0", attributes: { unit_of_measurement: "MB/s" } },
    },
    async () => ({
      "sensor.rx": [
        { lu: now - 1801, s: "0", a: { unit_of_measurement: "MB/s" } },
        { lu: now - 1200, s: "0" },
        { lu: now - 600, s: "0" },
      ],
    }),
  );
  card.visible = true;
  card.onVisibility();
  await settle();
  const path = card.shadowRoot.querySelector(".system-network-plot path");
  assert.match(path.getAttribute("d"), /^M0,30 /);
  assert.match(path.getAttribute("d"), /L300,30 /);
  card.network = {};
  card.update();
  assert.equal(card.shadowRoot.querySelector(".system-network-plot"), null);
  assert.match(card.shadowRoot.textContent, /No network history yet/);
  card.remove();
});

test("network history batches both rate sensors, preserves gaps and stops requests when hidden", async () => {
  const calls = [];
  const now = Date.now() / 1000;
  const rows = [
    { lu: now - 1800, s: "8", a: { unit_of_measurement: "Mbit/s" } },
    { lu: now - 1200, s: "unavailable" },
    { lu: now - 600, s: "16" },
  ];
  const card = systemFixture(
    { network_rx_entity: "sensor.rx", network_tx_entity: "sensor.tx" },
    {
      "sensor.rx": {
        state: "8",
        attributes: { unit_of_measurement: "Mbit/s" },
      },
      "sensor.tx": { state: "1", attributes: { unit_of_measurement: "MB/s" } },
    },
    async (msg) => {
      calls.push(msg);
      return { "sensor.rx": rows, "sensor.tx": rows };
    },
  );
  card.visible = true;
  card.onVisibility();
  await settle();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].entity_ids, ["sensor.rx", "sensor.tx"]);
  assert.equal(calls[0].include_start_time_state, true);
  assert.equal(calls[0].significant_changes_only, false);
  assert.equal(calls[0].minimal_response, false);
  assert.equal(
    Date.parse(calls[0].end_time) - Date.parse(calls[0].start_time),
    1800000,
  );
  assert.equal(
    card.shadowRoot.querySelectorAll(".system-network-plot path").length,
    2,
  );
  assert.ok(
    card.shadowRoot
      .querySelector(".system-network-plot path")
      .getAttribute("d")
      .split("M").length > 2,
  );
  assert.match(
    card.shadowRoot.querySelector(".system-network-legend").textContent,
    /Download8 Mbit\/s.*Upload1 MB\/s/,
  );
  card.update();
  assert.equal(calls.length, 1);
  const network = () => card.shadowRoot.querySelector(".system-network");
  assert.equal(
    network().style.getPropertyValue("--ae-network-download"),
    "#a4e4b8",
  );
  assert.equal(
    network().style.getPropertyValue("--ae-network-upload"),
    "#c47dd4",
  );
  assert.equal(
    card.shadowRoot
      .querySelectorAll(".system-network-plot path")[1]
      .getAttribute("stroke-dasharray"),
    "4 3",
  );
  card.setConfig({ ...card.config, appearance: { theme: "ha" } });
  card.hass = { ...card.hass, themes: { darkMode: true } };
  card.hass = { ...card.hass, themes: { darkMode: false } };
  assert.equal(
    network().style.getPropertyValue("--ae-network-download"),
    "#48835b",
  );
  assert.equal(
    network().style.getPropertyValue("--ae-network-upload"),
    "#9553a7",
  );
  card.visible = false;
  card.onVisibility();
  assert.equal(card.networkLoading, false);
  card.remove();
});
test("network history timeouts retain live rates and late replies do not restore obsolete data", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let resolve;
  const card = systemFixture(
    { network_rx_entity: "sensor.rx" },
    {
      "sensor.rx": { state: "2", attributes: { unit_of_measurement: "MB/s" } },
    },
    () => new Promise((r) => (resolve = r)),
  );
  card.visible = true;
  const loading = card.loadNetwork();
  t.mock.timers.tick(5000);
  await loading;
  assert.equal(card.networkLoading, false);
  assert.match(card.shadowRoot.textContent, /Network history unavailable/);
  assert.match(
    card.shadowRoot.querySelector(".system-network-legend").textContent,
    /2 MB\/s/,
  );
  card.remove();
  resolve({ "sensor.rx": [{ lu: Date.now() / 1000, s: "100" }] });
  await settle();
  assert.deepEqual(card.network, {});
});

test("automatic uptime and availability replace both editor options, including legacy default configurations", async () => {
  const { availabilityLabel, uptimeSeconds } = await import(
    "../src/adapter.js"
  );
  const card = systemFixture(
    { uptime_mode: "duration", online_state: "on" },
    {
      "sensor.uptime": {
        state: new Date(Date.now() - 3 * 86400000).toISOString(),
        attributes: { device_class: "timestamp" },
      },
      "binary_sensor.host": { state: "connected", attributes: {} },
    },
  );
  assert.match(
    card.shadowRoot.querySelector("header").textContent,
    /Up for 3 days/,
  );
  assert.ok(card.shadowRoot.querySelector(".system-online-dot"));
  assert.equal(
    availabilityLabel({ state: "maintenance", attributes: {} }),
    "maintenance",
  );
  assert.equal(
    availabilityLabel({ state: "on", attributes: { device_class: "problem" } }),
    "Offline",
  );
  assert.equal(
    availabilityLabel({
      state: "off",
      attributes: { device_class: "problem" },
    }),
    "Online",
  );
  assert.equal(availabilityLabel({ state: "unavailable" }), "Unavailable");
  assert.equal(uptimeSeconds({ state: "02:30:00", attributes: {} }), 9000);
  assert.equal(uptimeSeconds({ state: "2 days", attributes: {} }), 172800);
  assert.equal(uptimeSeconds({ state: "500", attributes: {} }), null);
  const Card = customElements.get("ikio-server-monitor-card");
  assert.equal("uptime_mode" in Card.getStubConfig(), false);
  assert.equal("online_state" in Card.getStubConfig(), false);
  const editor = await Card.getConfigElement();
  editor.setConfig(card.config);
  editor.hass = card.hass;
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const names = [...editor.shadowRoot.querySelectorAll("ha-form")].flatMap(
    (form) => (form.schema || []).map((field) => field.name),
  );
  assert.ok(names.includes("uptime_entity"));
  assert.equal(names.includes("availability_entity"), false);
  assert.equal(names.includes("online_state"), false);
  assert.equal(names.includes("uptime_mode"), false);
  editor.remove();
  card.remove();
});

test("database stays available inside collapsed details without an extra overview row or an inflated service count", () => {
  const card = systemFixture(
    {
      database_entity: "sensor.database",
      services: [{ name: "Example", status_entity: "binary_sensor.service" }],
    },
    {
      "sensor.database": {
        state: "871.44",
        attributes: { unit_of_measurement: "MB" },
      },
      "binary_sensor.service": { state: "on", attributes: {} },
    },
  );
  const details = card.shadowRoot.querySelector("details");
  assert.equal(details.open, false);
  assert.match(details.querySelector("summary").textContent, /Services · 1/);
  assert.equal(
    details.querySelector("summary ha-icon").getAttribute("icon"),
    "mdi:chevron-down",
  );
  const database = details.querySelector('[data-entity="sensor.database"]');
  assert.match(database.textContent, /871.44 MB/);
  assert.equal(
    card.shadowRoot.querySelector(".ikio-server-monitor-metadata"),
    null,
  );
  card.remove();
});

test("fixed 70/85 thresholds apply at their boundaries and override legacy settings", async () => {
  const { metricLevel } = await import("../src/adapter.js");
  assert.equal(metricLevel(69.9), "");
  assert.equal(metricLevel(70), "warning");
  assert.equal(metricLevel(84.9), "warning");
  assert.equal(metricLevel(85), "critical");
  assert.equal(metricLevel(null), "");
  const card = systemFixture(
    { thresholds: [{ metric: "cpu", warning: 1, critical: 2 }] },
    { "sensor.cpu": { state: "70", attributes: { unit_of_measurement: "%" } } },
  );
  assert.ok(card.shadowRoot.querySelector(".system-ring.warning"));
  assert.equal(card.shadowRoot.querySelector(".system-ring.critical"), null);
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "sensor.cpu": { state: "85", attributes: { unit_of_measurement: "%" } },
    },
  };
  assert.ok(card.shadowRoot.querySelector(".system-ring.critical"));
  assert.match(
    card.shadowRoot.querySelector(".system-error-note").textContent,
    /error threshold/,
  );
  const Card = customElements.get("ikio-server-monitor-card");
  assert.equal("thresholds" in Card.getStubConfig(), false);
  const editor = await Card.getConfigElement();
  editor.setConfig(card.config);
  editor.hass = card.hass;
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  assert.doesNotMatch(
    editor.shadowRoot.textContent,
    /Metric thresholds|Warning threshold|Critical threshold|Threshold direction/,
  );
  editor.remove();
  card.remove();
});

test("network preserves known intervals before unknown readings without bridging gaps", async () => {
  const { networkPlot } = await import("../src/views.js");
  const now = 1800000;
  for (const value of ["0", "2"]) {
    const history = [
      { lu: 0, s: value },
      { lu: 300, s: "unknown" },
      { lu: 315, s: value },
      { lu: 900, s: "unavailable" },
      { lu: 915, s: value },
    ];
    const svg = networkPlot(
      [{ entity: "sensor.example", key: "network_rx", unit: "B/s" }],
      { "sensor.example": history },
      now,
      {},
    );
    const y = value === "0" ? 30 : 2;
    assert.equal(
      svg.querySelector("path").getAttribute("d"),
      `M0,${y} L50,${y} M52.5,${y} L150,${y} M152.5,${y} L300,${y} `,
    );
  }
});

test("network downsampling preserves gap boundaries and trailing unknowns", async () => {
  const { networkPlot } = await import("../src/views.js");
  const history = Array.from({ length: 600 }, (_, i) => ({ lu: i, s: "1" }));
  history.push(
    { lu: 600, s: "unknown" },
    { lu: 615, s: "2" },
    { lu: 900, s: "unknown" },
  );
  const svg = networkPlot(
    [{ entity: "sensor.example", key: "network_rx", unit: "B/s" }],
    { "sensor.example": history },
    1800000,
    {},
  );
  const d = svg.querySelector("path").getAttribute("d");
  assert.match(d, /L100,30 M102.5,2 L150,2 $/);
  assert.equal((d.match(/M/g) || []).length, 2);
  assert.doesNotMatch(d, /L300,/);
});
test("network axis uses visible combined min/max in normalized rate units and preserves gaps", async () => {
  const { networkPlot } = await import("../src/views.js");
  const chart = networkPlot(
    [
      { entity: "sensor.rx", key: "network_rx", unit: "Mbit/s" },
      { entity: "sensor.tx", key: "network_tx", unit: "MB/s" },
    ],
    {
      "sensor.rx": [
        { lu: 0, s: "8" },
        { lu: 900, s: "16" },
        { lu: 1200, s: "unknown" },
        { lu: 1500, s: "8" },
      ],
      "sensor.tx": [
        { lu: 0, s: "1.5" },
        { lu: 1800, s: "1.75" },
        { lu: 1900, s: "1000" },
      ],
    },
    1800000,
    {},
  );
  assert.equal(
    chart.querySelector('[data-extremum="min"]').textContent,
    "1 MB/s",
  );
  assert.equal(
    chart.querySelector('[data-extremum="max"]').textContent,
    "2 MB/s",
  );
  assert.equal(chart.querySelectorAll("[data-guide]").length, 2);
  assert.equal(chart.querySelectorAll("path").length, 2);
  assert.ok(
    chart.querySelector("path").getAttribute("d").split("M").length > 2,
  );
  assert.equal(
    chart.querySelectorAll("path")[1].getAttribute("stroke-dasharray"),
    "4 3",
  );
  assert.equal(
    chart.querySelector('[data-guide="min"]').getAttribute("y1"),
    "30",
  );
  assert.equal(
    chart.querySelector('[data-guide="max"]').getAttribute("y1"),
    "2",
  );
});
test("constant network history has one extremum and zero traffic remains a visible flat line", async () => {
  const { networkPlot } = await import("../src/views.js");
  const rows = [{ entity: "sensor.rx", key: "network_rx", unit: "B/s" }];
  for (const value of [0, 0.5, 1000]) {
    const chart = networkPlot(
      rows,
      { "sensor.rx": [{ lu: 0, s: String(value) }] },
      1800000,
      {},
    );
    assert.equal(chart.querySelectorAll("[data-extremum]").length, 1);
    assert.equal(chart.querySelectorAll("[data-guide]").length, 1);
    assert.doesNotMatch(
      chart.querySelector("path").getAttribute("d"),
      /NaN|Infinity/,
    );
  }
  assert.equal(
    networkPlot(
      rows,
      { "sensor.rx": [{ lu: 0, s: "unavailable" }] },
      1800000,
      {},
    ),
    null,
  );
});

test("network extrema show at most one decimal while keeping precise plot values", async () => {
  const { networkPlot } = await import("../src/views.js");
  const chart = networkPlot(
    [{ entity: "sensor.rx", key: "network_rx", unit: "MB/s" }],
    {
      "sensor.rx": [
        { lu: 0, s: "1.24" },
        { lu: 1800, s: "2.36" },
      ],
    },
    1800000,
    { locale: { language: "en" } },
  );
  assert.equal(
    chart.querySelector('[data-extremum="min"]').textContent,
    "1.2 MB/s",
  );
  assert.equal(
    chart.querySelector('[data-extremum="max"]').textContent,
    "2.4 MB/s",
  );
  assert.equal(chart.querySelector("path").getAttribute("d"), "M0,30 L300,2 ");
});
