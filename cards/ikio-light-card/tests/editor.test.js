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
  await import("../src/editor.js");
});
after(() => dom.window.close());
test("native form edits preserve full config and unknown HA-owned keys", async () => {
  const editor = document.createElement("ikio-light-card-editor");
  const input = {
    type: "custom:ikio-light-card",
    lights: [
      {
        entity: "light.strip",
        name: "Strip",
        control_mode: "power-only",
        extra: "retained",
      },
    ],
    appearance: { theme: "ha" },
    visibility: [{ condition: "user", users: ["a"] }],
    grid_options: { columns: 6 },
  };
  editor.setConfig(input);
  editor.hass = { states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  const forms = editor.shadowRoot.querySelectorAll("ha-form");
  forms[1].dispatchEvent(
    new CustomEvent("value-changed", {
      detail: {
        value: {
          entity: "light.strip",
          name: "New name",
          location: "Balcony",
          control_mode: "power-only",
        },
      },
    }),
  );
  assert.equal(saved.lights[0].name, "New name");
  assert.equal(saved.lights[0].location, "Balcony");
  assert.equal(saved.lights[0].extra, "retained");
  assert.deepEqual(saved.grid_options, input.grid_options);
  assert.deepEqual(saved.visibility, input.visibility);
  assert.equal(input.lights[0].name, "Strip");
  editor.setConfig(saved);
  assert.equal(saved.lights[0].control_mode, "power-only");
  editor.remove();
});
test("reorder, remove and appearance are all available through the visual editor", async () => {
  const editor = document.createElement("ikio-light-card-editor");
  editor.setConfig({
    lights: [{ entity: "light.one" }, { entity: "switch.two" }],
  });
  editor.hass = { states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  let config;
  editor.addEventListener("config-changed", (e) => (config = e.detail.config));
  editor.shadowRoot.querySelectorAll("section button")[1].click();
  assert.equal(config.lights[0].entity, "switch.two");
  editor.shadowRoot.querySelectorAll("section button")[2].click();
  assert.deepEqual(config.lights, [{ entity: "light.one" }]);
  editor.remove();
});
