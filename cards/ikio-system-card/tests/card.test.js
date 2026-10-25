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
  const Card = customElements.get("ikio-system-card");
  const card = document.createElement("ikio-system-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-system-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-system-card");
  const editor = await Card.getConfigElement();
  const config = {
    ...Card.getStubConfig(),
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

test("service restart keeps confirmation inside the card and services stay disclosed", async () => {
  const card = document.createElement("ikio-system-card");
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
  const card = document.createElement("ikio-system-card");
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
    card.shadowRoot.querySelector(".ikio-system-metadata").textContent,
    "",
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
