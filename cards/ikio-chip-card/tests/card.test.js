import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom;
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
});
after(() => dom.window.close());
function fixture(config = {}) {
  const card = document.createElement("ikio-chip-card");
  card.setConfig({ entity: "sensor.demo", ...config });
  card.hass = {
    states: {
      "sensor.demo": {
        entity_id: "sensor.demo",
        state: "871.44",
        attributes: {
          friendly_name: "Database size",
          icon: "mdi:database",
          unit_of_measurement: "MB",
        },
      },
    },
  };
  document.body.append(card);
  return card;
}
test("standalone card contains one shared chip with stacked labels, native icon and entity details", () => {
  const c = fixture();
  const chip = c.shadowRoot.querySelector(".ikio-sensor-chip");
  assert.equal(c.shadowRoot.querySelectorAll(".ikio-sensor-chip").length, 1);
  assert.equal(c.shadowRoot.querySelector("header"), null);
  assert.equal(
    chip.querySelector(".ikio-chip-name").textContent,
    "Database size",
  );
  assert.equal(chip.querySelector(".ikio-chip-value").textContent, "871.44 MB");
  assert.equal(
    chip.querySelector("ha-state-icon").stateObj,
    c.hass.states["sensor.demo"],
  );
  let entity;
  c.addEventListener("hass-more-info", (e) => (entity = e.detail.entityId));
  chip.click();
  assert.equal(entity, "sensor.demo");
  assert.ok(c.holds.has(chip), "hold binding must exist");
  c.remove();
  assert.equal(c.holds.size, 0);
});
test("name override, unavailable values, live native icons and appearance update safely", () => {
  const c = fixture({ name: "DB", appearance: { theme: "light" } });
  assert.equal(c.getAttribute("appearance"), "light");
  assert.equal(c.shadowRoot.querySelector(".ikio-chip-name").textContent, "DB");
  c.hass = {
    ...c.hass,
    states: {
      "sensor.demo": {
        entity_id: "sensor.demo",
        state: "unavailable",
        attributes: { icon: "mdi:alert" },
      },
    },
  };
  assert.equal(
    c.shadowRoot.querySelector(".ikio-chip-value").textContent,
    "unavailable",
  );
  assert.equal(
    c.shadowRoot.querySelector("ha-state-icon").stateObj.attributes.icon,
    "mdi:alert",
  );
  c.hass = { states: {} };
  assert.equal(
    c.shadowRoot.querySelector(".ikio-chip-value").textContent,
    "Entity not found",
  );
  c.remove();
});
test("visual editor supplies sensor/name/theme and preserves unrelated dashboard metadata", async () => {
  const Class = customElements.get("ikio-chip-card");
  const stub = document.createElement("ikio-chip-card");
  stub.setConfig(Class.getStubConfig());
  document.body.append(stub);
  assert.match(stub.shadowRoot.textContent, /Choose an entity/);
  stub.remove();
  const editor = await Class.getConfigElement();
  const config = {
    entity: "sensor.demo",
    grid_options: { columns: 3 },
    visibility: [{ condition: "user", users: ["demo"] }],
  };
  editor.setConfig(config);
  editor.hass = { states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const forms = editor.shadowRoot.querySelectorAll("ha-form");
  assert.ok(forms.length >= 2);
  assert.ok(
    [...forms].some((form) => form.schema.some((f) => f.name === "entity")),
  );
  assert.ok(forms[0].schema.some((f) => f.name === "name"));
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  forms[0].dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { entity: "sensor.demo", name: "DB" } },
    }),
  );
  assert.deepEqual(saved.visibility, config.visibility);
  assert.deepEqual(saved.grid_options, config.grid_options);
  editor.remove();
});

test("chip registers in the badge picker and reuses card configuration, styling and native details", async () => {
  const entry = window.customBadges.filter(
    (badge) => badge.type === "ikio-chip-badge",
  );
  assert.equal(entry.length, 1);
  assert.equal(entry[0].name, "Ikio Chip");
  assert.equal(entry[0].preview, true);
  const Class = customElements.get("ikio-chip-badge");
  assert.ok(Class);
  assert.deepEqual(
    Class.getStubConfig(),
    customElements.get("ikio-chip-card").getStubConfig(),
  );
  const badge = document.createElement("ikio-chip-badge");
  const config = {
    type: "custom:ikio-chip-badge",
    entity: "sensor.demo",
    name: "Database",
    appearance: { theme: "light" },
  };
  badge.setConfig(config);
  badge.hass = {
    states: {
      "sensor.demo": {
        entity_id: "sensor.demo",
        state: "42",
        attributes: { unit_of_measurement: "MB", icon: "mdi:database" },
      },
    },
  };
  document.body.append(badge);
  assert.equal(
    badge.shadowRoot.querySelectorAll(".ikio-sensor-chip").length,
    1,
  );
  assert.equal(
    badge.shadowRoot.querySelector(".ikio-chip-name").textContent,
    "Database",
  );
  assert.equal(
    badge.shadowRoot.querySelector(".ikio-chip-value").textContent,
    "42 MB",
  );
  assert.equal(badge.getAttribute("appearance"), "light");
  assert.equal(
    badge.shadowRoot.querySelector("ha-state-icon").stateObj,
    badge.hass.states["sensor.demo"],
  );
  let entity;
  badge.addEventListener("hass-more-info", (e) => (entity = e.detail.entityId));
  const chip = badge.shadowRoot.querySelector("button");
  assert.ok(badge.holds.has(chip));
  chip.click();
  assert.equal(entity, "sensor.demo");
  badge.hass = {
    states: {
      "sensor.demo": {
        entity_id: "sensor.demo",
        state: "unavailable",
        attributes: {},
      },
    },
  };
  assert.equal(
    badge.shadowRoot.querySelector(".ikio-chip-value").textContent,
    "unavailable",
  );
  const editor = await Class.getConfigElement();
  editor.setConfig(config);
  assert.equal(editor.config.type, "custom:ikio-chip-badge");
  badge.remove();
  assert.equal(badge.holds.size, 0);
});

