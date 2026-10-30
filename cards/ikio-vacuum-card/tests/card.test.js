import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom;
before(async () => {
  dom = new JSDOM("<body></body>", {
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
});
after(() => dom.window.close());
test("card registers and safely renders an empty visual-editor stub", () => {
  const Card = customElements.get("ikio-vacuum-card");
  const card = document.createElement("ikio-vacuum-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-vacuum-card"));
  card.remove();
});
test("editor exposes vacuum and appearance while preserving HA metadata", async () => {
  const Card = customElements.get("ikio-vacuum-card");
  const editor = await Card.getConfigElement();
  const config = {
    ...Card.getStubConfig(),
    entity: "vacuum.robot",
    name: "Old name",
    appearance: { theme: "light" },
    battery_entity: "sensor.battery",
    status_entity: "sensor.status",
    missions: [{ entity: "script.clean" }],
    maintenance: [{ entity: "sensor.brush" }],
    grid_options: { columns: 6 },
    visibility: [{ condition: "user", users: ["owner"] }],
  };
  editor.setConfig(config);
  editor.hass = { states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const forms = editor.shadowRoot.querySelectorAll("ha-form");
  assert.equal(forms.length, 2);
  assert.deepEqual(
    forms[0].schema.map((f) => f.name),
    ["entity"],
  );
  assert.equal(forms[0].schema[0].required, true);
  assert.equal(forms[0].data.name, undefined);
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  forms[0].dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...forms[0].data, entity: "vacuum.second" } },
    }),
  );
  assert.equal(saved.entity, "vacuum.second");
  assert.deepEqual(saved.appearance, { theme: "light" });
  assert.equal(forms[1].data.theme, "light");
  forms[1].dispatchEvent(
    new CustomEvent("value-changed", { detail: { value: { theme: "ha" } } }),
  );
  assert.deepEqual(saved.appearance, { theme: "ha" });
  for (const key of [
    "name",
    "battery_entity",
    "status_entity",
    "missions",
    "maintenance",
  ])
    assert.equal(Object.hasOwn(saved, key), false);
  assert.deepEqual(saved.grid_options, config.grid_options);
  assert.deepEqual(saved.visibility, config.visibility);
  assert.equal(config.name, "Old name");
  editor.setConfig(saved);
  assert.equal(
    editor.shadowRoot.querySelector("ha-form").data.entity,
    "vacuum.second",
  );
  editor.hass = { states: {}, locale: { language: "el" } };
  assert.equal(
    editor.shadowRoot
      .querySelector(".field-label")
      .textContent.replace(" *", ""),
    "Σκούπα",
  );
  editor.remove();
});

test("vacuum primary action follows actual status and supported capabilities", async () => {
  const { primary } = await import("../src/adapter.js");
  const s = (state, flags) => ({
    state,
    attributes: { supported_features: flags },
  });
  assert.equal(primary(s("docked", 8192)).service, "start");
  assert.equal(primary(s("cleaning", 4)).service, "pause");
  assert.equal(primary(s("paused", 8192)).label, "Resume");
  assert.equal(primary(s("returning", 8192)), null);
  assert.equal(primary(s("unavailable", 8192)), null);
  assert.equal(primary(s("cleaning", 8)).service, "stop");
});
test("suction selector shows the value and status changes replace the primary icon", async () => {
  const card = document.createElement("ikio-vacuum-card");
  document.body.append(card);
  card.setConfig({ entity: "vacuum.robot" });
  const states = (state) => ({
    "vacuum.robot": {
      entity_id: "vacuum.robot",
      state,
      attributes: {
        friendly_name: "Robot",
        supported_features: 8192 | 4 | 16 | 32,
        fan_speed_list: ["Quiet", "Turbo"],
        fan_speed: "Quiet",
        battery_level: 86,
      },
    },
  });
  const calls = [];
  card.hass = {
    states: states("docked"),
    callService: async (...a) => calls.push(a),
  };
  assert.equal(card.shadowRoot.querySelector("select").value, "Quiet");
  assert.equal(
    card.shadowRoot.querySelector('[aria-label="Start cleaning"]') !== null,
    true,
  );
  card.hass = { ...card.hass, states: states("cleaning") };
  card.shadowRoot.querySelector('[aria-label="Pause"]').click();
  await Promise.resolve();
  assert.equal(calls[0][1], "pause");
  card.remove();
});

