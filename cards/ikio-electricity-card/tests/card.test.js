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
  const Card = customElements.get("ikio-electricity-card");
  const card = document.createElement("ikio-electricity-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-electricity-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-electricity-card");
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
test("device grid includes Untracked as an identical entity reading", () => {
  const card = document.createElement("ikio-electricity-card");
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
  assert.equal(items.length, 3);
  assert.equal(items[0].className, items[1].className);
  let id;
  card.addEventListener("hass-more-info", (e) => (id = e.detail.entityId));
  items[1].click();
  assert.equal(id, "sensor.tv");
  assert.equal(items[2].className, items[0].className);
  assert.match(items[2].textContent, /Untracked85 W/);
  items[2].click();
  assert.equal(id, "sensor.rest");
  assert.equal(card.shadowRoot.querySelector(".ae-separator"), null);
  card.remove();
});

test("energy totals form a compact summary and graph has no footer row", () => {
  const card = document.createElement("ikio-electricity-card");
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

const energySensor = (state, unit) => ({
  state: String(state),
  attributes: { unit_of_measurement: unit },
});
function energyFixture(config, states) {
  const card = document.createElement("ikio-electricity-card");
  card.setConfig(config);
  card.hass = { locale: { language: "en" }, states };
  document.body.append(card);
  return card;
}
test("three-column summary leads with integer watts and retains energy/cost precision", () => {
  const card = energyFixture(
    {
      power_entity: "sensor.power",
      day_entity: "sensor.day",
      night_entity: "sensor.night",
      same_cycle: true,
      accrued_bill_entity: "sensor.bill",
      forecast_bill_entity: "sensor.forecast",
    },
    {
      "sensor.power": energySensor(0.16049, "kW"),
      "sensor.day": energySensor(11860, "Wh"),
      "sensor.night": energySensor(7.11, "kWh"),
      "sensor.bill": energySensor(30.09, "€"),
      "sensor.forecast": energySensor(60.6, "€"),
    },
  );
  const columns = card.shadowRoot.querySelector(".ae-energy-summary").children;
  assert.equal(columns.length, 3);
  assert.match(columns[0].textContent, /Current power160W/);
  assert.match(columns[1].textContent, /Total19.0kWhDay11.9kWhNight7.1kWh/);
  assert.match(columns[2].textContent, /Estimated bill30.09 €Forecast60.6 €/);
  assert.equal(card.hass.states["sensor.power"].state, "0.16049");
  card.remove();
});
test("power formatting handles kW, fractional/negative watts and unavailable values without negative zero", async () => {
  const { powerText, energyText } = await import("../src/adapter.js");
  const hass = {
    locale: { language: "en" },
    states: {
      kw: energySensor(1.2345, "kW"),
      negative: energySensor(-0.2, "W"),
      unavailable: energySensor("unavailable", "W"),
      energy: energySensor(500, "Wh"),
    },
  };
  assert.equal(powerText(hass, "kw"), "1,235 W");
  assert.equal(powerText(hass, "negative"), "0 W");
  assert.equal(powerText(hass, "unavailable"), "unavailable");
  assert.equal(energyText(hass, "energy"), "0.5");
  assert.equal(powerText(hass, "missing"), "Entity not found");
});
test("computed Untracked is a plain grid reading calculated before rounding", () => {
  const card = energyFixture(
    {
      power_entity: "sensor.power",
      circuits: [{ power_entity: "sensor.a" }, { power_entity: "sensor.b" }],
      show_untracked: true,
      non_overlapping: true,
    },
    {
      "sensor.power": energySensor(100.4, "W"),
      "sensor.a": energySensor(10.49, "W"),
      "sensor.b": energySensor(5.49, "W"),
    },
  );
  let untracked = [
    ...card.shadowRoot.querySelectorAll(".ae-grid .ae-reading"),
  ].find((n) => n.querySelector(".ae-label").textContent === "Untracked");
  assert.equal(untracked.tagName, "DIV");
  assert.equal(untracked.dataset.entity, undefined);
  assert.equal(untracked.querySelector(".ae-value").textContent, "84 W");
  assert.equal(card.shadowRoot.querySelector(".ae-button"), null);
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "sensor.a": energySensor("unavailable", "W"),
    },
  };
  untracked = [
    ...card.shadowRoot.querySelectorAll(".ae-grid .ae-reading"),
  ].find((n) => n.querySelector(".ae-label").textContent === "Untracked");
  assert.equal(untracked.querySelector(".ae-value").textContent, "— W");
  assert.match(
    card.shadowRoot.querySelector(".ae-warn").textContent,
    /unavailable/,
  );
  card.remove();
});
test("optional columns do not leave blank sections and a total-only energy binding remains visible", () => {
  const card = energyFixture(
    { power_entity: "sensor.power", total_energy_entity: "sensor.energy" },
    {
      "sensor.power": energySensor(0, "W"),
      "sensor.energy": energySensor(5000, "Wh"),
    },
  );
  assert.equal(
    card.shadowRoot.querySelector(".ae-energy-summary").children.length,
    2,
  );
  assert.match(
    card.shadowRoot.querySelector(".ae-energy-tariffs").textContent,
    /Total5/,
  );
  assert.equal(card.shadowRoot.querySelector(".ae-energy-bills"), null);
  card.setConfig({ power_entity: "sensor.power" });
  assert.equal(
    card.shadowRoot.querySelector(".ae-energy-summary").children.length,
    1,
  );
  card.remove();
});
test("forecast validity messages remain visible in the quieter bill column", () => {
  const card = energyFixture(
    {
      power_entity: "sensor.power",
      forecast_bill_entity: "sensor.forecast",
      forecast_valid_entity: "binary_sensor.valid",
    },
    {
      "sensor.power": energySensor(160, "W"),
      "sensor.forecast": energySensor(1e9, "€"),
      "binary_sensor.valid": { state: "off", attributes: {} },
    },
  );
  assert.match(
    card.shadowRoot.querySelector(".ae-energy-bills").textContent,
    /Gathering enough data/,
  );
  assert.ok(
    !card.shadowRoot
      .querySelector(".ae-energy-bills")
      .textContent.includes("1,000,000,000"),
  );
  card.remove();
});