test("compact default shows the name; editor settings restore stacked names and native icon fallback", async () => {
  const c = fixture();
  let chip = c.content.querySelector(".ikio-sensor-chip");
  assert.equal(c.config.show_name, true);
  assert.equal(chip.querySelector(".ikio-chip-name").hidden, false);
  assert.match(chip.getAttribute("aria-label"), /Database size: 871.44 MB/);
  assert(chip.classList.contains("ikio-chip-compact"));
  c.setConfig({
    entity: "sensor.demo",
    show_name: true,
    name: "DB",
    icon: "mdi:harddisk",
  });
  chip = c.content.querySelector(".ikio-sensor-chip");
  assert.equal(chip.querySelector(".ikio-chip-name").hidden, false);
  assert(chip.classList.contains("with-name"));
  assert.equal(chip.querySelector("ha-state-icon").icon, "mdi:harddisk");
  c.hass = {
    ...c.hass,
    states: {
      "sensor.demo": {
        ...c.hass.states["sensor.demo"],
        state: "0",
        attributes: {
          friendly_name: "New sensor name",
          icon: "mdi:database-check",
          unit_of_measurement: "MB",
        },
      },
    },
  };
  assert.equal(chip.querySelector("ha-state-icon").icon, "mdi:harddisk");
  c.setConfig({ entity: "sensor.demo", show_name: false, icon: "" });
  assert.equal(chip.querySelector("ha-state-icon").icon, undefined);
  assert.equal(
    chip.querySelector("ha-state-icon").stateObj.attributes.icon,
    "mdi:database-check",
  );
  assert.equal(chip.querySelector(".ikio-chip-value").textContent, "0 MB");
  assert.equal(chip.querySelector(".ikio-chip-name").hidden, true);
  c.remove();
});

