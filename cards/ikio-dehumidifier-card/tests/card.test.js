import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let fields;
let dom;
before(async () => {
  dom = new JSDOM("<body/>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
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
  ({ fields } = await import("../src/config.js"));
});
after(() => dom.window.close());
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function setup(config = {}, attributes = {}, state = "on") {
  const calls = [],
    card = document.createElement("ikio-dehumidifier-card");
  card.setConfig({ humidifier_entity: "humidifier.test", ...config });
  card.hass = {
    locale: { language: "en" },
    states: {
      "humidifier.test": {
        entity_id: "humidifier.test",
        state,
        attributes: {
          friendly_name: "Test dehumidifier",
          humidity: 50,
          current_humidity: 62,
          min_humidity: 35,
          max_humidity: 80,
          action: "drying",
          supported_features: 1,
          available_modes: ["Auto", "Laundry", "Continuous"],
          mode: "Auto",
          ...attributes,
        },
      },
    },
    callService: async (...args) => calls.push(args),
  };
  document.body.append(card);
  return { card, calls };
}
function updateDevice(
  card,
  state = card.state("humidifier.test").state,
  attributes = {},
) {
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "humidifier.test": {
        ...card.state("humidifier.test"),
        state,
        attributes: {
          ...card.state("humidifier.test").attributes,
          ...attributes,
        },
      },
    },
  };
}
test("stub renders safely; all configuration fields are available visually and preserve dashboard metadata", async () => {
  const Card = customElements.get("ikio-dehumidifier-card");
  const stub = document.createElement("ikio-dehumidifier-card");
  stub.setConfig(Card.getStubConfig());
  stub.hass = { states: {} };
  assert.match(stub.content.textContent, /Choose a dehumidifier/);
  const editor = await Card.getConfigElement();
  const config = {
    ...Card.getStubConfig(),
    grid_options: { columns: 6 },
    visibility: [{ condition: "user", users: ["owner"] }],
  };
  editor.setConfig(config);
  editor.hass = { states: {} };
  document.body.append(editor);
  await tick();
  const forms = editor.shadowRoot.querySelectorAll("ha-form");
  const names = [...forms].flatMap((form) => form.schema.map((f) => f.name));
  for (const field of fields) assert.ok(names.includes(field.name), field.name);
  assert.ok(names.includes("name"));
  assert.ok(forms.length >= 2, "appearance form");
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  forms[0].dispatchEvent(
    new CustomEvent("value-changed", {
      detail: {
        value: { ...forms[0].data, humidifier_entity: "humidifier.test" },
      },
    }),
  );
  assert.deepEqual(saved.grid_options, config.grid_options);
  assert.deepEqual(saved.visibility, config.visibility);
  assert.equal(saved.show_mode, true);
  assert.equal(saved.tank_full_state, "on");
  assert.equal(config.humidifier_entity, undefined);
  editor.remove();
});
test("target commands respect native bounds and step, retain confirmed values, and block duplicate pending actions", async () => {
  const { card, calls } = setup(
    { humidity_step: 5 },
    { target_humidity_step: 2 },
  );
  assert.equal(card.content.querySelector("input").step, "6");
  card.content.querySelector('[aria-label="Increase target humidity"]').click();
  await tick();
  assert.deepEqual(calls[0], [
    "humidifier",
    "set_humidity",
    { humidity: 59, entity_id: "humidifier.test" },
  ]);
  assert.equal(card.content.querySelector("output").textContent, "50%");
  card.content.querySelector('[aria-label="Increase target humidity"]').click();
  assert.equal(calls.length, 1);
  updateDevice(card, "on", { humidity: 59 });
  assert.equal(card.pending.size, 0);
  assert.equal(card.content.querySelector("output").textContent, "59%");
  card.remove();
});
test("drag/keyboard previews send one command on commit; off devices preserve readings and disable targets", async () => {
  const { card, calls } = setup({}, { target_humidity_step: 5 });
  const input = card.content.querySelector("input");
  input.value = "60";
  input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(calls.length, 0);
  assert.equal(card.content.querySelector("output").textContent, "60%");
  input.dispatchEvent(new dom.window.Event("change"));
  await tick();
  assert.equal(calls[0][2].humidity, 60);
  updateDevice(card, "off", { humidity: 60 });
  assert.match(card.content.textContent, /62%/);
  assert.ok(card.content.querySelector("input").disabled);
  assert.equal(
    card.content.querySelector('[data-key="off"]').getAttribute("aria-pressed"),
    "true",
  );
  card.remove();
});
test("unsupported modes are omitted; supported labels and service values stay native", async () => {
  const unsupported = setup({}, { supported_features: 0 }).card;
  assert.deepEqual(
    [...unsupported.content.querySelectorAll(".dehumidifier-modes button")].map(
      (b) => b.textContent,
    ),
    ["Off", "On"],
  );
  unsupported.remove();
  const { card, calls } = setup();
  card.content.querySelector('[data-key="mode:Laundry"]').click();
  await tick();
  assert.deepEqual(calls[0], [
    "humidifier",
    "set_mode",
    { mode: "Laundry", entity_id: "humidifier.test" },
  ]);
  assert.equal(
    card.content
      .querySelector('[data-key="mode:Auto"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  updateDevice(card, "on", { mode: "Laundry" });
  assert.equal(
    card.content
      .querySelector('[data-key="mode:Laundry"]')
      .getAttribute("aria-pressed"),
    "true",
  );
  card.remove();
});
test("selecting a mode while off explicitly powers on and waits for backend mode/state confirmation", async () => {
  const { card, calls } = setup({}, {}, "off");
  card.content.querySelector('[data-key="mode:Laundry"]').click();
  await tick();
  assert.deepEqual(
    calls.map((c) => c[1]),
    ["turn_on", "set_mode"],
  );
  assert.equal(card.pending.size, 1);
  assert.equal(
    card.content.querySelector('[data-key="off"]').getAttribute("aria-pressed"),
    "true",
  );
  updateDevice(card, "on", { mode: "Laundry" });
  assert.equal(card.pending.size, 0);
  card.remove();
});
test("in-flight turn-on cancellation stops the mode follow-up after disconnect or reconfiguration", async () => {
  for (const cancel of [
    (card) => card.remove(),
    (card) => card.setConfig({ humidifier_entity: "humidifier.other" }),
  ]) {
    const { card, calls } = setup({}, {}, "off");
    let resolve;
    card.hass.callService = (...args) => {
      calls.push(args);
      return new Promise((r) => (resolve = r));
    };
    card.content.querySelector('[data-key="mode:Laundry"]').click();
    cancel(card);
    resolve();
    await tick();
    assert.equal(calls.length, 1);
    card.remove();
  }
});
test("backend errors and preview guards prevent unintended mode commands", async () => {
  const { card, calls } = setup({}, {}, "off");
  card.preview = true;
  await card.chooseMode("Laundry");
  assert.equal(calls.length, 0);
  card.preview = false;
  card.hass.callService = async (...args) => {
    calls.push(args);
    throw Error("Device rejected command");
  };
  await card.chooseMode("Laundry");
  assert.equal(calls.length, 1);
  assert.match(card.error.textContent, /Device rejected command/);
  assert.equal(card.requests.size, 0);
  card.remove();
});
test("independent sensors remain available offline, power is converted to whole watts, and tank unknown is explicit", () => {
  const { card } = setup({
    humidity_entity: "sensor.room",
    power_entity: "sensor.power",
    tank_full_entity: "binary_sensor.tank",
  });
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "sensor.room": { state: "60", attributes: { unit_of_measurement: "%" } },
      "sensor.power": {
        state: "0.2456",
        attributes: { unit_of_measurement: "kW" },
      },
      "binary_sensor.tank": { state: "unavailable", attributes: {} },
    },
  };
  updateDevice(card, "unavailable");
  assert.match(card.content.textContent, /60 %/);
  assert.match(card.content.textContent, /246 W/);
  assert.match(card.content.textContent, /Tank status unavailable/);
  assert.equal(card.content.querySelector("input"), null);
  assert.equal(card.content.querySelector(".dehumidifier-modes"), null);
  card.remove();
});
test("configured tank-full polarity produces a visible warning without inventing device action", () => {
  const { card } = setup(
    { tank_full_entity: "binary_sensor.tank", tank_full_state: "off" },
    { action: "idle" },
  );
  assert.match(card.content.textContent, /Idle/);
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "binary_sensor.tank": { state: "off", attributes: {} },
    },
  };
  assert.equal(card.content.querySelector(".summary").textContent, "Tank full");
  assert.match(
    card.content.querySelector('[role="alert"]').textContent,
    /Empty the water tank/,
  );
  updateDevice(card, "off");
  assert.equal(card.content.querySelector(".summary").textContent, "Off");
  assert.ok(card.content.querySelector('[role="alert"]'));
  card.remove();
});
test("fan select settings use the mapped entity, preserve disclosure/focus, and use the standard chevron", async () => {
  const { card, calls } = setup({ fan_entity: "select.speed" });
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "select.speed": {
        state: "High",
        attributes: { options: ["Low", "High"] },
      },
    },
  };
  const details = card.content.querySelector("details");
  assert.equal(details.open, false);
  assert.equal(
    details.querySelector(".settings-chevron").getAttribute("icon"),
    "mdi:chevron-down",
  );
  details.open = true;
  details.dispatchEvent(new dom.window.Event("toggle"));
  const select = details.querySelector("select");
  select.focus();
  updateDevice(card, "on", { current_humidity: 61 });
  assert.equal(card.content.querySelector("details"), details);
  assert.equal(details.open, true);
  assert.equal(card.shadowRoot.activeElement, select);
  select.value = "Low";
  select.dispatchEvent(new dom.window.Event("change"));
  await tick();
  assert.deepEqual(calls[0], [
    "select",
    "select_option",
    { option: "Low", entity_id: "select.speed" },
  ]);
  card.remove();
});
test("fan percentage control is capability gated and uses fan's native increment", async () => {
  const { card, calls } = setup({ fan_entity: "fan.speed" });
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "fan.speed": {
        state: "on",
        attributes: {
          supported_features: 1,
          percentage: 50,
          percentage_step: 25,
        },
      },
    },
  };
  const input = card.content.querySelector('input[aria-label="Fan speed"]');
  assert.equal(input.step, "25");
  input.value = "75";
  input.dispatchEvent(new dom.window.Event("change"));
  await tick();
  assert.deepEqual(calls[0], [
    "fan",
    "set_percentage",
    { percentage: 75, entity_id: "fan.speed" },
  ]);
  card.remove();
});
test("Greek UI, custom names and native modes update without service calls", () => {
  const { card, calls } = setup({ name: "My dry room" });
  card.hass = { ...card.hass, locale: { language: "el-GR" } };
  assert.match(card.content.textContent, /Επιθυμητή υγρασία/);
  assert.match(card.content.textContent, /Αφύγρανση/);
  assert.match(card.content.textContent, /My dry room/);
  assert.match(card.content.textContent, /Laundry/);
  assert.equal(calls.length, 0);
  card.remove();
});
test("missing targets are explicit, and incompatible entity/configuration values are rejected", () => {
  const { card } = setup({}, { humidity: null });
  assert.match(card.content.textContent, /Target humidity unavailable/);
  assert.equal(card.content.querySelector("input"), null);
  assert.throws(
    () => card.setConfig({ humidifier_entity: "climate.test" }),
    /compatible entity/,
  );
  assert.throws(() => card.setConfig({ humidity_step: 1.5 }), /whole number/);
  assert.throws(() => card.setConfig({ tank_full_state: "full" }), /On or Off/);
  card.remove();
});
