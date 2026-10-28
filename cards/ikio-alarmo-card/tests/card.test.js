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
  const Card = customElements.get("ikio-alarmo-card");
  const card = document.createElement("ikio-alarmo-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-alarmo-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-alarmo-card");
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

test("force-arm data preserves code and never implies skipping exit delay", async () => {
  const { forceData } = await import("../src/adapter.js");
  assert.deepEqual(forceData("alarm_control_panel.home", "away", "1234"), {
    entity_id: "alarm_control_panel.home",
    mode: "away",
    force: true,
    code: "1234",
  });
  assert.equal(
    "skip_delay" in forceData("alarm_control_panel.home", "home"),
    false,
  );
});

const panelId = "alarm_control_panel.home";
const sensorId = "binary_sensor.window";
const panel = (state, attributes = {}) => ({
  entity_id: panelId,
  state,
  attributes: { supported_features: 3, ...attributes },
});
function fixture(
  state = "disarmed",
  attributes = {},
  config = {},
  extraStates = {},
) {
  const card = document.createElement("ikio-alarmo-card");
  card.setConfig({
    entity: panelId,
    contacts: [{ entity: sensorId }],
    ...config,
  });
  const calls = [];
  card.hass = {
    states: {
      [panelId]: panel(state, attributes),
      [sensorId]: {
        entity_id: sensorId,
        state: "on",
        attributes: {
          friendly_name: "Kitchen window",
          icon: "mdi:window-open",
        },
      },
      ...extraStates,
    },
    services: { alarmo: { arm: {} } },
    callService: async (...args) => calls.push(args),
  };
  document.body.append(card);
  return { card, calls };
}
function press(card, key) {
  card.shadowRoot.querySelector(`[data-key="${key}"]`).click();
}
function transition(card, state, attributes = {}) {
  card.hass = {
    ...card.hass,
    states: { ...card.hass.states, [panelId]: panel(state, attributes) },
  };
}
function checkBypass(card) {
  const input = card.shadowRoot.querySelector("[type=checkbox]");
  input.checked = true;
  input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}
test("bypass defaults off and checkbox consent permits one-tap arming without extra confirmation", async () => {
  const { card, calls } = fixture();
  const checkbox = card.shadowRoot.querySelector("[type=checkbox]");
  assert.equal(checkbox.checked, false);
  const sensors = card.shadowRoot.querySelector(".security-sensors");
  assert.ok(sensors.firstElementChild.contains(checkbox));
  assert.ok(sensors.nextElementSibling.classList.contains("security-modes"));
  checkBypass(card);
  press(card, "mode-away");
  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(card.shadowRoot.querySelector("dialog"), null);
  assert.equal(card.shadowRoot.querySelector(".security-pin"), null);
  assert.equal(calls[0][0], "alarmo");
  assert.deepEqual(calls[0][2], {
    entity_id: panelId,
    mode: "away",
    force: true,
  });
  assert.equal(card.bypass, false);
  card.remove();
});
test("ordinary arming never forces sensors and required arming codes use inline keypad", async () => {
  const { card, calls } = fixture("disarmed", {
    code_arm_required: true,
    code_format: "number",
  });
  press(card, "mode-home");
  assert.equal(
    card.shadowRoot.querySelector("[data-key=submit-alarm]").disabled,
    true,
  );
  for (const digit of [1, 2, 3, 4]) press(card, `pin-${digit}`);
  press(card, "submit-alarm");
  await Promise.resolve();
  assert.equal(calls[0][0], "alarm_control_panel");
  assert.equal(calls[0][1], "alarm_arm_home");
  assert.equal(calls[0][2].code, "1234");
  assert.equal(calls[0][2].force, undefined);
  assert.equal(card.pin, "");
  card.remove();
});
test("armed bypass status shows chips with HA state icons, no presence, and persistent PIN pad", async () => {
  const { card, calls } = fixture(
    "armed_away",
    { code_format: "number", bypassed_sensors: [sensorId] },
    { persons: [{ entity: "person.example" }] },
    {
      "person.example": {
        state: "home",
        attributes: { friendly_name: "Hidden person" },
      },
    },
  );
  assert.match(card.shadowRoot.textContent, /1 sensor bypassed/);
  assert.doesNotMatch(card.shadowRoot.textContent, /Hidden person/);
  assert.equal(card.shadowRoot.querySelector("[type=checkbox]"), null);
  const glyph = card.shadowRoot.querySelector("ha-state-icon");
  assert.equal(glyph.stateObj, card.hass.states[sensorId]);
  assert.equal(glyph.hass, card.hass);
  assert.ok(card.shadowRoot.querySelector(".security-pin"));
  const submit = card.shadowRoot.querySelector("[data-key=submit-alarm]");
  assert.equal(submit.disabled, true);
  assert.equal(calls.length, 0);
  for (const digit of [4, 3, 2, 1]) press(card, `pin-${digit}`);
  press(card, "pin-Delete");
  press(card, "pin-1");
  press(card, "submit-alarm");
  await Promise.resolve();
  assert.equal(calls[0][1], "alarm_disarm");
  assert.equal(calls[0][2].code, "4321");
  assert.ok(
    card.shadowRoot.querySelector(".security-pin"),
    "keep pad until backend confirms disarming",
  );
  assert.equal(card.pin, "");
  transition(card, "disarmed");
  assert.equal(card.shadowRoot.querySelector(".security-pin"), null);
  card.remove();
});
test("bypass appears only for open sensors with Alarmo and resets when openings close", () => {
  const { card } = fixture();
  checkBypass(card);
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [sensorId]: { ...card.hass.states[sensorId], state: "off" },
    },
  };
  assert.equal(card.shadowRoot.querySelector("[type=checkbox]"), null);
  assert.equal(card.bypass, false);
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [sensorId]: { ...card.hass.states[sensorId], state: "unavailable" },
    },
  };
  assert.match(
    card.shadowRoot.querySelector(".security-sensor-summary").textContent,
    /unavailable/,
  );
  assert.equal(card.shadowRoot.querySelector("[type=checkbox]"), null);
  card.remove();
});
test("reported open sensors and active motion stay compact; sensor icon refreshes with state", () => {
  const motionId = "binary_sensor.motion";
  const { card } = fixture(
    "disarmed",
    { open_sensors: { [sensorId]: "Kitchen window" } },
    { motion: [{ entity: motionId }] },
    {
      [motionId]: {
        entity_id: motionId,
        state: "on",
        attributes: { icon: "mdi:motion-sensor" },
      },
    },
  );
  assert.match(
    card.shadowRoot.querySelector(".security-sensor-summary").textContent,
    /1 opening open.*1 motion active/,
  );
  assert.equal(
    card.shadowRoot.querySelectorAll(".security-chips button").length,
    2,
  );
  let id;
  card.addEventListener(
    "hass-more-info",
    (event) => (id = event.detail.entityId),
  );
  card.shadowRoot.querySelector(".security-chips button").click();
  assert.equal(id, sensorId);
  const previous = card.shadowRoot.querySelector("ha-state-icon");
  const changed = {
    ...card.hass.states[sensorId],
    attributes: { icon: "mdi:door-open" },
  };
  card.hass = {
    ...card.hass,
    states: { ...card.hass.states, [sensorId]: changed },
  };
  assert.equal(previous.stateObj, changed);
  card.remove();
});
test("state changes, visibility, configuration and disconnect clear PIN and bypass selection", () => {
  const { card } = fixture("armed_home", { code_format: "number" });
  press(card, "pin-1");
  transition(card, "triggered", { code_format: "number" });
  assert.equal(card.pin, "");
  assert.ok(card.shadowRoot.querySelector(".security-pin"));
  press(card, "pin-2");
  card.visible = false;
  card.onVisibility();
  assert.equal(card.pin, "");
  assert.equal(card.shadowRoot.querySelector("input[type=password]").value, "");
  card.visible = true;
  press(card, "pin-3");
  card.setConfig({ entity: panelId });
  assert.equal(card.pin, "");
  press(card, "pin-4");
  card.remove();
  assert.equal(card.pin, "");
  assert.equal(card.shadowRoot.querySelector("input[type=password]").value, "");
});
test("preview and unavailable alarm cannot issue services, and failures remain inline", async () => {
  const { card, calls } = fixture("armed_away", { code_format: "number" });
  card.preview = true;
  press(card, "pin-1");
  await card.disarm();
  assert.equal(calls.length, 0);
  card.preview = false;
  transition(card, "unavailable");
  assert.equal(card.shadowRoot.querySelector(".security-pin"), null);
  transition(card, "armed_away", { code_format: "number" });
  card.hass = {
    ...card.hass,
    callService: async () => {
      throw Error("Invalid code");
    },
  };
  press(card, "pin-1");
  await card.disarm();
  assert.match(card.error.textContent, /Invalid code/);
  assert.equal(card.pin, "");
  assert.ok(card.shadowRoot.querySelector(".security-pin"));
  card.remove();
});

