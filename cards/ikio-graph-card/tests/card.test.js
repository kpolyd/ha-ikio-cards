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
test("shared graph palette follows dark, light and live HA appearance without changing paths", (t) => {
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  const card = document.createElement("ikio-graph-card");
  card.setConfig({
    entities: [{ entity: "sensor.power" }],
    appearance: { theme: "ha" },
  });
  card.hass = {
    states: {
      "sensor.power": {
        state: "500",
        attributes: { unit_of_measurement: "W" },
      },
    },
    themes: { darkMode: true },
  };
  card.history = {
    "sensor.power": [
      { lu: now / 1000 - 100, s: "0", a: { unit_of_measurement: "W" } },
      { lu: now / 1000, s: "500" },
    ],
  };
  card.update();
  const palette = () =>
    [...card.shadowRoot.querySelectorAll("stop")].map((n) =>
      n.getAttribute("stop-color"),
    );
  assert.equal(palette()[0], "#a4e4b8");
  assert.equal(palette().at(-1), "#c47dd4");
  const path = card.shadowRoot.querySelector("path").getAttribute("d");
  card.hass = { ...card.hass, themes: { darkMode: false } };
  assert.equal(palette()[0], "#48835b");
  assert.equal(palette().at(-1), "#9553a7");
  assert.equal(card.shadowRoot.querySelector("path").getAttribute("d"), path);
  card.remove();
});
test("card registers and safely renders an empty visual-editor stub", () => {
  const Card = customElements.get("ikio-graph-card");
  const card = document.createElement("ikio-graph-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-graph-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-graph-card");
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

test("multi-series legend labels remain associated with distinct line patterns and exact units", () => {
  const card = document.createElement("ikio-graph-card");
  card.setConfig({
    entities: [
      { entity: "sensor.one", name: "First" },
      { entity: "sensor.two", name: "Second" },
    ],
  });
  card.hass = {
    states: {
      "sensor.one": { state: "12", attributes: { unit_of_measurement: "W" } },
      "sensor.two": { state: "34", attributes: { unit_of_measurement: "W" } },
    },
  };
  document.body.append(card);
  const entries = card.shadowRoot.querySelectorAll(".ikio-legend-entry");
  assert.equal(entries.length, 2);
  assert.match(entries[0].textContent, /First12 W/);
  assert.match(entries[1].textContent, /Second34 W/);
  assert.ok(entries[1].querySelector(".dashed"));
  card.setConfig({ entities: [{ entity: "sensor.one" }], show_legend: false });
  assert.equal(card.shadowRoot.querySelector(".ikio-legend"), null);
  card.remove();
});

test("compact graph reuses Electricity-style axes without duplicate readings and exposes native layout sizing", () => {
  const card = document.createElement("ikio-graph-card"),
    now = Date.now();
  card.setConfig({
    entities: [{ entity: "sensor.temp" }],
    grid_options: { columns: 9, rows: 5 },
  });
  card.hass = {
    states: {
      "sensor.temp": {
        entity_id: "sensor.temp",
        state: "23.4",
        attributes: { unit_of_measurement: "°C" },
      },
    },
  };
  card.history = {
    "sensor.temp": [
      { lu: now / 1000 - 100, s: "19.5", a: { unit_of_measurement: "°C" } },
      { lu: now / 1000, s: "23.4" },
    ],
  };
  card.update();
  assert.equal(card.content.querySelectorAll(".graph-current").length, 1);
  assert.equal(card.content.querySelector(".ae-hero"), null);
  assert.equal(
    card.content.querySelectorAll(".ae-axis-guides line[data-guide]").length,
    7,
  );
  assert(card.content.querySelector(".ae-time-axis"));
  assert.deepEqual(card.colourRange(card.config.entities), {
    min: 19.5,
    max: 23.4,
  });
  assert.deepEqual(card.config.grid_options, { columns: 9, rows: 5 });
  assert.deepEqual(card.getGridOptions(), {
    columns: 6,
    rows: 3,
    min_columns: 3,
    min_rows: 3,
  });
  card.setConfig({ ...card.config, show_legend: false });
  assert.equal(card.content.querySelector(".graph-current"), null);
  card.setConfig({ ...card.config, show_legend: true });
  card.hass = { ...card.hass, states: {}, formatEntityState: (s) => s.state };
  assert.match(card.content.textContent, /Entity not found|Graph/);
  card.remove();
});

test("automatic colour ranges support negative/constant data and retain optional legacy overrides", async () => {
  const { normalizeConfig } = await import("../src/config.js");
  const card = document.createElement("ikio-graph-card"),
    now = Date.now();
  card.setConfig({
    entities: [{ entity: "sensor.temp", expected_min: -10, expected_max: 30 }],
    expected_min: "",
    expected_max: null,
    show_legend: false,
    view_layout: { column: 2 },
  });
  assert.equal(card.config.expected_min, undefined);
  assert.equal(card.config.entities[0].expected_min, -10);
  assert.deepEqual(card.config.view_layout, { column: 2 });
  card.hass = {
    states: {
      "sensor.temp": { state: "-5", attributes: { unit_of_measurement: "°C" } },
    },
  };
  card.history = {
    "sensor.temp": [
      { lu: now / 1000, s: "-5", a: { unit_of_measurement: "°C" } },
    ],
  };
  assert.deepEqual(card.colourRange(card.config.entities), {
    min: -6,
    max: -4,
  });
  card.config.expected_min = 100;
  assert.equal(card.colourRange(card.config.entities).min, 100);
  assert(card.colourRange(card.config.entities).max > 100);
  assert.throws(() =>
    normalizeConfig({ entities: [], expected_min: 10, expected_max: 5 }),
  );
  assert.doesNotThrow(() =>
    normalizeConfig({ entities: [], expected_min: 100 }),
  );
  card.remove();
});
