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
    const form = [...forms].find(
      (f) => f.schema[0].name === (card === "vacuum" ? "entity" : "name"),
    );
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
    assert.equal(card === "vacuum" ? saved.entity : saved.name, entered);
    assert.deepEqual(saved.visibility, config.visibility);
    // A real outside edit must still replace stale values.
    const key = card === "vacuum" ? "entity" : "name";
    const external = card === "vacuum" ? "vacuum.external" : "External change";
    editor.setConfig({ ...saved, [key]: external });
    assert.equal(editor.config[key], external);
    assert.notEqual(editor.shadowRoot.querySelector("ha-form"), forms[0]);
    editor.remove();
  });

test("editing a main field does not restore stale repeatable-list values", async () => {
  const editor = document.createElement("ikio-appliances-card-editor");
  editor.setConfig({
    name: "Appliance",
    timed_runs: [{ label: "Old", start_script: "script.example" }],
    view_layout: { column: 2 },
  });
  editor.hass = { states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const forms = [...editor.shadowRoot.querySelectorAll("ha-form")],
    main = forms[0],
    row = forms.find((f) => f.schema.some((s) => s.name === "label"));
  assert(row);
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  row.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...row.data, label: "New" } },
    }),
  );
  assert.equal(saved.timed_runs[0].label, "New");
  main.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...main.data, name: "Renamed" } },
    }),
  );
  assert.equal(saved.name, "Renamed");
  assert.equal(saved.timed_runs[0].label, "New");
  assert.deepEqual(saved.view_layout, { column: 2 });
  editor.remove();
});

test("the shared layout, mandatory markers and list disclosures preserve edits and metadata", async () => {
  const editor = document.createElement("ikio-server-monitor-card-editor");
  editor.setConfig({
    extra_readings: [{ entity: "sensor.old", name: "Original", opaque: 42 }],
    view_layout: { column: 2 },
  });
  editor.hass = { states: {}, locale: { language: "en" } };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(
    [...editor.shadowRoot.children]
      .filter((n) => n.tagName === "SECTION")
      .map((s) => s.querySelector("h3").textContent),
    ["General", "Card settings", "Appearance"],
  );
  const field = (name) =>
    [...editor.shadowRoot.querySelectorAll("ha-form")].find(
      (f) => f.schema[0].name === name,
    );
  const entity = field("entity"),
    label = entity.parentElement.querySelector(".field-label");
  assert.match(label.textContent, /Sensor \*/);
  assert.equal(entity.getAttribute("aria-required"), "true");
  assert.equal(entity.getAttribute("aria-labelledby"), label.id);
  assert.equal(
    field("ip_address_entity").parentElement.querySelector(".required"),
    null,
  );
  let saved;
  editor.addEventListener("config-changed", (e) => {
    saved = e.detail.config;
    editor.setConfig(saved);
  });
  entity.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...entity.data, entity: "" } },
    }),
  );
  assert.equal(
    entity.parentElement.querySelector(".field-error").hidden,
    false,
  );
  entity.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...entity.data, entity: "sensor.new" } },
    }),
  );
  assert.equal(entity.parentElement.querySelector(".field-error").hidden, true);
  const list = editor.shadowRoot.querySelector(
    '[data-key="list:extra_readings"]',
  );
  assert.equal(list.open, false);
  list.open = true;
  [...list.children].find((n) => n.tagName === "BUTTON").click();
  assert.equal(saved.extra_readings.length, 2);
  const added = editor.shadowRoot.querySelector(
    '[data-key="list:extra_readings:1"]',
  );
  assert.equal(added.open, true);
  assert.equal(editor.shadowRoot.activeElement, added.querySelector("summary"));
  assert.equal(saved.extra_readings[0].entity, "sensor.new");
  assert.equal(saved.extra_readings[0].opaque, 42);
  assert.deepEqual(saved.view_layout, { column: 2 });
  editor.remove();
});

test("Router declarative sections react to connection type without losing hidden readings", async () => {
  await import("../../../cards/ikio-router-card/src/editor.js");
  const editor = document.createElement("ikio-router-card-editor");
  editor.setConfig({
    connection_type: "generic",
    rsrp_entity: "sensor.signal",
    view_layout: { column: 2 },
  });
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const control = () =>
    [...editor.shadowRoot.querySelectorAll("ha-form")].find(
      (f) => f.schema[0].name === "connection_type",
    );
  assert.equal(
    [...editor.shadowRoot.querySelectorAll("ha-form")].some(
      (f) => f.schema[0].name === "rsrp_entity",
    ),
    false,
  );
  control().dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { connection_type: "cellular" } },
    }),
  );
  assert.equal(
    [...editor.shadowRoot.querySelectorAll("ha-form")].some(
      (f) => f.schema[0].name === "rsrp_entity",
    ),
    true,
  );
  control().dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { connection_type: "ethernet" } },
    }),
  );
  assert.equal(editor.config.rsrp_entity, "sensor.signal");
  assert.deepEqual(editor.config.view_layout, { column: 2 });
  editor.remove();
});

test("embedded chip editors default names on while retaining an explicit off setting", async () => {
  await import("../../../cards/ikio-router-card/src/editor.js");
  for (const type of ["server-monitor", "router"]) {
    const editor = document.createElement(`ikio-${type}-card-editor`);
    editor.setConfig({
      extra_readings: [{ entity: "sensor.demo" }],
      view_layout: { column: 2 },
    });
    document.body.append(editor);
    await new Promise((r) => setTimeout(r, 0));
    const field = () =>
      [...editor.shadowRoot.querySelectorAll("ha-form")].find(
        (f) => f.schema[0].name === "show_name",
      );
    assert.equal(field().data.show_name, true, type);
    let saved;
    editor.addEventListener("config-changed", (e) => {
      saved = e.detail.config;
      editor.setConfig(saved);
    });
    field().dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: { ...field().data, show_name: false } },
      }),
    );
    assert.equal(saved.extra_readings[0].show_name, false);
    assert.deepEqual(saved.view_layout, { column: 2 });
    editor.setConfig({ ...saved, name: "Renamed" });
    assert.equal(field().data.show_name, false, type);
    editor.remove();
  }
});