async function alarmoFixture({
  area = "one",
  sensors = {},
  entities,
  attributes = {},
  states = {},
  failure,
} = {}) {
  const { card, calls } = fixture(
    "disarmed",
    attributes,
    { contacts: [], motion: [], confirm_arm: true },
    states,
  );
  const callbacks = {},
    unsubscribed = [];
  const connection = {
    subscribeEvents: async (callback, type) => {
      callbacks[type] = callback;
      return () => unsubscribed.push(type);
    },
    subscribeMessage: async (callback, message) => {
      callbacks[message.type] = callback;
      return () => unsubscribed.push(message.type);
    },
  };
  const requests = [];
  card.hass = {
    ...card.hass,
    connection,
    formatEntityName: () => "Opening",
    callWS: async (message) => {
      requests.push(message.type);
      if (failure) throw Error("No access");
      return message.type === "alarmo/entities"
        ? entities || [{ entity_id: panelId, area_id: area }]
        : sensors;
    },
  };
  card.visible = true;
  await card.loadAlarmo();
  await Promise.resolve();
  return { card, calls, callbacks, unsubscribed, requests };
}
test("Alarmo automatically supplies enabled area sensors, full names, icons and live states without card lists", async () => {
  const motionId = "binary_sensor.hall";
  const { card, requests, unsubscribed } = await alarmoFixture({
    sensors: {
      [sensorId]: { area: "one", enabled: true, type: "window" },
      [motionId]: { area: "one", enabled: true, type: "motion" },
      "binary_sensor.other": { area: "two", enabled: true, type: "window" },
      "binary_sensor.disabled": { area: "one", enabled: false, type: "window" },
    },
    states: {
      [motionId]: {
        entity_id: motionId,
        state: "on",
        attributes: { friendly_name: "Hall motion", icon: "mdi:motion-sensor" },
      },
    },
  });
  assert.equal(card.alarmoStatus, "ready");
  assert.deepEqual(
    card.sensorRows().map((r) => r.entity),
    [sensorId, motionId],
  );
  assert.ok(card.entityIds.includes(motionId));
  assert.match(
    card.shadowRoot.querySelector(".security-sensor-summary").textContent,
    /1 opening open.*1 motion active/,
  );
  const chips = card.shadowRoot.querySelectorAll(".security-chips button");
  assert.equal(chips[0].textContent, "Kitchen window");
  assert.equal(chips[1].textContent, "Hall motion");
  assert.equal(
    chips[0].querySelector("ha-state-icon").stateObj,
    card.hass.states[sensorId],
  );
  card.update();
  assert.deepEqual(requests, ["alarmo/entities", "alarmo/sensors"]);
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [sensorId]: { ...card.hass.states[sensorId], state: "off" },
      [motionId]: { ...card.hass.states[motionId], state: "off" },
    },
  };
  assert.match(
    card.shadowRoot.querySelector(".security-sensor-summary").textContent,
    /All monitored sensors clear/,
  );
  assert.equal(card.shadowRoot.querySelector("[type=checkbox]"), null);
  card.remove();
  assert.deepEqual(unsubscribed.sort(), [
    "alarmo_config_updated",
    "alarmo_failed_to_arm",
  ]);
});
test("master Alarmo discovers sensors across configured areas while excluding disabled and unrelated sensors", async () => {
  const { card } = await alarmoFixture({
    area: 0,
    entities: [
      { entity_id: panelId, area_id: 0 },
      { entity_id: "alarm_control_panel.a", area_id: "one" },
      { entity_id: "alarm_control_panel.b", area_id: "two" },
    ],
    sensors: {
      [sensorId]: { area: "one", type: "window", enabled: true },
      "binary_sensor.second": { area: "two", type: "motion", enabled: true },
      "binary_sensor.foreign": { area: "three", enabled: true },
      "binary_sensor.disabled": { area: "one", enabled: false },
    },
  });
  assert.deepEqual(
    card.sensorRows().map((r) => r.entity),
    [sensorId, "binary_sensor.second"],
  );
  card.remove();
});
test("Home/Away arms in one tap even for older configs with confirm_arm true; bypass is never implicit", async () => {
  const { card, calls } = fixture("disarmed", {}, { confirm_arm: true });
  await card.arm("away");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "alarm_arm_away");
  assert.equal(calls[0][2].force, undefined);
  assert.equal(card.shadowRoot.querySelector(".security-pin"), null);
  card.remove();
});
test("Alarmo rejection clears the pending timeout immediately and keeps failure feedback inline", async () => {
  const { card, callbacks, calls } = await alarmoFixture({
    sensors: { [sensorId]: { area: "one", enabled: true, type: "window" } },
  });
  await card.arm("home");
  assert.equal(calls.length, 1);
  assert.ok(card.pending.has(panelId));
  callbacks.alarmo_failed_to_arm({
    data: { entity_id: "alarm_control_panel.other", reason: "invalid_code" },
  });
  assert.ok(card.pending.has(panelId));
  callbacks.alarmo_failed_to_arm({
    data: { entity_id: panelId, reason: "open_sensors", sensors: [sensorId] },
  });
  assert.equal(card.pending.has(panelId), false);
  assert.match(card.error.textContent, /Cannot arm: sensors are open/);
  assert.equal(card.shadowRoot.querySelector("dialog"), null);
  checkBypass(card);
  await card.arm("home");
  assert.equal(calls[1][0], "alarmo");
  assert.equal(calls[1][2].force, true);
  callbacks.alarmo_failed_to_arm({
    data: { entity_id: panelId, reason: "invalid_code" },
  });
  assert.equal(card.pending.size, 0);
  assert.match(card.error.textContent, /Invalid or missing/);
  card.remove();
});
test("failed sensor discovery never shows a green all-clear or requests manual sensor setup", async () => {
  const { card } = await alarmoFixture({ failure: true });
  const summary = card.shadowRoot.querySelector(".security-sensor-summary");
  assert.match(summary.textContent, /Alarmo sensor list unavailable/);
  assert.equal(summary.classList.contains("clear"), false);
  assert.doesNotMatch(
    summary.textContent,
    /No sensors selected|All monitored sensors clear/,
  );
  card.remove();
});
test("fresh open_sensors failures are detected without events and closed sensors do not stay falsely open", async () => {
  const { card } = fixture("disarmed", {}, { contacts: [] });
  await card.arm("away");
  transition(card, "disarmed", { open_sensors: { [sensorId]: "on" } });
  assert.equal(card.pending.size, 0);
  assert.match(card.error.textContent, /Cannot arm/);
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [sensorId]: { ...card.hass.states[sensorId], state: "off" },
    },
  };
  assert.equal(card.shadowRoot.querySelector("[type=checkbox]"), null);
  assert.equal(
    card.shadowRoot.querySelectorAll(".security-chips button").length,
    0,
  );
  card.remove();
});

