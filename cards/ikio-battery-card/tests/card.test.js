import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom, Card, normalizeConfig;
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
  ({ normalizeConfig } = await import("../src/config.js"));
  await import("../src/index.js");
  Card = customElements.get("ikio-battery-card");
});
after(() => dom.window.close());
const state = (value, extra = {}) => ({
  entity_id: "sensor.test",
  state: String(value),
  attributes: { device_class: "battery", friendly_name: "Example", ...extra },
  last_updated: new Date().toISOString(),
});
function fixture(config = {}) {
  const card = new Card();
  card.setConfig(config);
  card.hass = {
    states: {
      "sensor.low": state(25, { battery_type: "2xAAA" }),
      "sensor.boundary": state(80),
      "sensor.high": state(81),
    },
    locale: { language: "en" },
  };
  document.body.append(card);
  return card;
}
test("defaults, threshold bounds, malformed ignored devices and dashboard metadata", () => {
  const c = normalizeConfig({
    view_layout: { column: 2 },
    appearance: { theme: "light" },
  });
  assert.equal(c.low_threshold, 25);
  assert.equal(c.collapse_threshold, 80);
  assert.deepEqual(c.ignored_devices, []);
  assert.deepEqual(c.view_layout, { column: 2 });
  assert.equal(c.appearance.theme, "light");
  for (const key of ["low_threshold", "collapse_threshold"])
    for (const value of [-1, 101, "25", NaN])
      assert.throws(() => normalizeConfig({ [key]: value }));
  for (const value of ["device", [null], [""]])
    assert.throws(() => normalizeConfig({ ignored_devices: value }));
});
test("80 stays visible, 81 is collapsed, expansion preserves sorting, focus, and ordinary state updates", () => {
  const c = fixture();
  assert.equal(c.content.querySelectorAll(".battery-row").length, 2);
  assert.match(
    c.content.querySelector(".battery-replace").textContent,
    /2 × AAA/,
  );
  const expand = c.content.querySelector(".battery-expand");
  expand.focus();
  expand.click();
  assert.equal(c.content.querySelectorAll(".battery-row").length, 3);
  assert.equal(c.shadowRoot.activeElement, expand);
  assert.equal(expand.getAttribute("aria-expanded"), "true");
  const original = c.content.querySelector(".battery-row");
  c.hass = {
    ...c.hass,
    states: {
      ...c.hass.states,
      "sensor.low": state(12, { battery_type: "2xAAA" }),
    },
  };
  assert.equal(c.expanded, true);
  assert.equal(c.content.querySelector(".battery-row"), original);
  expand.click();
  assert.equal(c.content.querySelectorAll(".battery-row").length, 2);
  c.remove();
});
test("new and removed discoveries update, unrelated updates retain existing DOM, registry changes refresh metadata", () => {
  const c = fixture(),
    before = c.content.querySelector(".battery-row");
  c.hass = {
    ...c.hass,
    states: {
      ...c.hass.states,
      "sensor.temperature": { state: "20", attributes: {} },
    },
  };
  assert.equal(c.content.querySelector(".battery-row"), before);
  c.hass = { ...c.hass, states: { ...c.hass.states, "sensor.new": state(0) } };
  assert.equal(c.content.querySelectorAll(".battery-row").length, 3);
  const states = { ...c.hass.states };
  delete states["sensor.new"];
  c.hass = { ...c.hass, states };
  assert.equal(c.content.querySelectorAll(".battery-row").length, 2);
  c.hass = {
    ...c.hass,
    entities: { "sensor.low": { device_id: "a" } },
    devices: { a: { name_by_user: "Door" } },
  };
  assert.equal(c.content.querySelector(".battery-name").textContent, "Door");
  c.setConfig({ ignored_devices: ["a"] });
  assert.equal(c.content.querySelector(".battery-replace"), null);
  c.remove();
});
test("native icons and tap/hold open one entity detail event without services or haptics", async () => {
  const c = fixture(),
    events = [],
    calls = [];
  c.hass.callService = (...args) => calls.push(args);
  c.addEventListener("hass-more-info", (e) => events.push(e.detail.entityId));
  const row = c.content.querySelector(".battery-row");
  assert.equal(
    row.querySelector("ha-state-icon").stateObj,
    c.hass.states["sensor.low"],
  );
  row.dispatchEvent(new dom.window.MouseEvent("pointerdown"));
  await new Promise((r) => setTimeout(r, 570));
  row.click();
  assert.deepEqual(events, ["sensor.low"]);
  assert.equal(calls.length, 0);
  c.remove();
  document.body.append(c);
  c.content.querySelector(".battery-row").click();
  assert.equal(events.length, 2);
  c.remove();
});
test("unavailable readings remain explicit, empty/all-collapsed states, and Greek labels", () => {
  const c = fixture({ collapse_threshold: 0 });
  assert.match(c.content.textContent, /All batteries are above 0%/);
  c.hass = {
    ...c.hass,
    states: { "sensor.low": state("unavailable") },
    locale: { language: "el-GR" },
  };
  assert.equal(c.content.querySelectorAll(".battery-row").length, 1);
  assert.match(
    c.content.querySelector(".battery-value").textContent,
    /Μη διαθέσιμο/,
  );
  assert.equal(c.content.querySelector(".battery-track"), null);
  c.hass = { ...c.hass, states: {} };
  assert.equal(c.content.querySelectorAll(".battery-row").length, 0);
  c.remove();
});
test("age refresh is stopped while hidden or disconnected, and resumes after reconnect", () => {
  const c = fixture();
  assert(c.ageTimer);
  c.visible = false;
  c.onVisibility();
  assert.equal(c.ageTimer._destroyed, true);
  c.visible = true;
  c.onVisibility();
  c.preview = true;
  assert.equal(c.ageTimer._destroyed, true);
  c.preview = false;
  const timer = c.ageTimer;
  c.remove();
  assert.equal(timer._destroyed, true);
  document.body.append(c);
  assert.notEqual(c.ageTimer, timer);
  c.remove();
});
test("editor exposes both defaults, native multi-device selection, and preserves metadata through feedback", async () => {
  const editor = await Card.getConfigElement();
  editor.setConfig({ view_layout: { column: 2 } });
  editor.hass = { states: {}, locale: { language: "en" } };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const form = editor.shadowRoot.querySelector("ha-form");
  assert.equal(form.data.low_threshold, 25);
  assert.equal(form.data.collapse_threshold, 80);
  assert.equal(
    [...editor.shadowRoot.querySelectorAll("ha-form")].find((f) =>
      f.schema.some((s) => s.name === "ignored_devices"),
    ).schema[0].selector.device.multiple,
    true,
  );
  let saved;
  editor.addEventListener("config-changed", (e) => {
    saved = e.detail.config;
    editor.setConfig(saved);
  });
  for (const [name, value] of Object.entries({
    low_threshold: 30,
    collapse_threshold: 90,
    ignored_devices: ["a"],
  })) {
    const control = [...editor.shadowRoot.querySelectorAll("ha-form")].find(
      (f) => f.schema[0].name === name,
    );
    control.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: { ...control.data, [name]: value } },
      }),
    );
  }
  assert.equal(saved.low_threshold, 30);
  assert.deepEqual(saved.ignored_devices, ["a"]);
  assert.deepEqual(saved.view_layout, { column: 2 });
  assert.equal(editor.shadowRoot.querySelector("ha-form"), form);
  editor.remove();
});
