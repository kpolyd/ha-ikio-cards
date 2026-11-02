import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom;
const cards = [
  "electricity",
  "climate",
  "media",
  "vacuum",
  "alarmo",
  "server-monitor",
  "vehicle",
  "graph",
  "mini-graph",
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
          const key = this.schema[0].name;
          const value = this.schema[0].selector?.number
            ? this.input.value === ""
              ? undefined
              : Number(this.input.value)
            : this.input.value;
          this.data = { ...this.data, [key]: value };
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
for (const card of ["graph", "mini-graph"])
  test(`${card}: invalid numeric drafts remain editable and recover without losing focus`, async () => {
    const editor = document.createElement(`ikio-${card}-card-editor`);
    const config = {
      type: `custom:ikio-${card}-card`,
      entities: [{ entity: "sensor.example" }],
      primary_entity: "sensor.example",
      hours: 6,
      expected_min: 20,
      expected_max: 30,
      graph_height: 32,
      visibility: [{ condition: "user", users: ["demo"] }],
      grid_options: { rows: 2 },
    };
    editor.setConfig(config);
    document.body.append(editor);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const feedbackErrors = [];
    let saved;
    editor.addEventListener("config-changed", (event) => {
      saved = structuredClone(event.detail.config);
      try {
        editor.setConfig(JSON.parse(JSON.stringify(saved)));
      } catch (error) {
        feedbackErrors.push(error.message);
      }
    });
    const cases = [
      ["hours", ["", "0", "12"]],
      ["expected_min", ["", "35"]],
      ["expected_max", ["", "4", "40"]],
      ...(card === "mini-graph" ? [["graph_height", ["", "4", "40"]]] : []),
    ];
    for (const [key, drafts] of cases) {
      const form = [...editor.shadowRoot.querySelectorAll("ha-form")].find(
        (f) => f.schema[0].name === key,
      );
      const input = form.input;
      input.focus();
      for (const draft of drafts) {
        input.value = draft;
        input.dispatchEvent(new dom.window.Event("input"));
        assert.deepEqual(feedbackErrors, [], `${key}: ${draft}`);
        assert.equal(form.isConnected, true);
        assert.equal(editor.shadowRoot.activeElement, form);
        assert.equal(form.shadowRoot.activeElement, input);
        assert.equal(input.value, draft);
        if (draft !== "") assert.equal(saved[key], Number(draft));
        if (
          (key === "hours" && draft === "0") ||
          (key === "graph_height" && draft === "4") ||
          (key === "expected_min" && draft === "35") ||
          (key === "expected_max" && draft === "4")
        )
          assert.equal(
            editor.shadowRoot.querySelector(".config-error").hidden,
            false,
            `${key}: display invalid draft feedback`,
          );
      }
      input.blur();
      await Promise.resolve();
    }
    assert.deepEqual(saved.visibility, config.visibility);
    assert.deepEqual(saved.grid_options, config.grid_options);
    assert.equal(saved.expected_min, 35);
    assert.equal(saved.expected_max, 40);
    assert.equal(editor.shadowRoot.querySelector(".config-error").hidden, true);
    editor.remove();
  });

test("an invalid saved graph configuration can be opened and corrected in the visual editor", async () => {
  const editor = document.createElement("ikio-mini-graph-card-editor");
  assert.doesNotThrow(() => editor.setConfig({ graph_height: 4 }));
  document.body.append(editor);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const error = editor.shadowRoot.querySelector(".config-error");
  assert.equal(error.hidden, false);
  assert.match(error.textContent, /Graph height.*outside permitted range/);
  editor.hass = { locale: { language: "el" } };
  assert.match(error.textContent, /εκτός επιτρεπόμενων ορίων/);
  const form = [...editor.shadowRoot.querySelectorAll("ha-form")].find(
    (f) => f.schema[0].name === "graph_height",
  );
  form.input.value = "40";
  form.input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(editor.config.graph_height, 40);
  assert.equal(error.hidden, true, "recovers even without host feedback");
  const { normalizeConfig } = await import(
    "../../../cards/ikio-mini-graph-card/src/config.js"
  );
  assert.throws(() => normalizeConfig({ graph_height: 4 }));
  assert.throws(() => normalizeConfig({ expected_min: 35, expected_max: 30 }));
  editor.remove();
});

test("per-series limits stay editable while crossing inherited graph bounds", async () => {
  const editor = document.createElement("ikio-graph-card-editor");
  editor.setConfig({
    expected_min: 20,
    expected_max: 30,
    entities: [{ entity: "sensor.example", name: "Example", opaque: 42 }],
  });
  document.body.append(editor);
  await new Promise((resolve) => setTimeout(resolve, 0));
  editor.addEventListener("config-changed", (event) =>
    editor.setConfig(event.detail.config),
  );
  const row = editor.shadowRoot.querySelector('[data-key="list:entities:0"]');
  const field = (key) =>
    [...row.querySelectorAll("ha-form")].find((f) => f.schema[0].name === key);
  for (const [key, value] of [
    ["expected_min", 35],
    ["expected_max", 40],
  ]) {
    const form = field(key);
    form.input.focus();
    form.input.value = String(value);
    form.input.dispatchEvent(new dom.window.Event("input"));
    assert.equal(editor.config.entities[0][key], value);
    assert.equal(
      editor.shadowRoot.querySelector(".config-error").hidden,
      key === "expected_max",
    );
    assert.equal(form.shadowRoot.activeElement, form.input);
  }
  assert.equal(editor.config.entities[0].opaque, 42);
  assert.equal(editor.config.entities[0].name, "Example");
  assert.equal(editor.config.expected_max, 30);
  editor.remove();
});

test("other shared fields report errors inline without waiting for HA feedback", async () => {
  for (const [card, key, invalid, valid] of [
    ["battery", "low_threshold", -1, 25],
    ["climate", "temperature_step", 0, 0.5],
    ["mini-graph", "primary_entity", "sensor.", "sensor.example"],
  ]) {
    await import(`../../../cards/ikio-${card}-card/src/editor.js`);
    const editor = document.createElement(`ikio-${card}-card-editor`);
    editor.setConfig({});
    document.body.append(editor);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const form = [...editor.shadowRoot.querySelectorAll("ha-form")].find(
      (f) => f.schema[0].name === key,
    );
    form.input.focus();
    for (const value of [invalid, valid]) {
      form.input.value = String(value);
      form.input.dispatchEvent(new dom.window.Event("input"));
      assert.equal(editor.config[key], value);
      assert.equal(
        editor.shadowRoot.querySelector(".config-error").hidden,
        value === valid,
      );
      assert.equal(form.shadowRoot.activeElement, form.input);
    }
    editor.remove();
  }
});
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
    assert.equal(editor.shadowRoot.querySelector("ha-form"), forms[0]);
    input.blur();
    await Promise.resolve();
    assert.equal(form.data[key], external);
    editor.remove();
  });