test("Alarmo configuration updates reload sensors and device names disambiguate generic Opening labels", async () => {
  const sensors = {
    [sensorId]: { area: "one", enabled: true, type: "window" },
  };
  const { card, callbacks, requests } = await alarmoFixture({ sensors });
  card.hass = {
    ...card.hass,
    entities: { [sensorId]: { device_id: "window_device" } },
    devices: { window_device: { name_by_user: "Kitchen window" } },
    states: {
      ...card.hass.states,
      [sensorId]: {
        ...card.hass.states[sensorId],
        attributes: { friendly_name: "Opening" },
      },
    },
  };
  assert.match(
    card.shadowRoot.querySelector(".security-chips").textContent,
    /Kitchen window Opening/,
  );
  sensors[sensorId].enabled = false;
  callbacks.alarmo_config_updated();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests.length, 4);
  assert.equal(card.sensorRows().length, 0);
  assert.match(
    card.shadowRoot.querySelector(".security-sensor-summary").textContent,
    /No sensors enabled in Alarmo/,
  );
  assert.equal(
    card.shadowRoot
      .querySelector(".security-sensor-summary")
      .classList.contains("clear"),
    false,
  );
  card.remove();
});
test("sensor loading ignores stale results after disconnect and removes late event subscriptions", async () => {
  const { card } = fixture("disarmed", {}, { contacts: [] });
  let resolveSensors, resolveEntities, resolveSubscription;
  let unsubscribed = 0;
  card.hass = {
    ...card.hass,
    connection: {
      subscribeEvents: () =>
        new Promise((resolve) => (resolveSubscription = resolve)),
    },
    callWS: (message) =>
      new Promise((resolve) => {
        if (message.type === "alarmo/entities") resolveEntities = resolve;
        else resolveSensors = resolve;
      }),
  };
  card.visible = true;
  const loading = card.loadAlarmo();
  card.remove();
  resolveEntities([{ entity_id: panelId, area_id: "one" }]);
  resolveSensors({
    [sensorId]: { area: "one", enabled: true, type: "window" },
  });
  resolveSubscription(() => unsubscribed++);
  await loading;
  await Promise.resolve();
  assert.equal(card.alarmoSensors.length, 0);
  assert.equal(unsubscribed, 1);
});

test("returning to a visible card retains discovery and updates sensors directly from HA", async () => {
  const { card, requests, callbacks } = await alarmoFixture({
    sensors: { [sensorId]: { area: "one", enabled: true, type: "window" } },
  });
  card.visible = false;
  card.onVisibility();
  assert.equal(card.alarmoRefresh, undefined);
  assert.equal(card.alarmoStatus, "ready");
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [sensorId]: { ...card.hass.states[sensorId], state: "off" },
    },
  };
  card.visible = true;
  card.onVisibility();
  await Promise.resolve();
  assert.equal(
    requests.length,
    2,
    "reuse discovery instead of blocking on another request",
  );
  assert.match(card.shadowRoot.textContent, /All monitored sensors clear/);
  assert.doesNotMatch(card.shadowRoot.textContent, /Loading Alarmo/);
  assert.ok(card.alarmoRefresh);
  callbacks.alarmo_config_updated();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests.length, 4, "configuration subscription is restored");
  card.remove();
});