test("device sparklines share one history request and auto-scale height while retaining the main colour palette", () => {
  const card = energyFixture(
    {
      power_entity: "sensor.total",
      circuits: [{ power_entity: "sensor.tv" }],
      untracked_entity: "sensor.rest",
    },
    {
      "sensor.total": energySensor(80, "W"),
      "sensor.tv": energySensor(7, "W"),
      "sensor.rest": energySensor(73, "W"),
    },
  );
  assert.deepEqual(card.historyEntities(), [
    "sensor.total",
    "sensor.tv",
    "sensor.rest",
  ]);
  const now = Date.now() / 1000;
  card.history = {
    "sensor.tv": [
      { lu: now - 100, s: "0.005", a: { unit_of_measurement: "kW" } },
      { lu: now, s: "0.007" },
    ],
    "sensor.rest": [{ lu: now - 100, s: "0", a: { unit_of_measurement: "W" } }],
  };
  card.update();
  const plots = card.shadowRoot.querySelectorAll(".ae-device-sparkline");
  assert.equal(plots.length, 2);
  assert.notEqual(
    plots[0].querySelector("linearGradient").id,
    plots[1].querySelector("linearGradient").id,
  );
  assert.match(
    plots[0].querySelector("svg").getAttribute("aria-label"),
    /5 W to 7 W/,
  );
  assert.equal(plots[0].querySelector(".ae-note"), null);
  assert.equal(plots[0].querySelectorAll("[data-extremum]").length, 0);
  assert.equal(
    plots[0].querySelector("stop:last-child").getAttribute("stop-color"),
    "#c47dd4",
  );
  assert.ok(!plots[1].querySelector("path").getAttribute("d").includes("NaN"));
  const gradient = plots[1].querySelector("linearGradient");
  const pathY = Number(
    plots[1]
      .querySelector("path")
      .getAttribute("d")
      .match(/^M[^,]+,([\d.]+)/)[1],
  );
  assert.equal(Number(gradient.getAttribute("y1")), pathY);
  card.remove();
});

