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
  const Card = customElements.get("ikio-appliance-card");
  const card = document.createElement("ikio-appliance-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-appliance-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-appliance-card");
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

test("timed run calls the selected backend script instead of scheduling browser shutoff", async () => {
  const card = document.createElement("ikio-appliance-card");
  document.body.append(card);
  card.setConfig({
    entity: "switch.heater",
    timed_runs: [{ label: "30 minutes", start_script: "script.heater_run" }],
  });
  const calls = [];
  card.hass = {
    states: {
      "switch.heater": { entity_id: "switch.heater", state: "off" },
      "script.heater_run": { entity_id: "script.heater_run", state: "off" },
    },
    callService: async (...a) => calls.push(a),
  };
  [...card.shadowRoot.querySelectorAll("button")]
    .find((n) => n.textContent === "30 minutes")
    .click();
  await Promise.resolve();
  assert.deepEqual(calls[0], [
    "script",
    "turn_on",
    { entity_id: "script.heater_run" },
  ]);
  card.remove();
});
