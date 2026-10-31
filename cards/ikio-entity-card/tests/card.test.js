import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom, Card;
before(async () => {
  dom = new JSDOM("<body/>", { url: "http://localhost" });
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
  Card = customElements.get("ikio-entity-card");
});
after(() => dom.window.close());
function fixture(id = "light.demo", state = "on", attributes = {}) {
  const c = new Card(),
    calls = [];
  c.setConfig({ entity: id });
  c.hass = {
    states: {
      [id]: {
        entity_id: id,
        state,
        attributes: { friendly_name: "Demo", ...attributes },
      },
    },
    callService: async (...a) => calls.push(a),
  };
  document.body.append(c);
  return { c, calls };
}
test("native icons, light dot and brightness line follow reported capability and state", () => {
  const { c } = fixture("light.demo", "on", {
    supported_color_modes: ["rgb"],
    color_mode: "rgb",
    rgb_color: [100, 30, 210],
    brightness: 128,
    icon: "mdi:led-strip",
  });
  assert.equal(c.icon.stateObj, c.hass.states["light.demo"]);
  assert.equal(c.icon.icon, undefined);
  assert.equal(c.dot.hidden, false);
  assert.equal(c.level.hidden, false);
  assert.equal(c.actionIcon.hidden, true);
  assert.equal(
    c.control.style.getPropertyValue("--lamp-colour"),
    "rgb(100, 30, 210)",
  );
  const control = c.control;
  c.hass = {
    ...c.hass,
    states: { "light.demo": { ...c.hass.states["light.demo"], state: "off" } },
  };
  assert.equal(c.control, control);
  assert.equal(c.level.hidden, true);
  assert.equal(c.control.style.getPropertyValue("--lamp-colour"), "");
  c.remove();
});
test("switch/helper cards use power, never colour dots, and target the correct domain", async () => {
  for (const domain of ["switch", "input_boolean"]) {
    const { c, calls } = fixture(domain + ".demo", "off");
    assert(c.dot.hidden);
    assert.equal(c.actionIcon.getAttribute("icon"), "mdi:power");
    await c.activate();
    assert.deepEqual(calls, [
      [domain, "turn_on", { entity_id: domain + ".demo" }],
    ]);
    assert.equal(c.control.getAttribute("aria-pressed"), "false");
    assert(c.pending.size);
    c.hass = {
      ...c.hass,
      states: { [domain + ".demo"]: { state: "on", attributes: {} } },
    };
    assert.equal(c.pending.size, 0);
    c.remove();
  }
});
test("sensors use native formatted values and binary sensors are details-only without dots", async () => {
  for (const id of ["sensor.demo", "binary_sensor.demo"]) {
    const { c, calls } = fixture(id, id.startsWith("sensor.") ? "21.4" : "on", {
      unit_of_measurement: "°C",
    });
    c.hass = {
      ...c.hass,
      locale: { language: "el" },
      formatEntityState: () => (id.startsWith("sensor.") ? "21,4 °C" : "Open"),
    };
    assert.equal(
      c.value.textContent,
      id.startsWith("sensor.") ? "21,4 °C" : "Open",
    );
    assert(c.dot.hidden);
    assert(c.actionIcon.hidden);
    assert(c.level.hidden);
    let detail;
    c.addEventListener("hass-more-info", (e) => (detail = e.detail.entityId));
    await c.activate();
    assert.equal(detail, id);
    assert.equal(calls.length, 0);
    c.remove();
  }
});
test("buttons and input buttons press once, including their initial unknown state", async () => {
  for (const domain of ["button", "input_button"]) {
    const { c, calls } = fixture(domain + ".demo", "unknown");
    assert.equal(c.control.disabled, false);
    assert(c.dot.hidden);
    await c.activate();
    await c.activate();
    assert.deepEqual(calls, [
      [domain, "press", { entity_id: domain + ".demo" }],
    ]);
    assert.equal(c.control.getAttribute("aria-pressed"), null);
    c.remove();
  }
});
test("preview, unavailable and pending actions never send duplicate commands", async () => {
  for (const state of ["unknown", "unavailable"]) {
    const { c, calls } = fixture("switch.demo", state);
    assert(c.control.disabled);
    await c.activate();
    assert.equal(calls.length, 0);
    c.remove();
  }
  const { c, calls } = fixture("switch.demo", "on");
  c.preview = true;
  await c.activate();
  assert.equal(calls.length, 0);
  c.remove();
});
test("holds open native details without toggling and reconnect does not duplicate handlers", async () => {
  const { c, calls } = fixture("switch.demo", "on");
  let count = 0;
  c.addEventListener("hass-more-info", () => count++);
  c.control.dispatchEvent(new dom.window.MouseEvent("pointerdown"));
  await new Promise((r) => setTimeout(r, 570));
  c.control.click();
  assert.equal(count, 1);
  assert.equal(calls.length, 0);
  c.remove();
  document.body.append(c);
  c.more.click();
  assert.equal(count, 2);
  c.remove();
});
test("remapping ignores stale failures and preserves sizing and configuration metadata", async () => {
  const { c } = fixture("switch.demo", "on");
  let reject;
  c.hass.callService = () => new Promise((_, r) => (reject = r));
  const request = c.activate();
  c.setConfig({
    entity: "sensor.new",
    name: "Long custom name",
    icon: "mdi:home",
    grid_options: { columns: 6, rows: 2 },
    view_layout: { column: 2 },
  });
  reject(Error("stale"));
  await request;
  assert.equal(c.error.textContent, "");
  assert.equal(c.name.textContent, "Long custom name");
  assert.equal(c.icon.icon, "mdi:home");
  assert.deepEqual(c.config.grid_options, { columns: 6, rows: 2 });
  assert.equal(c.getGridOptions().rows, 1);
  c.remove();
});
test("configuration rejects unsupported types and the editor preserves metadata", async () => {
  const { c } = fixture();
  assert.throws(() => c.setConfig({ entity: "lock.demo" }));
  const editor = await Card.getConfigElement();
  editor.setConfig({ entity: "switch.demo", view_layout: { column: 2 } });
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  const f = [...editor.shadowRoot.querySelectorAll("ha-form")].find((f) =>
    f.schema.some((s) => s.name === "entity"),
  );
  assert(f.schema[0].selector.entity.filter.domain.includes("switch"));
  f.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...f.data, entity: "sensor.demo", name: "New" } },
    }),
  );
  assert.equal(saved.entity, "sensor.demo");
  assert.deepEqual(saved.view_layout, { column: 2 });
  editor.remove();
  c.remove();
});

test("people display HA states and open details without invoking a service", () => {
  const { c, calls } = fixture("person.demo", "home", {
    friendly_name: "Demo person",
    icon: "mdi:account",
  });
  assert.match(c.value.textContent, /home/i);
  assert.equal(c.dot.hidden, true);
  assert.equal(c.actionIcon.hidden, true);
  assert.equal(c.icon.stateObj, c.hass.states["person.demo"]);
  let opened;
  c.addEventListener("hass-more-info", (e) => (opened = e.detail.entityId));
  c.control.click();
  assert.equal(opened, "person.demo");
  assert.deepEqual(calls, []);
  c.hass = {
    ...c.hass,
    states: {
      "person.demo": {
        entity_id: "person.demo",
        state: "not_home",
        attributes: { friendly_name: "Demo person" },
      },
    },
  };
  assert.match(c.value.textContent, /away|not.home/i);
  c.remove();
});