test("discovery interrupted by hiding restarts immediately on return and ignores its late result", async () => {
  const { card } = fixture("disarmed", {}, { contacts: [] });
  let oldEntities, oldSensors;
  const connection = {};
  card.hass = {
    ...card.hass,
    connection,
    callWS: (message) =>
      new Promise((resolve) => {
        if (message.type === "alarmo/entities") oldEntities = resolve;
        else oldSensors = resolve;
      }),
  };
  card.visible = true;
  card.loadAlarmo();
  card.visible = false;
  card.onVisibility();
  let requests = 0;
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      requests++;
      return message.type === "alarmo/entities"
        ? [{ entity_id: panelId, area_id: "one" }]
        : { [sensorId]: { area: "one", type: "window" } };
    },
  };
  card.visible = true;
  card.onVisibility();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(requests, 2);
  assert.equal(card.alarmoStatus, "ready");
  oldEntities([]);
  oldSensors({});
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(
    card.sensorRows().map((r) => r.entity),
    [sensorId],
  );
  card.remove();
});

test("unanswered discovery times out, keeps controls usable and retries without a loading loop", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { card, calls } = fixture("disarmed", {}, { contacts: [] });
  let lateEntities;
  card.hass = {
    ...card.hass,
    connection: {},
    callWS: (message) =>
      new Promise((resolve) => {
        if (message.type === "alarmo/entities") lateEntities = resolve;
      }),
  };
  card.visible = true;
  const loading = card.loadAlarmo();
  t.mock.timers.tick(5000);
  await loading;
  assert.equal(card.alarmoLoading, false);
  assert.equal(card.alarmoStatus, "unavailable");
  assert.match(card.shadowRoot.textContent, /Alarmo sensor list unavailable/);
  assert.doesNotMatch(
    card.shadowRoot.textContent,
    /Loading Alarmo|All monitored sensors clear/,
  );
  await card.arm("home");
  assert.equal(calls.length, 1, "discovery never blocks arming");
  card.hass = {
    ...card.hass,
    callWS: async (message) =>
      message.type === "alarmo/entities"
        ? [{ entity_id: panelId, area_id: "one" }]
        : { [sensorId]: { area: "one", type: "window" } },
  };
  await card.loadAlarmo(true);
  lateEntities([]);
  await Promise.resolve();
  assert.equal(card.alarmoStatus, "ready");
  assert.deepEqual(
    card.sensorRows().map((r) => r.entity),
    [sensorId],
  );
  card.remove();
});

const settle = () => new Promise(setImmediate);
function countdownFixture(response) {
  const { card, calls } = fixture("arming", {
    delay: 30,
    code_format: "number",
  });
  const requests = [];
  card.hass = {
    ...card.hass,
    connection: {},
    callWS: async (message) => {
      requests.push(message);
      if (message.type === "alarmo/countdown") return response();
      return message.type === "alarmo/entities"
        ? [{ entity_id: panelId, area_id: "one" }]
        : { [sensorId]: { area: "one", enabled: true, type: "window" } };
    },
  };
  card.visible = true;
  card.update();
  return { card, calls, requests };
}

test("countdown uses backend remaining time, ticks locally, preserves PIN focus and awaits armed confirmation", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"] });
  const end = Date.now() + 18000;
  const { card, calls, requests } = countdownFixture(() => ({
    delay: 30,
    remaining: Math.max(0, (end - Date.now()) / 1000),
  }));
  await settle();
  assert.equal(
    card.shadowRoot.querySelector(".security-state").textContent,
    "Arming · 18 s",
  );
  const arc = card.shadowRoot.querySelector(".security-countdown-arc");
  assert.equal(arc.getAttribute("stroke-dasharray"), "60 100");
  assert.equal(arc.namespaceURI, "http://www.w3.org/2000/svg");
  assert.doesNotMatch(card.shadowRoot.textContent, /configured delay/);
  assert.ok(card.shadowRoot.querySelector(".security-delay"));
  assert.match(
    card.shadowRoot.querySelector(".security-sensor-summary").textContent,
    /1 opening open/,
  );
  const input = card.shadowRoot.querySelector("input[type=password]");
  input.focus();
  input.value = "12";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  t.mock.timers.tick(3000);
  assert.equal(
    card.shadowRoot.querySelector(".security-seconds").textContent,
    " · 15 s",
  );
  assert.equal(card.shadowRoot.querySelector(".security-countdown-arc"), arc);
  assert.equal(arc.getAttribute("stroke-dasharray"), "50 100");
  assert.equal(card.shadowRoot.activeElement, input);
  assert.equal(input.value, "12");
  assert.equal(requests.filter((r) => r.type === "alarmo/countdown").length, 1);
  t.mock.timers.tick(15000);
  await settle();
  assert.equal(
    card.shadowRoot.querySelector(".security-seconds").textContent,
    " · 0 s",
  );
  assert.equal(
    card.state().state,
    "arming",
    "timer expiry must not claim that the panel is armed",
  );
  assert.equal(calls.length, 0);
  transition(card, "armed_away", { code_format: "number" });
  assert.ok(card.shadowRoot.querySelector(".security-armed"));
  assert.equal(card.shadowRoot.querySelector(".security-seconds"), null);
  assert.equal(card.shadowRoot.querySelector("svg"), null);
  assert.equal(card.clock, undefined);
  assert.ok(card.shadowRoot.querySelector(".security-pin"));
  card.remove();
});

test("reopening during exit delay resynchronizes remaining time and entry delay gets a new countdown", async () => {
  let remaining = 18;
  const { card, requests } = countdownFixture(() => ({ delay: 30, remaining }));
  await settle();
  card.visible = false;
  card.onVisibility();
  assert.equal(card.clock, undefined);
  assert.equal(card.countdown, undefined);
  remaining = 7;
  card.visible = true;
  card.onVisibility();
  await settle();
  assert.equal(
    card.shadowRoot.querySelector(".security-seconds").textContent,
    " · 7 s",
  );
  assert.equal(requests.filter((r) => r.type === "alarmo/countdown").length, 2);
  remaining = 25;
  transition(card, "pending", { code_format: "number" });
  await settle();
  assert.equal(
    card.shadowRoot.querySelector(".security-state").textContent,
    "Entry delay · 25 s",
  );
  card.remove();
  assert.equal(card.clock, undefined);
});

