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
  assert.match(stub.shadowRoot.textContent, /Choose a sensor/);
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
  assert.ok(forms[0].schema.some((f) => f.name === "entity"));
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
