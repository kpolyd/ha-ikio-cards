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
  const Card = customElements.get("ikio-graph-card");
  const card = document.createElement("ikio-graph-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-graph-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-graph-card");
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

test("multi-series legend labels remain associated with distinct line patterns and exact units", () => {
  const card = document.createElement("ikio-graph-card");
  card.setConfig({
    entities: [
      { entity: "sensor.one", name: "First" },
      { entity: "sensor.two", name: "Second" },
    ],
  });
  card.hass = {
    states: {
      "sensor.one": { state: "12", attributes: { unit_of_measurement: "W" } },
      "sensor.two": { state: "34", attributes: { unit_of_measurement: "W" } },
    },
  };
  document.body.append(card);
  const entries = card.shadowRoot.querySelectorAll(".ikio-legend-entry");
  assert.equal(entries.length, 2);
  assert.match(entries[0].textContent, /First12 W/);
  assert.match(entries[1].textContent, /Second34 W/);
  assert.ok(entries[1].querySelector(".dashed"));
  card.setConfig({ entities: [{ entity: "sensor.one" }], show_legend: false });
  assert.equal(card.shadowRoot.querySelector(".ikio-legend"), null);
  card.remove();
});