function mounted(state = "docked", attributes = {}, config = {}) {
  const card = document.createElement("ikio-vacuum-card");
  card.setConfig({ entity: "vacuum.robot", ...config });
  card.hass = {
    locale: { language: "en" },
    states: {
      "vacuum.robot": {
        entity_id: "vacuum.robot",
        state,
        attributes: {
          friendly_name: "Robot",
          icon: "mdi:robot-vacuum",
          supported_features: 8192 | 4 | 16 | 32,
          fan_speed_list: ["Quiet", "Turbo"],
          fan_speed: "Quiet",
          battery_level: 86,
          ...attributes,
        },
      },
    },
    callService: async () => {},
  };
  document.body.append(card);
  return card;
}
function change(card, state, attributes = {}) {
  const old = card.hass.states["vacuum.robot"];
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "vacuum.robot": {
        ...old,
        state,
        attributes: { ...old.attributes, ...attributes },
      },
    },
  };
}

test("entity name/icon replace retired overrides and preserve appearance without mutating input", () => {
  const config = {
    name: "Old override",
    appearance: { theme: "light" },
    battery_entity: "sensor.old",
    missions: [{ entity: "script.old" }],
    maintenance: [{ entity: "sensor.old" }],
    grid_options: { columns: 6 },
  };
  const card = mounted("cleaning", {}, config);
  assert.equal(card.getAttribute("appearance"), "light");
  assert.equal(card.content.querySelector(".vacuum-name").textContent, "Robot");
  const icon = card.content.querySelector("ha-state-icon");
  assert.equal(icon.stateObj.attributes.icon, "mdi:robot-vacuum");
  assert.equal(icon.hass, card.hass);
  assert.equal(card.content.querySelector("details"), null);
  assert.equal(card.config.name, undefined);
  assert.equal(config.name, "Old override");
  assert.deepEqual(card.config.grid_options, { columns: 6 });
  let entity;
  card.addEventListener("hass-more-info", (e) => (entity = e.detail.entityId));
  card.content.querySelector(".vacuum-name").click();
  assert.equal(entity, "vacuum.robot");
  card.remove();
});

test("appearance defaults to Ikio dark and supports the collection themes", () => {
  const card = mounted("docked");
  assert.equal(card.getAttribute("appearance"), "dark");
  for (const theme of ["light", "ha", "dark"]) {
    card.setConfig({ entity: "vacuum.robot", appearance: { theme } });
    assert.equal(card.getAttribute("appearance"), theme);
  }
  assert.throws(
    () =>
      card.setConfig({
        entity: "vacuum.robot",
        appearance: { theme: "invalid" },
      }),
    /Unsupported appearance/,
  );
  card.remove();
});

test("battery preserves zero, hides invalid/missing attributes and marks unavailable data unknown", () => {
  const card = mounted("docked", { battery_level: 0 });
  assert.equal(card.content.querySelector(".vacuum-battery").textContent, "0%");
  for (const value of [undefined, null, "86", NaN, Infinity, -1, 101]) {
    change(card, "docked", { battery_level: value });
    assert.equal(card.content.querySelector(".vacuum-battery"), null);
  }
  change(card, "unavailable", { battery_level: 86 });
  assert.equal(card.content.querySelector(".vacuum-battery").textContent, "—");
  card.remove();
});