test("Electricity main and device graphs share theme colours, including HA theme changes", (t) => {
  const fixedNow = Date.now();
  t.mock.method(Date, "now", () => fixedNow);
  const card = energyFixture(
    {
      power_entity: "sensor.total",
      circuits: [{ power_entity: "sensor.tv" }],
      appearance: { theme: "ha" },
    },
    {
      "sensor.total": energySensor(80, "W"),
      "sensor.tv": energySensor(7, "W"),
    },
  );
  const now = Date.now() / 1000;
  card.history = Object.fromEntries(
    ["sensor.total", "sensor.tv"].map((id) => [
      id,
      [
        { lu: now - 100, s: "0", a: { unit_of_measurement: "W" } },
        { lu: now, s: "80" },
      ],
    ]),
  );
  const colours = () =>
    [...card.shadowRoot.querySelectorAll("defs > *")].map((g) =>
      [...g.querySelectorAll("stop")].map((n) => n.getAttribute("stop-color")),
    );
  card.hass = { ...card.hass, themes: { darkMode: true } };
  card.historyError = "";
  card.update();
  assert.equal(colours().length, 2);
  assert.deepEqual(colours()[0], colours()[1]);
  assert.equal(colours()[0][0], "#a4e4b8");
  const path = card.shadowRoot.querySelector("path").getAttribute("d");
  card.hass = { ...card.hass, themes: { darkMode: false } };
  assert.deepEqual(colours()[0], colours()[1]);
  assert.equal(colours()[0][0], "#48835b");
  assert.equal(card.shadowRoot.querySelector("path").getAttribute("d"), path);
  card.setConfig({ ...card.config, appearance: { theme: "dark" } });
  assert.equal(card.graphStops[0][1], "#a4e4b8");
  card.setConfig({ ...card.config, appearance: { theme: "light" } });
  assert.equal(card.graphStops[0][1], "#48835b");
  card.remove();
});
test("computed Untracked history aligns asynchronous changes and preserves missing-data gaps", async () => {
  const { untrackedHistory } = await import("../src/adapter.js");
  assert.deepEqual(
    untrackedHistory([
      [
        { time: 1, value: 100 },
        { time: 3, value: 120 },
      ],
      [
        { time: 2, value: 20 },
        { time: 4, value: null },
        { time: 5, value: 10 },
      ],
    ]),
    [
      { time: 1, value: null },
      { time: 2, value: 80 },
      { time: 3, value: 100 },
      { time: 4, value: null },
      { time: 5, value: 110 },
    ],
  );
  assert.deepEqual(untrackedHistory([[{ time: 1, value: 100 }], []]), [
    { time: 1, value: null },
  ]);
});

test("device and Untracked graphs inherit configured main-graph colour thresholds", () => {
  const card = energyFixture(
    {
      power_entity: "sensor.total",
      circuits: [{ power_entity: "sensor.device" }],
      untracked_entity: "sensor.rest",
      expected_min: 100,
      expected_max: 7100,
    },
    {},
  );
  const points = [
    { time: 1, value: 1100 },
    { time: 2, value: 1101 },
  ];
  for (const name of ["Device", "Untracked"]) {
    const node = card.deviceReading(name, "1,100 W", undefined, points, 1, 2);
    const gradient = node.querySelector("linearGradient");
    const y = Number(
      node
        .querySelector("path")
        .getAttribute("d")
        .match(/^M[^,]+,([^ ]+)/)[1],
    );
    const ratio =
      (y - Number(gradient.getAttribute("y1"))) /
      (Number(gradient.getAttribute("y2")) -
        Number(gradient.getAttribute("y1")));
    assert.ok(Math.abs(ratio - 1000 / 7000) < 1e-10);
  }
  card.remove();
});

test("each tariff value shows one decimal and its own kWh suffix without rounding the calculated total inputs", () => {
  const states = {
    "sensor.day": energySensor(1040, "Wh"),
    "sensor.night": energySensor(1.04, "kWh"),
    "sensor.power": energySensor(80, "W"),
  };
  const card = energyFixture(
    {
      power_entity: "sensor.power",
      day_entity: "sensor.day",
      night_entity: "sensor.night",
      same_cycle: true,
    },
    states,
  );
  const values = [
    ...card.shadowRoot.querySelectorAll(".ae-energy-tariffs .ae-value"),
  ];
  assert.deepEqual(
    values.map((n) => n.textContent),
    ["2.1kWh", "1.0kWh", "1.0kWh"],
  );
  assert.ok(
    values.every((n) => n.querySelector("small").textContent === "kWh"),
  );
  assert.equal(card.hass.states["sensor.day"].state, "1040");
  card.hass = { ...card.hass, locale: { language: "el" } };
  assert.equal(
    card.shadowRoot.querySelector(".ae-tariff-legend .ae-value").textContent,
    "1,0kWh",
  );
  card.remove();
});

test("tariff chart preserves readings and only draws reconciled, available shares", () => {
  const config = {
    power_entity: "sensor.power",
    day_entity: "sensor.day",
    night_entity: "sensor.night",
    total_energy_entity: "sensor.energy",
  };
  const states = {
    "sensor.power": energySensor(80, "W"),
    "sensor.day": energySensor(8400, "Wh"),
    "sensor.night": energySensor(3.6, "kWh"),
    "sensor.energy": energySensor(12, "kWh"),
  };
  const card = energyFixture(config, states);
  const bar = () => card.shadowRoot.querySelector(".ae-tariff-bar");
  assert.equal(bar().children.length, 2);
  assert.equal(bar().firstChild.style.width, "70%");
  assert.equal(bar().lastChild.style.width, "30%");
  for (const value of ["unavailable", -1, 0]) {
    card.hass = {
      states: { ...states, "sensor.energy": energySensor(value, "kWh") },
    };
    assert.equal(bar().children.length, 0);
    assert.match(
      card.shadowRoot.querySelector(".ae-tariff-legend").textContent,
      /Day8.4kWhNight3.6kWh/,
    );
  }
  card.remove();
});
