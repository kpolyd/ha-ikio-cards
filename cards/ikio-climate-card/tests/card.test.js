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
  const Card = customElements.get("ikio-climate-card");
  const card = document.createElement("ikio-climate-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-climate-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-climate-card");
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

function setup(config = {}, attributes = {}, mode = "cool") {
  const card = document.createElement("ikio-climate-card");
  const calls = [];
  card.setConfig({ climate_entity: "climate.test", ...config });
  card.hass = {
    states: {
      "climate.test": {
        entity_id: "climate.test",
        state: mode,
        attributes: {
          friendly_name: "Test thermostat",
          supported_features: 1,
          hvac_modes: ["heat", "off", "cool", "auto"],
          min_temp: 16,
          max_temp: 30,
          temperature: 22,
          current_temperature: 24.5,
          target_temp_step: 0.5,
          temperature_unit: "°C",
          ...attributes,
        },
      },
    },
    callService: async (...args) => calls.push(args),
  };
  document.body.append(card);
  return { card, calls };
}
test("mode order, selected colour state and target commands follow HA with a larger step override", async () => {
  const { card, calls } = setup({ temperature_step: 1 });
  assert.deepEqual(
    [...card.shadowRoot.querySelectorAll(".climate-modes button")].map(
      (b) => b.textContent,
    ),
    ["Off", "Cool", "Heat", "Auto"],
  );
  assert.equal(
    card.shadowRoot.querySelector(".climate-card").dataset.mode,
    "cool",
  );
  assert.equal(card.shadowRoot.querySelector("input").step, "1");
  card.shadowRoot.querySelector('[aria-label="Increase target"]').click();
  await Promise.resolve();
  assert.deepEqual(calls[0], [
    "climate",
    "set_temperature",
    { temperature: 23, entity_id: "climate.test" },
  ]);
  assert.equal(card.shadowRoot.querySelector("output").textContent, "22°C");
  assert.ok(
    card.shadowRoot.querySelector('[aria-label="Increase target"]').disabled,
  );
  card.remove();
});
test("keyboard previews send on commit and use the integration step", async () => {
  const { card, calls } = setup();
  const input = card.shadowRoot.querySelector("input");
  assert.equal(input.step, "0.5");
  input.value = "23.5";
  input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(calls.length, 0);
  assert.match(card.shadowRoot.querySelector("output").textContent, /23.5/);
  input.dispatchEvent(new dom.window.Event("change"));
  await Promise.resolve();
  assert.equal(calls[0][2].temperature, 23.5);
  card.remove();
});
test("range targets preserve the other bound and block crossing", async () => {
  const { card, calls } = setup(
    {},
    { supported_features: 2, target_temp_low: 18, target_temp_high: 25 },
    "heat_cool",
  );
  const input = card.shadowRoot.querySelector("input");
  assert.equal(input.max, "25");
  input.value = "19";
  input.dispatchEvent(new dom.window.Event("change"));
  await Promise.resolve();
  assert.equal(calls[0][2].target_temp_low, 19);
  assert.equal(calls[0][2].target_temp_high, 25);
  card.remove();
});
test("native settings are capability gated, toggles hide them and positions use their own entity services", async () => {
  const { card, calls } = setup(
    {
      show_preset: false,
      horizontal_position_entity: "select.horizontal",
      vertical_position_entity: "number.vertical",
    },
    {
      supported_features: 1 | 8 | 16 | 32 | 512,
      fan_modes: ["auto", "low"],
      fan_mode: "auto",
      preset_modes: ["eco"],
      swing_modes: ["off", "vertical"],
      swing_horizontal_modes: ["off", "on"],
    },
  );
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "select.horizontal": {
        state: "center",
        attributes: { options: ["left", "center", "right"] },
      },
      "number.vertical": {
        state: "2",
        attributes: { min: 0, max: 5, step: 1 },
      },
    },
  };
  assert.equal(
    card.shadowRoot.querySelector('select[aria-label="Preset"]'),
    null,
  );
  assert.ok(card.shadowRoot.querySelector('select[aria-label="Swing"]'));
  const position = card.shadowRoot.querySelector(
    'select[aria-label="Horizontal position"]',
  );
  position.value = "left";
  position.dispatchEvent(new dom.window.Event("change"));
  await Promise.resolve();
  assert.deepEqual(calls[0], [
    "select",
    "select_option",
    { option: "left", entity_id: "select.horizontal" },
  ]);
  const vertical = card.shadowRoot.querySelector(
    'input[aria-label="Vertical position"]',
  );
  vertical.value = "4";
  vertical.dispatchEvent(new dom.window.Event("change"));
  await Promise.resolve();
  assert.deepEqual(calls[1], [
    "number",
    "set_value",
    { value: 4, entity_id: "number.vertical" },
  ]);
  card.remove();
});
test("unavailable devices preserve independent readings, removed fridge does not render, off retains measurements", () => {
  const { card } = setup({
    temperature_entity: "sensor.room",
    fridge_entity: "sensor.fridge",
  });
  card.hass = {
    ...card.hass,
    states: {
      "sensor.room": { state: "23", attributes: { unit_of_measurement: "°C" } },
      "climate.test": { state: "unavailable", attributes: {} },
    },
  };
  assert.match(card.content.textContent, /23 °C/);
  assert.match(card.content.textContent, /Device unavailable/);
  assert.equal(card.content.querySelector("input"), null);
  assert.equal(card.config.fridge_entity, undefined);
  card.remove();
  const off = setup({}, {}, "off").card;
  assert.match(off.content.textContent, /24.5 °C/);
  assert.equal(off.content.querySelector(".summary").textContent, "Off");
  assert.ok(off.content.querySelector("input").disabled);
  off.remove();
});
test("settings disclosure survives HA updates and legacy configuration migrates without losing HA metadata", () => {
  const { card } = setup(
    {
      climate_power_entity: "sensor.power",
      fan_entity: "fan.old",
      grid_options: { columns: 6 },
    },
    {
      supported_features: 1 | 8 | 16,
      fan_modes: ["auto", "low"],
      preset_modes: ["eco"],
      preset_mode: "eco",
    },
  );
  assert.equal(card.config.power_entity, "sensor.power");
  assert.equal(card.config.fan_entity, undefined);
  assert.deepEqual(card.config.grid_options, { columns: 6 });
  let details = card.content.querySelector("details");
  assert.equal(details.open, false);
  assert.equal(
    details.querySelector(".settings-chevron").getAttribute("icon"),
    "mdi:chevron-down",
  );
  details.open = true;
  details.dispatchEvent(new dom.window.Event("toggle"));
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "climate.test": {
        ...card.state("climate.test"),
        attributes: {
          ...card.state("climate.test").attributes,
          current_temperature: 24,
        },
      },
    },
  };
  assert.equal(card.content.querySelector("details").open, true);
  assert.equal(card.content.querySelector("details"), details);
  card.remove();
});
test("preview blocks service calls and backend failures remain visible", async () => {
  const { card, calls } = setup();
  card.preview = true;
  card.shadowRoot.querySelector('[aria-label="Increase target"]').click();
  assert.equal(calls.length, 0);
  card.preview = false;
  card.hass.callService = async () => {
    throw Error("Test failure");
  };
  card.shadowRoot.querySelector('[aria-label="Increase target"]').click();
  await new Promise((r) => setTimeout(r, 0));
  assert.match(card.error.textContent, /Test failure/);
  card.remove();
});