test("start/pause feedback and animation follow backend confirmation, visibility and lifecycle", async () => {
  const card = mounted();
  const calls = [];
  card.hass = {
    ...card.hass,
    callService: async (...args) => calls.push(args),
  };
  card.content.querySelector(".vacuum-primary").click();
  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "start");
  assert.equal(card.hasAttribute("vacuum-motion"), false);
  assert.equal(card.content.querySelector(".vacuum-primary").disabled, true);
  assert.match(card.content.textContent, /Updating device/);
  change(card, "cleaning");
  assert.equal(card.hasAttribute("vacuum-motion"), true);
  assert.equal(card.pending.size, 0);
  card.content.querySelector(".vacuum-primary").click();
  await Promise.resolve();
  assert.equal(calls[1][1], "pause");
  assert.equal(card.hasAttribute("vacuum-motion"), true);
  change(card, "paused");
  assert.equal(card.hasAttribute("vacuum-motion"), false);
  assert.match(
    card.content.querySelector(".vacuum-primary").textContent,
    /Resume/,
  );
  change(card, "cleaning");
  card.visible = false;
  card.onVisibility();
  assert.equal(card.hasAttribute("vacuum-motion"), false);
  card.visible = true;
  card.onVisibility();
  assert.equal(card.hasAttribute("vacuum-motion"), true);
  card.preview = true;
  assert.equal(card.hasAttribute("vacuum-motion"), false);
  card.preview = false;
  card.remove();
  assert.equal(card.hasAttribute("vacuum-motion"), false);
  assert.equal(card.pending.size, 0);
});

test("failures retain confirmed state and expose errors; capability and offline guards remain", async () => {
  const card = mounted("cleaning");
  card.hass = {
    ...card.hass,
    callService: async () => {
      throw Error("Device refused pause");
    },
  };
  await card.send(
    "vacuum.robot",
    "vacuum",
    "pause",
    {},
    (s) => s?.state === "paused",
  );
  assert.equal(card.error.textContent, "Device refused pause");
  assert.equal(card.hasAttribute("vacuum-motion"), true);
  change(card, "error", { error: "Main brush jammed" });
  assert.equal(
    card.content.querySelector('[role="alert"]').textContent,
    "Main brush jammed",
  );
  assert.match(card.content.textContent, /Needs attention/);
  assert.equal(card.content.querySelector(".vacuum-primary"), null);
  change(card, "returning");
  assert.equal(card.content.querySelector(".vacuum-primary"), null);
  assert.equal(card.content.querySelector(".vacuum-dock"), null);
  change(card, "unavailable");
  assert.ok(
    [...card.content.querySelectorAll("button.ae-button,select")].every(
      (node) => node.disabled,
    ),
  );
  change(card, "cleaning", { supported_features: 8 });
  assert.equal(
    card.content.querySelector(".vacuum-primary").getAttribute("aria-label"),
    "Stop",
  );
  assert.equal(card.content.querySelector("select"), null);
  card.remove();
});

test("suction preserves an unlisted backend value, focus and restored value on blur", async () => {
  const card = mounted("docked", { fan_speed: "Custom" });
  const select = card.content.querySelector("select");
  assert.equal(select.value, "Custom");
  select.focus();
  change(card, "docked", { fan_speed: "Turbo" });
  assert.equal(card.content.querySelector("select"), select);
  assert.equal(select.value, "Custom");
  select.dispatchEvent(new dom.window.Event("blur"));
  assert.equal(select.value, "Turbo");
  const calls = [];
  card.hass = {
    ...card.hass,
    callService: async (...args) => calls.push(args),
  };
  select.value = "Quiet";
  select.dispatchEvent(new dom.window.Event("change"));
  await Promise.resolve();
  assert.equal(calls[0][1], "set_fan_speed");
  assert.deepEqual(calls[0][2], {
    fan_speed: "Quiet",
    entity_id: "vacuum.robot",
  });
  change(card, "docked", { fan_speed: "Quiet" });
  assert.equal(card.pending.size, 0);
  card.remove();
});

test("card rejects incompatible entities and non-object configuration", () => {
  const card = document.createElement("ikio-vacuum-card");
  for (const config of [null, [], { entity: "light.test" }])
    assert.throws(() => card.setConfig(config));
});

test("missing suction value stays explicitly unknown instead of selecting a mode", () => {
  const card = mounted("docked", { fan_speed: undefined });
  const input = card.content.querySelector("select");
  assert.equal(input.value, "");
  assert.equal(input.selectedOptions[0].textContent, "Unknown");
  assert.equal(input.selectedOptions[0].disabled, true);
  card.remove();
});
