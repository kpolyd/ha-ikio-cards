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
  const Card = customElements.get("ikio-vacuum-card");
  const card = document.createElement("ikio-vacuum-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-vacuum-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-vacuum-card");
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