test("countdown timeout and invalid responses never invent time and do not block disarming", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setInterval", "setTimeout"] });
  let resolveLate;
  let response = () =>
    new Promise((resolve) => {
      resolveLate = resolve;
    });
  const { card, calls } = countdownFixture(() => response());
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(card.countdownLoading, false);
  assert.equal(card.shadowRoot.querySelector(".security-seconds"), null);
  assert.equal(
    card.shadowRoot.querySelector(".security-state").textContent,
    "Arming",
  );
  response = () => ({ delay: "30", remaining: 29 });
  t.mock.timers.tick(15000);
  await settle();
  assert.equal(card.shadowRoot.querySelector(".security-seconds"), null);
  for (const digit of [1, 2, 3, 4]) press(card, `pin-${digit}`);
  await card.disarm();
  assert.equal(calls[0][1], "alarm_disarm");
  transition(card, "disarmed");
  resolveLate({ delay: 30, remaining: 30 });
  await settle();
  assert.equal(card.countdown, undefined);
  assert.equal(card.clock, undefined);
  assert.equal(card.shadowRoot.querySelector(".security-countdown"), null);
  card.remove();
});

test("sensor details collapse by default, toggle with the summary and retain live counts and bypass access", () => {
  const { card, calls } = fixture();
  const summary = card.shadowRoot.querySelector(
    "button.security-sensor-summary",
  );
  const chips = card.shadowRoot.querySelector(".security-chips");
  assert.equal(summary.getAttribute("aria-expanded"), "false");
  assert.equal(summary.getAttribute("aria-controls"), chips.id);
  assert.equal(chips.hidden, true);
  assert.match(summary.textContent, /1 opening open/);
  assert.ok(card.shadowRoot.querySelector("[type=checkbox]"));
  summary.focus();
  summary.click();
  assert.equal(chips.hidden, false);
  assert.equal(summary.getAttribute("aria-expanded"), "true");
  assert.equal(card.shadowRoot.activeElement, summary);
  assert.ok(chips.querySelector("ha-state-icon"));
  card.update();
  assert.equal(
    chips.hidden,
    false,
    "normal rendering must not collapse an expanded list",
  );
  assert.equal(calls.length, 0, "expanding is not an alarm command");
  summary.click();
  assert.equal(chips.hidden, true);
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [sensorId]: { ...card.hass.states[sensorId], state: "off" },
    },
  };
  assert.equal(
    card.shadowRoot.querySelector("button.security-sensor-summary"),
    null,
  );
  assert.match(
    card.shadowRoot.querySelector(".security-sensor-summary").textContent,
    /All monitored sensors clear/,
  );
  assert.equal(card.shadowRoot.querySelector(".security-chips"), null);
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [sensorId]: { ...card.hass.states[sensorId], state: "on" },
    },
  };
  assert.equal(card.shadowRoot.querySelector(".security-chips").hidden, true);
  card.remove();
});

test("armed bypass details are collapsible while their count and the PIN pad remain visible", () => {
  const { card } = fixture("armed_away", {
    bypassed_sensors: [sensorId],
    code_format: "number",
  });
  const summary = card.shadowRoot.querySelector(
    "button.security-sensor-summary",
  );
  assert.match(summary.textContent, /1 sensor bypassed/);
  assert.equal(card.shadowRoot.querySelector(".security-chips").hidden, true);
  assert.ok(card.shadowRoot.querySelector(".security-pin"));
  summary.click();
  assert.equal(card.shadowRoot.querySelector(".security-chips").hidden, false);
  card.setConfig({ entity: panelId, contacts: [{ entity: sensorId }] });
  assert.equal(card.shadowRoot.querySelector(".security-chips").hidden, true);
  card.remove();
});

test("alert chips group by HA entity area before device area and retain details and live regrouping", () => {
  const door = "binary_sensor.test_door";
  const motion = "binary_sensor.test_motion";
  const unassigned = "binary_sensor.test_unassigned";
  const closed = "binary_sensor.test_closed";
  const state = (entity_id, device_class, state = "on") => ({
    entity_id,
    state,
    attributes: { friendly_name: entity_id, device_class },
  });
  const { card, calls } = fixture(
    "disarmed",
    {},
    {
      contacts: [
        { entity: sensorId },
        { entity: door },
        { entity: unassigned },
        { entity: closed },
      ],
      motion: [{ entity: motion }],
    },
    {
      [door]: state(door, "door"),
      [motion]: state(motion, "motion"),
      [unassigned]: state(unassigned, "window"),
      [closed]: state(closed, "door", "off"),
    },
  );
  card.hass = {
    ...card.hass,
    entities: {
      [sensorId]: { area_id: "living", device_id: "window" },
      [door]: { device_id: "entry" },
      [motion]: { area_id: "living" },
      [unassigned]: { area_id: "missing" },
      [closed]: { area_id: "living" },
    },
    devices: { window: { area_id: "office" }, entry: { area_id: "living" } },
    areas: {
      living: { name: "Test living room" },
      office: { name: "Test office" },
    },
  };
  const groups = () => [
    ...card.shadowRoot.querySelectorAll(".security-sensor-area"),
  ];
  assert.deepEqual(
    groups().map((g) => g.querySelector("h3").textContent),
    ["Test living room", "Unassigned"],
  );
  assert.deepEqual(
    [...groups()[0].querySelectorAll("button")].map((b) => b.dataset.entity),
    [door, sensorId, motion],
  );
  assert.equal(
    card.shadowRoot.querySelector(`[data-entity="${closed}"]`),
    null,
  );
  press(card, "toggle-sensors");
  let detailEntity;
  card.addEventListener("hass-more-info", (e) => {
    detailEntity = e.detail.entityId;
  });
  groups()[0].querySelector("button").click();
  assert.equal(detailEntity, door);
  assert.deepEqual(calls, []);
  assert.equal(
    groups()[0].querySelector("ha-state-icon").stateObj,
    card.hass.states[door],
  );
  card.hass = {
    ...card.hass,
    entities: { ...card.hass.entities, [door]: { area_id: "office" } },
  };
  assert.equal(card.shadowRoot.querySelector(".security-chips").hidden, false);
  assert.equal(
    groups()
      .find((g) => g.getAttribute("aria-label") === "Test office")
      .querySelector("button").dataset.entity,
    door,
  );
  card.remove();
});

