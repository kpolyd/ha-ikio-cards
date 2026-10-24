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
  const Card = customElements.get("ikio-comfort-card");
  const card = document.createElement("ikio-comfort-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-comfort-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-comfort-card");
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

test("device selection sends no command and range targets keep the other bound", async () => {
  const card = document.createElement("ikio-comfort-card");
  document.body.append(card);
  card.setConfig({ climate_entity: "climate.ac", fan_entity: "fan.bedroom" });
  const calls = [];
  card.hass = {
    states: {
      "climate.ac": {
        entity_id: "climate.ac",
        state: "heat_cool",
        attributes: {
          supported_features: 2,
          hvac_modes: ["off", "heat_cool"],
          min_temp: 10,
          max_temp: 30,
          target_temp_low: 18,
          target_temp_high: 25,
          target_temp_step: 1,
        },
      },
      "fan.bedroom": {
        entity_id: "fan.bedroom",
        state: "off",
        attributes: { supported_features: 1, percentage: 0 },
      },
    },
    callService: async (...a) => calls.push(a),
  };
  const target = card.shadowRoot.querySelector("input");
  target.value = "19";
  target.dispatchEvent(new dom.window.Event("change"));
  await Promise.resolve();
  assert.equal(calls[0][2].target_temp_high, 25);
  assert.equal(calls[0][2].target_temp_low, 19);
  card.remove();
});
