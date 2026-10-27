import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom;
const cards = [
  "electricity",
  "climate",
  "appliances",
  "media",
  "vacuum",
  "alarmo",
  "camera",
  "server-monitor",
  "vehicle",
  "graph",
  "lights",
];
before(async () => {
  dom = new JSDOM("<body></body>");
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  // Editable form substitute: exercise host feedback and real DOM focus without
  // claiming to run Home Assistant's Lit selectors in jsdom.
  customElements.define(
    "ha-form",
    class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: "open" });
        this.input = document.createElement("input");
        this.shadowRoot.append(this.input);
        this.input.addEventListener("input", () => {
          const key =
            this.schema.length === 1 && this.schema[0].name === "entity"
              ? "entity"
              : "name";
          this.data = { ...this.data, [key]: this.input.value };
          this.dispatchEvent(
            new CustomEvent("value-changed", { detail: { value: this.data } }),
          );
        });
      }
    },
  );
  for (const card of cards)
    await import(`../../../cards/ikio-${card}-card/src/editor.js`);
});
after(() => dom.window.close());
for (const card of cards)
  test(`${card}: typing survives synchronous HA config feedback`, async () => {
    const editor = document.createElement(`ikio-${card}-card-editor`);
    const config = {
      type: `custom:ikio-${card}-card`,
      name: "",
      appearance: { theme: "dark" },
      circuits: [{ power_entity: "sensor.office", name: "" }],
      lights: [{ entity: "light.office", name: "" }],
      visibility: [{ condition: "user", users: ["a"] }],
    };
    editor.setConfig(config);
    document.body.append(editor);
    await new Promise((resolve) => setTimeout(resolve, 0));
    let saved;
    editor.addEventListener("config-changed", (event) => {
      saved = structuredClone(event.detail.config);
      editor.setConfig(saved);
    });
    const forms = editor.shadowRoot.querySelectorAll("ha-form");
    const form = forms[card === "electricity" || card === "lights" ? 1 : 0];
    const input = form.input;
    input.focus();
    const entered = card === "vacuum" ? "vacuum.office" : "Office lamp";
    for (const character of entered) {
      input.value += character;
      input.dispatchEvent(new dom.window.Event("input"));
      assert.equal(
        editor.shadowRoot.activeElement,
        form,
        "editing must retain focus",
      );
      assert.equal(form.shadowRoot.activeElement, input);
      assert.equal(form.isConnected, true);
    }
    assert.equal(
      card === "electricity"
        ? saved.circuits[0].name
        : card === "lights"
          ? saved.lights[0].name
          : card === "vacuum"
            ? saved.entity
            : saved.name,
      entered,
    );
    assert.deepEqual(saved.visibility, config.visibility);
    // A real outside edit must still replace stale values.
    const key = card === "vacuum" ? "entity" : "name";
    const external = card === "vacuum" ? "vacuum.external" : "External change";
    editor.setConfig({ ...saved, [key]: external });
    assert.equal(editor.config[key], external);
    assert.notEqual(editor.shadowRoot.querySelector("ha-form"), forms[0]);
    editor.remove();
  });