test("grouped alert chips keep exceptional statuses visible and never treat Alarmo areas as HA rooms", () => {
  const missing = "binary_sensor.test_missing";
  const { card } = fixture(
    "armed_away",
    { bypassed_sensors: [sensorId] },
    {
      contacts: [{ entity: sensorId }, { entity: missing }],
    },
  );
  card.alarmoSensors = [
    { entity: sensorId, kind: "opening", alarmo: { area: "living" } },
  ];
  card.hass = {
    ...card.hass,
    areas: { living: { name: "Not the sensor room" } },
  };
  assert.equal(
    card.shadowRoot.querySelector(".security-sensor-area h3").textContent,
    "Unassigned",
  );
  const chips = [...card.shadowRoot.querySelectorAll(".security-chips button")];
  assert.ok(chips.some((c) => c.textContent.includes("bypassed")));
  assert.ok(chips.some((c) => c.textContent.includes("unavailable")));
  card.remove();
});

test("activity is opt-in and searches bounded time windows for only the panel and monitored sensors", async () => {
  const { card } = fixture();
  card.visible = true;
  const requests = [];
  card.hass = {
    ...card.hass,
    callWS: async (msg) => {
      requests.push(msg);
      if (msg.type === "logbook/get_events") return [];
      throw Error("Not Alarmo");
    },
  };
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(
    requests.some((r) => r.type === "logbook/get_events"),
    false,
  );
  card.setConfig({ ...card.config, show_activity: true, activity_hours: 6 });
  await new Promise((r) => setTimeout(r, 0));
  const request = requests.find((r) => r.type === "logbook/get_events");
  assert.deepEqual(request.entity_ids.sort(), [panelId, sensorId].sort());
  assert.equal(
    Date.parse(request.end_time) - Date.parse(request.start_time),
    5 * 60000,
  );
  const activityRequests = requests.filter(
    (r) => r.type === "logbook/get_events",
  );
  assert.ok(
    activityRequests.every(
      (r) =>
        Date.parse(r.start_time) >= Date.parse(request.end_time) - 6 * 3600000,
    ),
  );
  assert.ok(
    Date.parse(activityRequests.at(-1).start_time) <=
      Date.parse(request.end_time) - 6 * 3600000 + 1000,
  );
  assert.match(
    card.shadowRoot.querySelector(".security-activity").textContent,
    /No recorded activity/,
  );
  assert.equal(
    card.shadowRoot.querySelector(".security-activity summary"),
    null,
  );
  card.setConfig({ ...card.config, show_activity: false });
  assert.equal(card.shadowRoot.querySelector(".security-activity"), null);
  assert.equal(card.activity.timer, undefined);
  card.remove();
});

test("activity renders recorded order, historical states, user avatars and icon fallbacks", async () => {
  const { card } = fixture();
  card.visible = true;
  const now = Date.now() / 1000;
  card.hass = {
    ...card.hass,
    user: { id: "operator", name: "Test operator", is_admin: true },
    config: { time_zone: "Europe/Athens" },
    entities: { [sensorId]: { area_id: "test" } },
    areas: { test: { name: "Test room" } },
    states: {
      ...card.hass.states,
      "person.operator": {
        entity_id: "person.operator",
        state: "home",
        attributes: {
          user_id: "operator",
          friendly_name: "Person",
          entity_picture: "/api/image/serve/test/128x128",
        },
      },
    },
    callWS: async (msg) => {
      if (msg.type === "config/auth/list")
        return [
          { id: "operator", name: "Test operator" },
          { id: "other", name: "Other user" },
        ];
      if (msg.type !== "logbook/get_events") throw Error("Not Alarmo");
      return [
        { entity_id: sensorId, state: "off", when: now - 30 },
        {
          entity_id: panelId,
          state: "disarmed",
          context_user_id: "operator",
          when: now - 5,
        },
        {
          entity_id: panelId,
          state: "armed_away",
          context_user_id: "other",
          when: now - 50,
        },
        { entity_id: "binary_sensor.unrelated", state: "on", when: now - 1 },
      ];
    },
  };
  card.setConfig({ ...card.config, show_activity: true });
  await new Promise((r) => setTimeout(r, 0));
  const section = card.shadowRoot.querySelector(".security-activity");
  const rows = [...section.querySelectorAll(".security-activity-row")];
  assert.equal(rows.length, 3);
  assert.match(rows[0].textContent, /Disarmed/);
  assert.match(rows[0].textContent, /Test operator/);
  assert.match(rows[1].textContent, /Closed/);
  assert.match(rows[1].textContent, /Test room/);
  assert.equal(rows[1].querySelector("ha-state-icon").stateObj.state, "off");
  assert.equal(
    rows[0].querySelector("img").getAttribute("src"),
    "/api/image/serve/test/128x128",
  );
  assert.ok(rows[2].querySelector(".security-activity-actor ha-icon"));
  rows[0].querySelector("img").dispatchEvent(new dom.window.Event("error"));
  assert.ok(rows[0].querySelector(".security-activity-actor ha-icon"));
  assert.equal(rows[1].querySelector(".security-activity-actor"), null);
  let opened;
  card.addEventListener("hass-more-info", (e) => (opened = e.detail.entityId));
  rows[1].click();
  assert.equal(opened, sensorId);
  card.remove();
  assert.equal(card.activity.timer, undefined);
});

test("activity failures are explicit and late responses cannot repopulate a disabled card", async () => {
  const { card } = fixture();
  card.visible = true;
  let resolve;
  card.hass = {
    ...card.hass,
    callWS: (msg) =>
      msg.type === "logbook/get_events"
        ? new Promise((r) => (resolve = r))
        : Promise.reject(Error("Not Alarmo")),
  };
  card.setConfig({ ...card.config, show_activity: true });
  card.setConfig({ ...card.config, show_activity: false });
  resolve([{ entity_id: sensorId, state: "on", when: Date.now() / 1000 }]);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(card.activity.entries, []);
  assert.equal(card.shadowRoot.querySelector(".security-activity"), null);
  card.hass = {
    ...card.hass,
    callWS: async () => {
      throw Error("Denied");
    },
  };
  card.setConfig({ ...card.config, show_activity: true });
  await new Promise((r) => setTimeout(r, 0));
  assert.match(
    card.shadowRoot.querySelector(".security-activity").textContent,
    /Activity unavailable/,
  );
  card.remove();
});

