import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let normalizeConfig, fields, forecastRows, windDirection, slotLabel;

let dom;
before(async () => {
  dom = new JSDOM("<body/>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  customElements.define("ha-form", class extends HTMLElement {});
  ({ normalizeConfig, fields } = await import("../src/config.js"));
  ({ forecastRows, windDirection, slotLabel } = await import(
    "../src/adapter.js"
  ));
  await import("../src/index.js");
});
after(() => dom.window.close());
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const stamp = (offset) =>
  new Date(Date.now() + offset * 86400000).toISOString();
const forecast = () =>
  [0, 1, 2].map((i) => ({
    datetime: stamp(i),
    temperature: 10 + i,
    templow: i,
    precipitation: i,
    condition: "rainy",
    wind_speed: 0,
    wind_bearing: 0,
    precipitation_probability: 0,
  }));
function fixture(config = {}, attributes = {}) {
  const listeners = [],
    messages = [],
    unsubscribed = [];
  const connection = {
    subscribeMessage: (callback, msg) => {
      listeners.push(callback);
      messages.push(msg);
      return Promise.resolve(() => unsubscribed.push(msg));
    },
  };
  const state = {
    entity_id: "weather.demo",
    state: "rainy",
    attributes: {
      friendly_name: "Demo weather",
      supported_features: 3,
      temperature: 7.7,
      temperature_unit: "°C",
      wind_speed: 0,
      wind_speed_unit: "km/h",
      humidity: 0,
      ...attributes,
    },
  };
  const card = document.createElement("ikio-weather-card");
  card.setConfig({ entity: "weather.demo", ...config });
  card.hass = {
    states: { "weather.demo": state },
    connection,
    locale: { language: "en" },
    config: { time_zone: "UTC" },
  };
  document.body.append(card);
  return { card, listeners, messages, unsubscribed, state, connection };
}
test("configuration is generic, complete, immutable and validates toggles and weather domains", () => {
  const input = {
    entity: "weather.demo",
    view_layout: { column: 1 },
    appearance: { theme: "light" },
  };
  const c = normalizeConfig(input);
  assert.equal(c.forecast_slots, 7);
  assert.equal(c.appearance.theme, "light");
  assert.deepEqual(input, {
    entity: "weather.demo",
    view_layout: { column: 1 },
    appearance: { theme: "light" },
  });
  assert.throws(() => normalizeConfig({ entity: "sensor.temp" }), /compatible/);
  assert.throws(() => normalizeConfig({ show_wind: "false" }), /toggles/);
  assert.throws(() => normalizeConfig({ forecast_slots: 3.5 }), /whole/);
  assert.throws(
    () => normalizeConfig({ forecast_type: "weekly" }),
    /Unsupported/,
  );
});
test("subscribes through native forecast API, preserves zero and missing values, and never calls services", async () => {
  const { card, messages, listeners, unsubscribed } = fixture();
  assert.deepEqual(messages, [
    {
      type: "weather/subscribe_forecast",
      entity_id: "weather.demo",
      forecast_type: "daily",
    },
  ]);
  listeners[0]({ type: "daily", forecast: forecast() });
  assert.equal(card.content.querySelectorAll(".weather-rain-bar").length, 3);
  assert.match(card.precipitation.textContent, /0 mm|0/);
  assert.equal(card.rows.length, 3);
  assert.match(card.current.textContent, /0 %/);
  assert.match(card.current.textContent, /0 km\/h/);
  const rows = forecast();
  rows[1].temperature = null;
  rows[1].templow = null;
  rows[1].precipitation = null;
  listeners[0]({ forecast: rows });
  assert.equal(card.content.querySelectorAll(".weather-rain-bar").length, 2);
  assert.match(
    card.content.querySelector(".weather-line.temperature").getAttribute("d"),
    /M.*M/,
  );
  assert.doesNotMatch(card.content.textContent, /NaN|undefined/);
  await flush();
  card.remove();
  assert.equal(unsubscribed.length, 1);
});
test("switching supported modes preserves controls and ignores stale responses", async () => {
  const { card, listeners, messages, unsubscribed } = fixture();
  await flush();
  const hourly = card.tabButtons.get("hourly");
  hourly.focus();
  hourly.click();
  assert.equal(messages[1].forecast_type, "hourly");
  assert.equal(unsubscribed.length, 1);
  assert.equal(card.tabButtons.get("hourly"), hourly);
  assert.equal(card.shadowRoot.activeElement, hourly);
  listeners[0]({ forecast: forecast() });
  assert.equal(card.rows.length, 0);
  listeners[1]({
    type: "hourly",
    forecast: [{ datetime: stamp(0), temperature: 0, templow: -5 }],
  });
  assert.equal(card.rows.length, 1);
  assert.equal(
    card.content.querySelectorAll(".weather-line.templow").length,
    0,
  );
  card.hass = {
    ...card.hass,
    states: {
      "weather.demo": {
        ...card.hass.states["weather.demo"],
        attributes: {
          ...card.hass.states["weather.demo"].attributes,
          humidity: 23,
        },
      },
    },
  };
  assert.equal(card.tabButtons.get("hourly"), hourly);
  assert.equal(messages.length, 2);
  card.remove();
});
test("uses available forecast types and keeps current readings without a forecast", () => {
  const { card, listeners, messages } = fixture(
    { forecast_type: "daily" },
    { supported_features: 2 },
  );
  assert.equal(messages[0].forecast_type, "hourly");
  assert.equal(card.tabs.hidden, true);
  listeners[0]({ forecast: null });
  assert.match(card.message.textContent, /No forecast/);
  assert.match(card.current.textContent, /7.7/);
  card.hass = {
    ...card.hass,
    states: {
      "weather.demo": {
        ...card.hass.states["weather.demo"],
        attributes: { temperature: 7.7, supported_features: 0 },
      },
    },
  };
  assert.match(card.message.textContent, /does not provide/);
  card.remove();
});
test("missing optional values are omitted, invalid probability and precipitation stay unknown", () => {
  const { card, listeners } = fixture(
    { show_precipitation_probability: true, show_forecast_wind: true },
    { humidity: null, wind_speed: null },
  );
  listeners[0]({
    forecast: [
      {
        datetime: stamp(0),
        temperature: 0,
        precipitation: -1,
        precipitation_probability: 150,
      },
    ],
  });
  assert.equal(card.current.querySelectorAll(".weather-reading").length, 0);
  assert.equal(card.content.querySelectorAll(".weather-rain-bar").length, 0);
  assert.equal(card.wind.hidden, true);
  assert.doesNotMatch(card.content.textContent, /150 %|-1 mm/);
  card.remove();
});
test("remapping, disconnecting and late subscription setup cannot publish stale weather", async () => {
  const { card, listeners, unsubscribed } = fixture();
  let resolve;
  card.hass = {
    ...card.hass,
    connection: { subscribeMessage: () => new Promise((r) => (resolve = r)) },
  };
  await flush();
  assert.equal(unsubscribed.length, 1);
  card.setConfig({ entity: "weather.other" });
  assert.equal(card.rows.length, 0);
  let stopped = 0;
  resolve(() => stopped++);
  await flush();
  assert.equal(stopped, 1);
  listeners[0]({ forecast: forecast() });
  assert.equal(card.rows.length, 0);
  card.remove();
});
test("service failures expose retry; timeout and retry recover without stale data", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const { card } = fixture();
  card.hass = {
    ...card.hass,
    connection: {
      subscribeMessage: async () => {
        throw Error("offline");
      },
    },
  };
  await flush();
  assert.equal(card.retry.hidden, false);
  assert.match(card.message.textContent, /could not/);
  assert.match(card.current.textContent, /7.7/);
  let callback;
  let stops = 0;
  card.hass = {
    ...card.hass,
    connection: {
      subscribeMessage: (cb) => {
        callback = cb;
        return Promise.resolve(() => stops++);
      },
    },
  };
  await flush();
  card.retry.click();
  await flush();
  context.mock.timers.tick(15001);
  assert.equal(card.retry.hidden, false);
  assert.equal(stops, 2);
  callback({ forecast: forecast() });
  assert.equal(card.rows.length, 0);
  card.retry.click();
  callback({ forecast: forecast() });
  assert.equal(card.rows.length, 3);
  assert.equal(card.retry.hidden, true);
  card.remove();
  context.mock.timers.reset();
});
test("hidden document suspends subscription; reconnect and new connection resubscribe once", async () => {
  const { card, messages, unsubscribed } = fixture();
  await flush();
  Object.defineProperty(document, "hidden", {
    value: true,
    configurable: true,
  });
  document.dispatchEvent(new dom.window.Event("visibilitychange"));
  assert.equal(unsubscribed.length, 1);
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
  document.dispatchEvent(new dom.window.Event("visibilitychange"));
  assert.equal(messages.length, 2);
  await flush();
  card.remove();
  document.body.append(card);
  assert.equal(messages.length, 3);
  card.remove();
});
test("forecast-off, unavailable state, all toggles and native details remain independent", async () => {
  const { card, listeners, unsubscribed } = fixture();
  await flush();
  listeners[0]({ forecast: forecast() });
  let detail;
  card.addEventListener("hass-more-info", (e) => (detail = e.detail));
  card.nameButton.click();
  assert.deepEqual(detail, { entityId: "weather.demo" });
  card.setConfig({
    ...card.config,
    show_current: false,
    show_temperature_graph: false,
    show_precipitation: false,
    show_forecast_conditions: false,
  });
  listeners.at(-1)({ forecast: forecast() });
  assert.equal(card.current.hidden, true);
  assert.equal(card.chart.hidden, true);
  assert.equal(card.values.hidden, false);
  assert.equal(card.days.querySelectorAll("ha-icon").length, 0);
  card.setConfig({ ...card.config, show_forecast: false });
  assert.equal(card.forecast.hidden, true);
  assert.ok(unsubscribed.length);
  card.setConfig({ ...card.config, show_current: true, show_forecast: true });
  card.hass = {
    ...card.hass,
    states: {
      "weather.demo": {
        state: "unavailable",
        attributes: { temperature: 88, supported_features: 7 },
      },
    },
  };
  assert.match(card.current.textContent, /Unavailable/);
  assert.doesNotMatch(card.current.textContent, /88/);
  card.remove();
});
test("forecast adapter respects dates, ordering, timezone, nulls and directional convention", () => {
  const hass = {
    locale: { language: "en", time_format: "24" },
    config: { time_zone: "Europe/Athens" },
  };
  const now = Date.parse("2026-10-28T22:30:00Z");
  const rows = forecastRows(
    [
      { datetime: "bad" },
      { datetime: "2026-10-28T21:00:00Z", temperature: 4 },
      { datetime: "2026-10-29T00:00:00Z", temperature: 5 },
      { datetime: "2026-10-29T00:00:00Z", temperature: 9 },
    ],
    "daily",
    hass,
    now,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].temperature, 5);
  assert.equal(windDirection(0), "↓");
  assert.equal(windDirection(90), "←");
  assert.equal(windDirection("NW"), "NW");
  assert.equal(windDirection(null), "");
  assert.equal(
    slotLabel(hass, { datetime: "2026-10-28T22:30:00Z" }, "hourly"),
    "00:30",
  );
});
test("visual editor exposes all fields and preserves HA metadata and appearance on edit", async () => {
  const Editor = await customElements
    .get("ikio-weather-card")
    .getConfigElement();
  Editor.setConfig({
    entity: "weather.demo",
    view_layout: { column: 2 },
    appearance: { theme: "light" },
  });
  Editor.hass = { states: {}, locale: { language: "en" } };
  document.body.append(Editor);
  await flush();
  const forms = [...Editor.shadowRoot.querySelectorAll("ha-form")].filter(
    (f) => !f.closest('[data-key="card-actions"]'),
  );
  assert.deepEqual(
    new Set(forms.flatMap((f) => f.schema.map((s) => s.name))).size,
    fields.length + 2,
  );
  let changed;
  Editor.addEventListener("config-changed", (e) => (changed = e.detail.config));
  const form = forms.find((f) => f.schema.some((s) => s.name === "show_wind"));
  form.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...form.data, show_wind: false } },
    }),
  );
  assert.equal(changed.show_wind, false);
  assert.deepEqual(changed.view_layout, { column: 2 });
  assert.equal(changed.appearance.theme, "light");
  Editor.remove();
});