test("flat controls expose fan and swing immediately and select the correct dual target", async () => {
  const { card, calls } = setup(
    {},
    {
      supported_features: 2 | 8 | 32,
      target_temp_low: 18,
      target_temp_high: 25,
      fan_modes: ["auto", "low"],
      fan_mode: "auto",
      swing_modes: ["off", "on"],
      swing_mode: "off",
    },
    "heat_cool",
  );
  assert.equal(card.content.querySelector("svg"), null);
  assert.ok(
    card.content.querySelector(
      '.climate-quick-settings select[aria-label="Fan"]',
    ),
  );
  assert.ok(
    card.content.querySelector(
      '.climate-quick-settings select[aria-label="Swing"]',
    ),
  );
  assert.equal(card.content.querySelector("details"), null);
  const high = card.content.querySelector(
    '[data-key="target_temp_high"] .dial-caption',
  );
  high.click();
  assert.equal(card.targetBound, "target_temp_high");
  card.content.querySelector('[aria-label="Increase upper target"]').click();
  await Promise.resolve();
  assert.equal(calls[0][2].target_temp_high, 25.5);
  assert.equal(calls[0][2].target_temp_low, 18);
  card.remove();
});

test("holding a dual-target selector opens native details without selecting or sending", async () => {
  const { card, calls } = setup(
    {},
    { supported_features: 2, target_temp_low: 18, target_temp_high: 25 },
    "heat_cool",
  );
  let entity;
  card.addEventListener("hass-more-info", (e) => (entity = e.detail.entityId));
  const upper = card.content.querySelector(
    '[data-key="target_temp_high"] .dial-caption',
  );
  upper.dispatchEvent(
    new dom.window.MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 10,
      clientY: 10,
    }),
  );
  await new Promise((r) => setTimeout(r, 580));
  upper.dispatchEvent(
    new dom.window.MouseEvent("pointerup", { bubbles: true }),
  );
  upper.click();
  assert.equal(entity, "climate.test");
  assert.equal(card.targetBound, "target_temp_low");
  assert.equal(calls.length, 0);
  card.remove();
});
