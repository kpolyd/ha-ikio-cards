import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom;
before(async () => {
  dom = new JSDOM("<body/>", { url: "http://localhost" });
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
function fixture(secondary = "54.3", unit = "%") {
  const c = document.createElement("ikio-mini-graph-card");
  c.setConfig({
    primary_entity: "sensor.temp",
    secondary_entity: "sensor.secondary",
    hours: 6,
  });
  c.hass = {
    locale: { language: "en" },
    states: {
      "sensor.temp": {
        entity_id: "sensor.temp",
        state: "21.8",
        attributes: { friendly_name: "Temperature", unit_of_measurement: "°C" },
      },
      "sensor.secondary": {
        entity_id: "sensor.secondary",
        state: secondary,
        attributes: { friendly_name: "Other", unit_of_measurement: unit },
      },
    },
  };
  const now = Date.now() / 1000;
  c.history = {
    "sensor.temp": [
      { lu: now - 21600, s: "22.4", a: { unit_of_measurement: "°C" } },
      { lu: now, s: "21.8" },
    ],
  };
  c.update();
  return c;
}
test("only primary supplies history and bounds; different-unit and text secondary readings render", (ctx) => {
  const now = Date.now();
  ctx.mock.method(Date, "now", () => now);
  const c = fixture();
  assert.deepEqual(c.historyEntities(), ["sensor.temp"]);
  assert.equal(c.content.querySelectorAll(".ae-time-axis span").length, 3);
  assert.equal(
    c.content.querySelectorAll(".mini-readings .ae-reading").length,
    2,
  );
  assert.match(
    c.content.querySelector(".mini-secondary").textContent,
    /54.3.*%/,
  );
  const bounds = c.content.querySelector(".ae-y-axis").textContent;
  assert.match(bounds, /22.4.*°C/);
  assert.doesNotMatch(bounds, /54.3|%/);
  const path = c.content
    .querySelector("path:not(.ae-area-fill)")
    .getAttribute("d");
  c.hass = {
    ...c.hass,
    states: {
      ...c.hass.states,
      "sensor.secondary": { state: "Connected", attributes: {} },
    },
  };
  assert.match(
    c.content.querySelector(".mini-secondary").textContent,
    /Connected/,
  );
  assert.equal(
    c.content.querySelector("path:not(.ae-area-fill)").getAttribute("d"),
    path,
  );
  c.remove();
});
test("secondary can be omitted and each reading opens its own entity details", () => {
  const c = fixture();
  const opened = [];
  c.addEventListener("hass-more-info", (e) => opened.push(e.detail.entityId));
  c.content.querySelector(".mini-primary").click();
  c.content.querySelector(".mini-secondary").click();
  assert.deepEqual(opened, ["sensor.temp", "sensor.secondary"]);
  c.setConfig({
    primary_entity: "sensor.temp",
    show_extrema: false,
    show_time_labels: false,
  });
  c.update();
  assert.equal(c.content.querySelector(".mini-secondary"), null);
  assert.ok(c.content.querySelector(".no-extrema.no-times"));
  c.remove();
});
test("missing primary history retains live readings and missing secondary is explicit", () => {
  const c = fixture("unavailable");
  c.history = {};
  c.update();
  assert.match(c.content.textContent, /21.8/);
  assert.match(c.content.textContent, /unavailable/i);
  assert.match(c.content.textContent, /No history available/);
  c.remove();
});
test("visual editor includes both entity selectors and preserves HA sizing and visibility", async () => {
  const Card = customElements.get("ikio-mini-graph-card");
  const editor = await Card.getConfigElement();
  const config = {
    primary_entity: "sensor.temp",
    secondary_entity: "sensor.other",
    grid_options: { rows: 2 },
    visibility: [{ condition: "user", users: ["demo"] }],
  };
  editor.setConfig(config);
  editor.hass = { states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const forms = [...editor.shadowRoot.querySelectorAll("ha-form")];
  const fields = forms.flatMap((f) => f.schema.map((s) => s.name));
  assert.ok(fields.includes("primary_entity"));
  assert.ok(fields.includes("secondary_entity"));
  assert.ok(
    fields.includes("appearance") ||
      editor.shadowRoot.textContent.includes("Appearance"),
  );
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  forms[0].dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...forms[0].data, name: "Changed" } },
    }),
  );
  assert.deepEqual(saved.grid_options, config.grid_options);
  assert.deepEqual(saved.visibility, config.visibility);
  editor.remove();
});
