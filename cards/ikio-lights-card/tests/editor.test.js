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
  const editor = document.createElement("ikio-lights-card-editor");
  const input = {
    type: "custom:ikio-lights-card",
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
  [...editor.shadowRoot.querySelectorAll("ha-form")]
    .find((f) => f.schema.some((s) => s.name === "entity"))
    .dispatchEvent(
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
  for (const [name, value] of Object.entries({
    name: "New name",
    location: "Balcony",
  })) {
    const control = [
      ...editor.shadowRoot.querySelectorAll("details ha-form"),
    ].find((f) => f.schema[0].name === name);
    control.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: { ...control.data, [name]: value } },
      }),
    );
  }
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
  const editor = document.createElement("ikio-lights-card-editor");
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

test("grouping is a native boolean selector and preserves names, rows and HA metadata through feedback", async () => {
  const editor = document.createElement("ikio-lights-card-editor");
  editor.setConfig({
    name: "Lights",
    lights: [{ entity: "light.strip", name: "Strip" }],
    grid_options: { columns: 6 },
  });
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const form = [...editor.shadowRoot.querySelectorAll("ha-form")].find((f) =>
    f.schema.some((s) => s.name === "group_by_location"),
  );
  assert.deepEqual(
    form.schema.find((field) => field.name === "group_by_location").selector,
    { boolean: {} },
  );
  assert.equal(form.data.group_by_location, false);
  let saved;
  editor.addEventListener("config-changed", (event) => {
    saved = event.detail.config;
    editor.setConfig(saved);
  });
  form.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...form.data, group_by_location: true } },
    }),
  );
  assert.equal(saved.group_by_location, true);
  assert.equal(saved.lights[0].name, "Strip");
  assert.deepEqual(saved.grid_options, { columns: 6 });
  assert.equal(
    [...editor.shadowRoot.querySelectorAll("ha-form")].find((f) =>
      f.schema.some((s) => s.name === "group_by_location"),
    ),
    form,
  );
  editor.remove();
});
