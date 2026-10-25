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
  const Card = customElements.get("ikio-security-card");
  const card = document.createElement("ikio-security-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-security-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-security-card");
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
  const card = document.createElement("ikio-security-card");
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
