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
test("primary-only bounds remain independent of different-unit and text secondary readings", (ctx) => {
  const now = Date.now();
  ctx.mock.method(Date, "now", () => now);
  const c = fixture();
  assert.deepEqual(c.historyEntities(), ["sensor.temp", "sensor.secondary"]);
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
  assert.ok(fields.includes("points_per_hour"));
  assert.ok(fields.includes("static_colour"));
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

test("secondary uses a grey area without a stroke and cannot alter primary geometry or labels", (ctx) => {
  const nowMs = Date.now();
  ctx.mock.method(Date, "now", () => nowMs);
  const c = fixture();
  const primaryPath = () =>
    c.content.querySelector("path:not(.ae-area-fill)").getAttribute("d");
  const before = primaryPath();
  const bounds = c.content.querySelector(".ae-y-axis").textContent;
  const now = Date.now() / 1000;
  c.history["sensor.secondary"] = [
    { lu: now - 21600, s: "1000", a: { unit_of_measurement: "%" } },
    { lu: now - 10800, s: "5000" },
    { lu: now, s: "2000" },
  ];
  c.update();
  const area = c.content.querySelector(".mini-secondary-area");
  assert.ok(area);
  assert.equal(area.getAttribute("stroke"), "none");
  assert.equal(area.getAttribute("fill"), "var(--ae-muted)");
  assert.equal(primaryPath(), before);
  assert.equal(c.content.querySelector(".ae-y-axis").textContent, bounds);
  assert.equal(c.content.querySelectorAll("path:not(.ae-area-fill)").length, 1);
  assert.equal(
    c.content.querySelectorAll(".mini-readings ha-state-icon").length,
    2,
  );
  c.hass = {
    ...c.hass,
    states: {
      ...c.hass.states,
      "sensor.secondary": { state: "Connected", attributes: {} },
    },
  };
  assert.equal(c.content.querySelector(".mini-secondary-area"), null);
  assert.deepEqual(c.historyEntities(), ["sensor.temp"]);
  c.remove();
});

test("sampling settings validate, preserve editor drafts and static colour follows the theme token", async () => {
  const { normalizeConfig } = await import("../src/config.js");
  assert.equal(normalizeConfig({}).points_per_hour, 12);
  assert.equal(normalizeConfig({}).static_colour, false);
  for (const value of [0, 61, 1.5, "12", Infinity])
    assert.throws(() => normalizeConfig({ points_per_hour: value }));
  assert.throws(() => normalizeConfig({ static_colour: "true" }));
  const c = fixture();
  c.config.static_colour = true;
  c.update();
  assert.equal(
    c.content.querySelector("path:not(.ae-area-fill)").getAttribute("stroke"),
    "var(--ae-accent)",
  );
  c.config.static_colour = false;
  c.update();
  assert.match(
    c.content.querySelector("path:not(.ae-area-fill)").getAttribute("stroke"),
    /^url/,
  );
  c.remove();
});

test("time buckets weight duration, carry unchanged states, preserve gaps and density above 240 points", async () => {
  const { bucketHistory } = await import("../src/history.js");
  const points = [
    { time: 0, value: 10 },
    { time: 900000, value: 30 },
    { time: 3600000, value: 30 },
  ];
  const averaged = bucketHistory(points, 0, 3600000, 1);
  assert.equal(averaged[1].value, 25);
  const gap = bucketHistory(
    [
      { time: 0, value: 10 },
      { time: 300000, value: null },
      { time: 600000, value: 20 },
      { time: 3600000, value: 20 },
    ],
    0,
    3600000,
    2,
  );
  assert.equal(gap[1].value, null);
  assert.equal(gap[2].value, 20);
  const late = bucketHistory(
    [
      { time: 1800000, value: 10 },
      { time: 3600000, value: 10 },
    ],
    0,
    3600000,
    2,
  );
  assert.equal(late[0].value, null);
  assert.equal(late[1].value, null);
  assert(late.every((p, i) => i === 0 || p.time >= late[i - 1].time));
  const c = fixture();
  c.config.points_per_hour = 60;
  c.update();
  assert(
    c.content
      .querySelector("path:not(.ae-area-fill)")
      .getAttribute("d")
      .split(/[ML]/).length > 240,
  );
  c.remove();
});