test("activity adds twenty entries at a time, using cached window results before fetching older windows", async () => {
  const { card } = fixture();
  card.visible = true;
  const now = Date.now() / 1000;
  const events = Array.from({ length: 55 }, (_, i) => ({
    entity_id: sensorId,
    state: i % 2 ? "on" : "off",
    when: now - i - 1,
    context_id: `demo-${i}`,
  }));
  const requests = [];
  card.hass = {
    ...card.hass,
    callWS: async (msg) => {
      if (msg.type !== "logbook/get_events") throw Error("Not Alarmo");
      requests.push(msg);
      return events.filter(
        (e) =>
          e.when * 1000 >= Date.parse(msg.start_time) &&
          e.when * 1000 <= Date.parse(msg.end_time),
      );
    },
  };
  card.setConfig({ ...card.config, show_activity: true });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(card.activity.entries.length, 20);
  assert.equal(
    requests.length,
    1,
    "initial request must not fetch the full history window",
  );
  const viewport = card.shadowRoot.querySelector(".security-activity-scroll");
  assert.equal(viewport.tabIndex, 0);
  Object.defineProperties(viewport, {
    clientHeight: { value: 288, configurable: true },
    scrollHeight: { get: () => 1200, configurable: true },
  });
  viewport.scrollTop = 200;
  viewport.dispatchEvent(new dom.window.Event("scroll"));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(
    card.activity.entries.length,
    20,
    "scrolling away from bottom must not load",
  );
  viewport.scrollTop = 900;
  viewport.dispatchEvent(new dom.window.Event("scroll"));
  viewport.dispatchEvent(new dom.window.Event("scroll"));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(card.activity.entries.length, 40);
  assert.equal(
    requests.length,
    1,
    "next twenty can come from the current window buffer",
  );
  await card.activity.run("more");
  assert.equal(card.activity.entries.length, 55);
  assert.equal(
    new Set(card.activity.entries.map((e) => e.context_id)).size,
    55,
  );
  assert.ok(
    requests.length > 1,
    "older time windows are fetched only when needed",
  );
  assert.equal(card.activity.hasMore(), false);
  assert.equal(
    viewport,
    card.shadowRoot.querySelector(".security-activity-scroll"),
    "preserve actual scroll element across updates",
  );
  card.remove();
});

test("activity window boundaries are deduplicated and sparse history is searched back to the configured limit", async () => {
  const { card } = fixture();
  card.visible = true;
  const now = Date.now() / 1000;
  const events = [
    { entity_id: sensorId, state: "on", when: now - 300 },
    { entity_id: sensorId, state: "off", when: now - 5400 },
  ];
  const ranges = [];
  card.hass = {
    ...card.hass,
    callWS: async (msg) => {
      if (msg.type !== "logbook/get_events") throw Error("Not Alarmo");
      ranges.push([Date.parse(msg.start_time), Date.parse(msg.end_time)]);
      return events.filter(
        (e) =>
          e.when * 1000 >= Date.parse(msg.start_time) &&
          e.when * 1000 <= Date.parse(msg.end_time),
      );
    },
  };
  card.setConfig({ ...card.config, show_activity: true, activity_hours: 2 });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(card.activity.entries.length, 2);
  for (let i = 1; i < ranges.length; i++)
    assert.equal(ranges[i][1], ranges[i - 1][0]);
  assert.equal(card.activity.hasMore(), false);
  const count = ranges.length;
  await card.activity.run("more");
  assert.equal(ranges.length, count);
  card.remove();
});

test("activity refresh queries only new time and preserves a scrolled reader and loaded history", async () => {
  const { card } = fixture();
  card.visible = true;
  const now = Date.now() / 1000;
  let fresh = false;
  const events = Array.from({ length: 30 }, (_, i) => ({
    entity_id: sensorId,
    state: i % 2 ? "on" : "off",
    when: now - i - 10,
    context_id: String(i),
  }));
  const requests = [];
  card.hass = {
    ...card.hass,
    callWS: async (msg) => {
      if (msg.type !== "logbook/get_events") throw Error("Not Alarmo");
      requests.push(msg);
      const data = fresh
        ? [
            {
              entity_id: panelId,
              state: "disarmed",
              when: Date.parse(msg.end_time) / 1000,
              context_id: "new",
            },
            ...events,
          ]
        : events;
      return data.filter(
        (e) =>
          e.when * 1000 >= Date.parse(msg.start_time) &&
          e.when * 1000 <= Date.parse(msg.end_time),
      );
    },
  };
  card.setConfig({ ...card.config, show_activity: true });
  await new Promise((r) => setTimeout(r, 0));
  const viewport = card.shadowRoot.querySelector(".security-activity-scroll");
  viewport.scrollTop = 170;
  viewport.getBoundingClientRect = () => ({ top: 0 });
  const anchor = viewport.querySelector(".security-activity-row");
  anchor.getBoundingClientRect = () => ({
    top: -20 + (card.activity.entries.length > 20 ? 48 : 0),
    bottom: 28 + (card.activity.entries.length > 20 ? 48 : 0),
  });
  const anchorKey = anchor.dataset.key;
  const restoreScroll = card.activity.afterRender.bind(card.activity);
  card.activity.afterRender = () => {
    const current = [
      ...viewport.querySelectorAll(".security-activity-row"),
    ].find((row) => row.dataset.key === anchorKey);
    if (current) current.getBoundingClientRect = anchor.getBoundingClientRect;
    restoreScroll();
  };
  const oldEnd = card.activity.liveEnd;
  fresh = true;
  await card.activity.run("refresh");
  assert.equal(Date.parse(requests.at(-1).start_time), oldEnd);
  assert.equal(card.activity.entries.length, 21);
  assert.equal(
    viewport.scrollTop,
    218,
    "new rows above the reader must be compensated by their height",
  );
  assert.equal(card.activity.entries[0].context_id, "new");
  card.visible = false;
  card.onVisibility();
  const count = card.activity.entries.length;
  card.visible = true;
  card.onVisibility();
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(
    card.activity.entries.length >= count,
    "visibility resume must retain loaded history",
  );
  card.remove();
});