test("three supported types use a compact selector, twice-daily entries remain separate and localized", async () => {
  const { card, listeners, messages } = fixture({}, { supported_features: 7 });
  assert.equal(card.tabs.hidden, true);
  assert.equal(card.periodSelect.hidden, false);
  assert.equal(card.periodSelect.options.length, 3);
  card.periodSelect.value = "twice_daily";
  card.periodSelect.dispatchEvent(new dom.window.Event("change"));
  assert.equal(messages.at(-1).forecast_type, "twice_daily");
  listeners.at(-1)({
    type: "twice_daily",
    forecast: [
      { datetime: stamp(0), temperature: 0, is_daytime: true },
      { datetime: stamp(0.5), temperature: -3, is_daytime: false },
    ],
  });
  assert.equal(card.rows.length, 2);
  assert.match(card.days.textContent, /Day.*Night/);
  assert.equal(
    card.content.querySelectorAll(".weather-line.templow").length,
    0,
  );
  card.hass = {
    ...card.hass,
    locale: { language: "el-GR", number_format: "decimal_comma" },
  };
  assert.match(card.legend.textContent, /Θερμοκρασία/);
  assert.match(card.days.textContent, /Ημέρα.*Νύχτα/);
  await flush();
  card.remove();
});

test("forecast labels honor native unit formatting and keep unsupported measurements absent", () => {
  const { card, listeners } = fixture(
    {},
    {
      temperature: -1.5,
      temperature_unit: "°F",
      precipitation_unit: "in",
      wind_speed_unit: "mph",
      humidity: null,
      wind_speed: null,
    },
  );
  listeners[0]({
    forecast: [
      { datetime: stamp(0), temperature: -2, templow: -5, precipitation: 0.2 },
      { datetime: stamp(1), temperature: 0, precipitation: null },
    ],
  });
  assert.match(card.current.textContent, /-1.5 °F/);
  assert.match(card.precipitation.textContent, /0.2 in/);
  assert.equal(card.current.querySelectorAll(".weather-reading").length, 0);
  assert.equal(card.content.querySelectorAll(".weather-rain-bar").length, 1);
  assert.match(card.chart.getAttribute("aria-label"), /°F.*in/);
  assert.equal(
    Number(
      card.content.querySelector(".weather-rain-bar").getAttribute("height"),
    ),
    66,
  );
  card.remove();
});

test("forecast-button holds open native details without changing type and current icon honors the entity", async () => {
  const { card, messages } = fixture({}, { icon: "mdi:weather-sunny" });
  assert.equal(
    card.current.querySelector("ha-icon").getAttribute("icon"),
    "mdi:weather-sunny",
  );
  let detail;
  card.addEventListener("hass-more-info", (event) => (detail = event.detail));
  const hourly = card.tabButtons.get("hourly");
  hourly.dispatchEvent(new dom.window.MouseEvent("pointerdown"));
  await new Promise((resolve) => setTimeout(resolve, 570));
  hourly.click();
  assert.deepEqual(detail, { entityId: "weather.demo" });
  assert.equal(card.selectedType, "daily");
  assert.equal(messages.length, 1);
  card.remove();
});