test("show-name and icon settings are shared by badges and survive editor feedback and metadata", async () => {
  const Class = customElements.get("ikio-chip-card"),
    editor = await Class.getConfigElement();
  editor.setConfig({ entity: "sensor.demo", view_layout: { column: 2 } });
  editor.hass = { states: {}, locale: { language: "en" } };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const form = editor.shadowRoot.querySelector("ha-form");
  assert.equal(form.data.show_name, true);
  assert.deepEqual(
    [...editor.shadowRoot.querySelectorAll("ha-form")].find((f) =>
      f.schema.some((s) => s.name === "icon"),
    ).schema[0].selector,
    {
      icon: {},
    },
  );
  assert.deepEqual(
    [...editor.shadowRoot.querySelectorAll("ha-form")].find((f) =>
      f.schema.some((s) => s.name === "show_name"),
    ).schema[0].selector,
    {
      boolean: {},
    },
  );
  let saved;
  editor.addEventListener("config-changed", (e) => {
    saved = e.detail.config;
    editor.setConfig(saved);
  });
  for (const [name, value] of Object.entries({
    show_name: true,
    icon: "mdi:thermometer",
    name: "Room",
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
  assert.equal(editor.shadowRoot.querySelector("ha-form"), form);
  assert.deepEqual(saved.view_layout, { column: 2 });
  const badge = document.createElement("ikio-chip-badge");
  badge.setConfig(saved);
  badge.hass = {
    states: {
      "sensor.demo": {
        state: "21.5",
        attributes: { unit_of_measurement: "°C" },
      },
    },
  };
  document.body.append(badge);
  assert.equal(badge.content.querySelector(".ikio-chip-name").hidden, false);
  assert.equal(
    badge.content.querySelector("ha-state-icon").icon,
    "mdi:thermometer",
  );
  editor.remove();
  badge.remove();
});

test("malformed chip settings are rejected, hold emits once, and remapping details follows the current sensor", async () => {
  const c = fixture(),
    events = [];
  assert.throws(() =>
    c.setConfig({ entity: "sensor.demo", show_name: "false" }),
  );
  assert.throws(() => c.setConfig({ entity: "sensor.demo", icon: {} }));
  c.addEventListener("hass-more-info", (e) => events.push(e.detail.entityId));
  const chip = c.content.querySelector("button");
  chip.dispatchEvent(new dom.window.MouseEvent("pointerdown"));
  await new Promise((r) => setTimeout(r, 570));
  chip.click();
  assert.deepEqual(events, ["sensor.demo"]);
  c.setConfig({ entity: "sensor.other", show_name: true });
  c.content.querySelector("button").click();
  assert.deepEqual(events, ["sensor.demo", "sensor.other"]);
  c.remove();
});

test("Server Monitor uses the same compact shared renderer and name setting", async () => {
  const { sensorChip } = await import("@ikio/card-ui");
  const c = fixture(),
    chip = sensorChip(c, { entity: "sensor.demo" });
  assert.equal(chip.classList.contains("ikio-chip-compact"), true);
  assert.ok(chip.querySelector(".ikio-chip-surface"));
  assert.equal(chip.querySelector(".ikio-chip-name").hidden, false);
  const named = sensorChip(c, { entity: "sensor.demo", show_name: true });
  assert.equal(named.querySelector(".ikio-chip-name").hidden, false);
  assert.equal(
    chip.querySelector(".ikio-chip-name").textContent,
    "Database size",
  );
  c.remove();
});

test("people work in the chip card and badge with native state, icon and details", async () => {
  for (const type of ["ikio-chip-card", "ikio-chip-badge"]) {
    const card = document.createElement(type);
    card.setConfig({ entity: "person.demo", view_layout: { column: 2 } });
    const state = {
      entity_id: "person.demo",
      state: "home",
      attributes: { friendly_name: "Demo person", icon: "mdi:account" },
    };
    card.hass = { states: { "person.demo": state } };
    document.body.append(card);
    assert.equal(card.content.querySelector(".ikio-chip-name").hidden, false);
    assert.match(
      card.content.querySelector(".ikio-chip-value").textContent,
      /home/i,
    );
    assert.equal(card.content.querySelector("ha-state-icon").stateObj, state);
    let opened;
    card.addEventListener(
      "hass-more-info",
      (e) => (opened = e.detail.entityId),
    );
    card.content.querySelector("button").click();
    assert.equal(opened, "person.demo");
    card.hass = { states: { "person.demo": { ...state, state: "not_home" } } };
    assert.match(
      card.content.querySelector(".ikio-chip-value").textContent,
      /away|not.home/i,
    );
    const editor = await card.constructor.getConfigElement();
    editor.setConfig(card.config);
    document.body.append(editor);
    await new Promise((r) => setTimeout(r, 0));
    const selector = [...editor.shadowRoot.querySelectorAll("ha-form")].find(
      (f) => f.schema[0].name === "entity",
    ).schema[0].selector;
    assert(selector.entity.filter.domain.includes("person"));
    editor.remove();
    card.remove();
  }
});

test("switches are selectable in chips and badges, update live, and only open details", async () => {
  for (const type of ["ikio-chip-card", "ikio-chip-badge"]) {
    const card = document.createElement(type),
      calls = [];
    card.setConfig({ entity: "switch.demo_plug", view_layout: { column: 2 } });
    const state = {
      entity_id: "switch.demo_plug",
      state: "on",
      attributes: { friendly_name: "Demo plug", icon: "mdi:power-socket-eu" },
    };
    card.hass = {
      states: { "switch.demo_plug": state },
      callService: async (...args) => calls.push(args),
    };
    document.body.append(card);
    const value = () =>
      card.content.querySelector(".ikio-chip-value").textContent;
    assert.equal(value().toLowerCase(), "on");
    assert.equal(card.content.querySelector("ha-state-icon").stateObj, state);
    let opened;
    card.addEventListener(
      "hass-more-info",
      (e) => (opened = e.detail.entityId),
    );
    card.content.querySelector("button").click();
    assert.equal(opened, "switch.demo_plug");
    assert.deepEqual(calls, []);
    for (const next of ["off", "unavailable"]) {
      card.hass = {
        ...card.hass,
        states: { "switch.demo_plug": { ...state, state: next } },
      };
      assert.equal(value().toLowerCase(), next);
    }
    const editor = await card.constructor.getConfigElement();
    editor.setConfig(card.config);
    document.body.append(editor);
    await new Promise((r) => setTimeout(r, 0));
    const field = [...editor.shadowRoot.querySelectorAll("ha-form")].find(
      (f) => f.schema[0].name === "entity",
    );
    assert(field.schema[0].selector.entity.filter.domain.includes("switch"));
    assert.deepEqual(editor.config.view_layout, { column: 2 });
    editor.remove();
    card.remove();
  }
});