test("editing a main field does not restore stale repeatable-list values", async () => {
  const editor = document.createElement("ikio-server-monitor-card-editor");
  editor.setConfig({
    name: "Server",
    extra_readings: [{ name: "Old", entity: "sensor.example" }],
    view_layout: { column: 2 },
  });
  editor.hass = { states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const forms = [...editor.shadowRoot.querySelectorAll("ha-form")],
    main = forms[0];
  const row = [
    ...editor.shadowRoot
      .querySelector('[data-key="list:extra_readings:0"]')
      .querySelectorAll("ha-form"),
  ].find((f) => f.schema[0].name === "name");
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  row.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...row.data, name: "New" } },
    }),
  );
  assert.equal(saved.extra_readings[0].name, "New");
  main.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...main.data, name: "Renamed" } },
    }),
  );
  assert.equal(saved.name, "Renamed");
  assert.equal(saved.extra_readings[0].name, "New");
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

test("backspace through text and numeric values retains the same focused native field after normalized HA feedback", async () => {
  const { defineEditor, number } = await import("../src/schema-editor.js");
  defineEditor(
    "focus-regression-editor",
    [number("amount", "Amount", 0, 100)],
    [],
    (c) => ({
      ...c,
      amount: c.amount ?? 10,
      appearance: { theme: "dark", ...c.appearance },
    }),
  );
  const editor = document.createElement("focus-regression-editor");
  editor.setConfig({ name: "Office", amount: 12, view_layout: { column: 2 } });
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  let saved;
  editor.addEventListener("config-changed", (e) => {
    saved = JSON.parse(JSON.stringify(e.detail.config));
    if (saved.name === "") delete saved.name;
    editor.setConfig({ ...saved, schema_version: 1 });
  });
  for (const [key, initial, replacement] of [
    ["name", "Office", "Room"],
    ["amount", "12", "25"],
  ]) {
    const form = [...editor.shadowRoot.querySelectorAll("ha-form")].find(
      (f) => f.schema[0].name === key,
    );
    const input = form.input;
    input.value = initial;
    input.focus();
    for (let i = initial.length; i >= 0; i--) {
      input.value = initial.slice(0, i);
      input.setSelectionRange(i, i);
      input.dispatchEvent(new dom.window.Event("input"));
      assert.equal(form.isConnected, true);
      assert.equal(editor.shadowRoot.activeElement, form);
      assert.equal(form.shadowRoot.activeElement, input);
      assert.equal(input.selectionStart, i);
      assert.equal(input.value, initial.slice(0, i));
    }
    if (key === "amount")
      assert.equal(
        form.data.amount,
        undefined,
        "do not overwrite an empty numeric draft with a normalized default",
      );
    for (const char of replacement) {
      input.value += char;
      input.dispatchEvent(new dom.window.Event("input"));
    }
    assert.equal(saved[key], key === "amount" ? 25 : "Room");
    input.blur();
    await Promise.resolve();
    assert.equal(
      [...editor.shadowRoot.querySelectorAll("ha-form")].filter(
        (f) => f.schema[0].name === key,
      ).length,
      1,
    );
  }
  assert.deepEqual(saved.view_layout, { column: 2 });
  editor.remove();
});

test("focus and list callbacks remain current after an unrelated external configuration update", async () => {
  const editor = document.createElement("ikio-server-monitor-card-editor");
  editor.setConfig({
    name: "Server",
    extra_readings: [{ entity: "sensor.example", name: "Old" }],
  });
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const row = editor.shadowRoot.querySelector(
    '[data-key="list:extra_readings:0"]',
  );
  row.open = true;
  const nameForm = [...row.querySelectorAll("ha-form")].find(
    (f) => f.schema[0].name === "name",
  );
  nameForm.input.focus();
  editor.setConfig({ ...editor.config, ip_address_entity: "sensor.address" });
  assert.equal(nameForm.isConnected, true);
  nameForm.input.value = "Updated";
  nameForm.input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(editor.config.extra_readings[0].name, "Updated");
  assert.equal(row.querySelector("summary").textContent, "Updated");
  assert.equal(editor.config.ip_address_entity, "sensor.address");
  assert.equal(nameForm.shadowRoot.activeElement, nameForm.input);
  editor.remove();
});
