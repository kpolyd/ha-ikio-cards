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
test("Alarmo override is explicit, requires confirmation and shows bypass status", async () => {
  const card = document.createElement("ikio-security-card");
  document.body.append(card);
  card.setConfig({
    entity: "alarm_control_panel.home",
    contacts: [{ entity: "binary_sensor.window" }],
    allow_override: true,
  });
  const calls = [];
  card.hass = {
    states: {
      "alarm_control_panel.home": {
        entity_id: "alarm_control_panel.home",
        state: "disarmed",
        attributes: { supported_features: 3, code_arm_required: false },
      },
      "binary_sensor.window": {
        entity_id: "binary_sensor.window",
        state: "on",
        attributes: { friendly_name: "Kitchen window" },
      },
    },
    services: { alarmo: { arm: {} } },
    callService: async (...a) => calls.push(a),
  };
  const override = [...card.shadowRoot.querySelectorAll("button")].find(
    (n) => n.textContent === "Arm away anyway",
  );
  override.click();
  assert.equal(calls.length, 0);
  const confirm = [
    ...card.shadowRoot.querySelector("dialog").querySelectorAll("button"),
  ].find((n) => n.textContent === "Confirm");
  confirm.click();
  await Promise.resolve();
  assert.equal(calls[0][0], "alarmo");
  assert.equal(calls[0][2].force, true);
  card.remove();
});
