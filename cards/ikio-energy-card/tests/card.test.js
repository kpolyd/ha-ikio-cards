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
  const Card = customElements.get("ikio-energy-card");
  const card = document.createElement("ikio-energy-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-energy-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-energy-card");
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

test("energy math distinguishes missing sensors, overlaps and bill-cycle periods", async () => {
  const { untracked, cycleTotal, forecastStatus } = await import(
    "../src/adapter.js"
  );
  const sensor = (v, u) => ({
    state: String(v),
    attributes: { unit_of_measurement: u },
  });
  assert.equal(untracked(sensor(1, "kW"), [sensor(100, "W")]).value, 900);
  assert.equal(
    untracked(sensor(10, "W"), [sensor(100, "W")]).reason,
    "Measurements do not reconcile",
  );
  assert.equal(untracked(sensor(10, "W"), [undefined]).value, null);
  assert.equal(cycleTotal(sensor(1, "kWh"), sensor(500, "Wh"), true), 1.5);
  assert.equal(cycleTotal(sensor(1, "kWh"), sensor(1, "kWh"), false), null);
  assert.equal(
    forecastStatus(
      { forecast_minimum_hours: 24, cycle_start_entity: "sensor.start" },
      { "sensor.start": { state: new Date(0).toISOString() } },
      3600000,
    ),
    "Gathering enough data",
  );
});
test("device grid uses identical clickable items and full-width untracked row", () => {
  const card = document.createElement("ikio-energy-card");
  document.body.append(card);
  card.setConfig({
    power_entity: "sensor.total",
    circuits: [
      { name: "Office", power_entity: "sensor.office" },
      { name: "TV", power_entity: "sensor.tv" },
    ],
    untracked_entity: "sensor.rest",
  });
  const sensor = (id, v) => ({
    entity_id: id,
    state: String(v),
    attributes: { unit_of_measurement: "W" },
  });
  card.hass = {
    states: {
      "sensor.total": sensor("sensor.total", 100),
      "sensor.office": sensor("sensor.office", 10),
      "sensor.tv": sensor("sensor.tv", 5),
      "sensor.rest": sensor("sensor.rest", 85),
    },
  };
  const items = card.shadowRoot.querySelectorAll(".ae-grid button");
  assert.equal(items.length, 2);
  assert.equal(items[0].className, items[1].className);
  let id;
  card.addEventListener("hass-more-info", (e) => (id = e.detail.entityId));
  items[1].click();
  assert.equal(id, "sensor.tv");
  assert.ok(
    card.shadowRoot
      .querySelector(".ae-separator")
      .textContent.includes("Untracked"),
  );
  card.remove();
});

test("energy totals form a compact summary and graph has no footer row", () => {
  const card = document.createElement("ikio-energy-card");
  document.body.append(card);
  card.setConfig({
    power_entity: "sensor.total",
    day_entity: "sensor.day",
    night_entity: "sensor.night",
    same_cycle: true,
    accrued_bill_entity: "sensor.bill",
  });
  const sensor = (entity_id, value, unit) => ({
    entity_id,
    state: String(value),
    attributes: { unit_of_measurement: unit },
  });
  card.hass = {
    states: {
      "sensor.total": sensor("sensor.total", 160, "W"),
      "sensor.day": sensor("sensor.day", 2, "kWh"),
      "sensor.night": sensor("sensor.night", 3, "kWh"),
      "sensor.bill": sensor("sensor.bill", 4, "€"),
    },
  };
  card.history = {
    "sensor.total": [
      { lu: Date.now() / 1000 - 100, s: "80", a: { unit_of_measurement: "W" } },
      { lu: Date.now() / 1000, s: "160" },
    ],
  };
  card.update();
  const summary = card.shadowRoot.querySelector(".ae-energy-summary");
  assert.ok(summary.textContent.includes("Current power"));
  assert.ok(summary.textContent.includes("Estimated bill"));
  assert.ok(summary.textContent.includes("Total"));
  const plot = card.shadowRoot.querySelector("[data-key=history-graph]");
  assert.equal(plot.querySelector(".ae-note"), null);
  assert.equal(plot.querySelector("[data-extremum=max]").textContent, "160 W");
  card.remove();
});