async function liveActivityFixture({ reject = false, pending = false } = {}) {
  const { card } = fixture();
  card.visible = true;
  const listeners = new Map(),
    subscriptions = [],
    requests = [];
  const connection = {
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type, callback) => {
      if (listeners.get(type) === callback) listeners.delete(type);
    },
    subscribeMessage: (callback, message, options) => {
      if (message.type !== "logbook/event_stream")
        return Promise.resolve(() => {});
      const sub = { callback, message, options, closed: false };
      subscriptions.push(sub);
      if (reject) return Promise.reject(Error("Unsupported stream"));
      const unsubscribe = () => {
        sub.closed = true;
      };
      if (pending)
        return new Promise((resolve) => {
          sub.resolve = () => resolve(unsubscribe);
        });
      return Promise.resolve(unsubscribe);
    },
  };
  const now = Date.now() / 1000;
  card.hass = {
    ...card.hass,
    connection,
    callWS: async (message) => {
      requests.push(message);
      if (message.type !== "logbook/get_events") throw Error("Not Alarmo");
      return Array.from({ length: 20 }, (_, i) => ({
        entity_id: sensorId,
        state: i % 2 ? "on" : "off",
        when: now - i - 10,
        context_id: `recorded-${i}`,
      })).filter(
        (entry) =>
          entry.when * 1000 >= Date.parse(message.start_time) &&
          entry.when * 1000 <= Date.parse(message.end_time),
      );
    },
  };
  card.setConfig({ ...card.config, show_activity: true });
  await new Promise((r) => setTimeout(r, 0));
  return { card, listeners, subscriptions, requests };
}

test("live activity filters subscriptions, batches events and avoids periodic history queries while connected", async () => {
  const { card, subscriptions, requests } = await liveActivityFixture();
  assert.equal(subscriptions.length, 1);
  assert.deepEqual(
    subscriptions[0].message.entity_ids.sort(),
    [panelId, sensorId].sort(),
  );
  assert.equal(
    subscriptions[0].message.end_time,
    undefined,
    "subscription must remain live",
  );
  assert.deepEqual(subscriptions[0].options, { resubscribe: false });
  assert.equal(card.activity.liveState, "active");
  const before = requests.filter((r) => r.type === "logbook/get_events").length;
  await card.activity.tick();
  assert.equal(
    requests.filter((r) => r.type === "logbook/get_events").length,
    before,
  );
  const viewport = card.shadowRoot.querySelector(".security-activity-scroll");
  viewport.scrollTop = 120;
  const originalUpdate = card.update.bind(card);
  let renders = 0;
  card.update = () => {
    renders++;
    originalUpdate();
  };
  const entry = {
    entity_id: sensorId,
    state: "on",
    when: Date.now() / 1000,
    context_id: "live",
  };
  const callback = subscriptions[0].callback;
  callback({
    events: [
      entry,
      entry,
      { ...entry, entity_id: "binary_sensor.unrelated" },
      { ...entry, when: "invalid" },
    ],
  });
  callback({ events: [entry] });
  assert.equal(card.activity.entries.length, 20, "live rendering is coalesced");
  card.activity.flushLive();
  assert.equal(card.activity.entries.length, 21);
  assert.equal(
    viewport.scrollTop,
    120,
    "live updates retain the reader position",
  );
  assert.equal(renders, 1, "multiple incoming messages render once per batch");
  assert.equal(card.activity.entries[0].context_id, "live");
  assert.equal(
    card.shadowRoot.querySelectorAll(".security-activity-row").length,
    21,
  );
  callback({ events: [entry] });
  card.activity.flushLive();
  assert.equal(card.activity.entries.length, 21);
  assert.equal(renders, 1, "duplicate-only replay must not redraw the card");
  card.remove();
  await Promise.resolve();
  assert.equal(subscriptions[0].closed, true);
});

test("activity reconnects with overlap and deduplication, removing listeners and ignoring stale callbacks", async () => {
  const { card, listeners, subscriptions } = await liveActivityFixture();
  const entry = {
    entity_id: panelId,
    state: "armed_away",
    when: Date.now() / 1000,
    context_id: "before-reconnect",
  };
  subscriptions[0].callback({ events: [entry] });
  card.activity.flushLive();
  const watermark = card.activity.liveEnd;
  listeners.get("disconnected")();
  await Promise.resolve();
  assert.equal(subscriptions[0].closed, true);
  listeners.get("ready")();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(subscriptions.length, 2);
  assert.equal(
    Date.parse(subscriptions[1].message.start_time),
    watermark - 2000,
  );
  subscriptions[0].callback({ events: [{ ...entry, context_id: "stale" }] });
  subscriptions[1].callback({
    events: [
      entry,
      {
        ...entry,
        state: "disarmed",
        context_id: "after-reconnect",
        when: entry.when + 0.001,
      },
    ],
  });
  card.activity.flushLive();
  assert.equal(
    card.activity.entries.filter((e) => e.context_id === "before-reconnect")
      .length,
    1,
  );
  assert.equal(
    card.activity.entries.some((e) => e.context_id === "after-reconnect"),
    true,
  );
  assert.equal(
    card.activity.entries.some((e) => e.context_id === "stale"),
    false,
  );
  card.remove();
  await Promise.resolve();
  assert.equal(listeners.size, 0);
  assert.equal(subscriptions[1].closed, true);
});

test("hidden activity closes its stream, resumes without losing history and disabled activity stays stopped", async () => {
  const { card, listeners, subscriptions } = await liveActivityFixture();
  const count = card.activity.entries.length;
  card.visible = false;
  card.onVisibility();
  await Promise.resolve();
  assert.equal(subscriptions[0].closed, true);
  assert.equal(listeners.size, 0);
  assert.equal(card.activity.timer, undefined);
  assert.equal(card.activity.liveFlushTimer, undefined);
  card.visible = true;
  card.onVisibility();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(subscriptions.length, 2);
  assert.equal(card.activity.entries.length, count);
  card.setConfig({ ...card.config, show_activity: false });
  await Promise.resolve();
  assert.equal(subscriptions[1].closed, true);
  assert.equal(listeners.size, 0);
  const total = subscriptions.length;
  card.update();
  assert.equal(subscriptions.length, total);
  card.remove();
});

test("rejected live streams use polling while a late subscription acknowledgement is safely closed", async () => {
  const fallback = await liveActivityFixture({ reject: true });
  assert.equal(fallback.card.activity.liveState, "fallback");
  const before = fallback.requests.filter(
    (r) => r.type === "logbook/get_events",
  ).length;
  await fallback.card.activity.tick();
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(
    fallback.requests.filter((r) => r.type === "logbook/get_events").length >
      before,
  );
  fallback.card.remove();
  const late = await liveActivityFixture({ pending: true });
  late.card.remove();
  late.subscriptions[0].resolve();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(late.subscriptions[0].closed, true);
  assert.equal(late.card.activity.liveState, "idle");
});
