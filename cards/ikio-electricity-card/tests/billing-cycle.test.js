import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  parseBillingCron,
  cronBillingCycle,
  billingCycleLabel,
} from "../src/billing-cycle.js";
let dom;
before(async () => {
  dom = new JSDOM("<body></body>", {
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
  await import("../src/index.js");
});
after(() => dom.window.close());
const iso = (date) => new Date(date).toISOString();
const range = (cron, zone, now) => {
  const result = cronBillingCycle(cron, zone, Date.parse(now));
  assert.equal(result.error, undefined);
  return [iso(result.start), iso(result.end)];
};
test("monthly cron uses HA timezone with inclusive day labels and exact exclusive reset bounds", () => {
  assert.deepEqual(
    range("0 0 20 * *", "Europe/Athens", "2026-10-26T10:00:00Z"),
    ["2026-10-19T21:00:00.000Z", "2026-11-19T22:00:00.000Z"],
  );
  const cycle = cronBillingCycle(
    "0 0 20 * *",
    "Europe/Athens",
    Date.parse("2026-10-26T10:00:00Z"),
  );
  assert.equal(
    billingCycleLabel(cycle, { language: "en-GB" }),
    "20 Oct – 19 Nov",
  );
  assert.equal((cycle.end - cycle.start) / 3600000, 745);
  assert.deepEqual(range("0 0 20 * *", "Europe/Athens", iso(cycle.end)), [
    iso(cycle.end),
    "2026-12-19T22:00:00.000Z",
  ]);
});
test("spring DST and fractional-hour timezones preserve wall-clock reset dates", () => {
  assert.deepEqual(
    range("0 0 20 * *", "Europe/Athens", "2026-03-30T12:00:00Z"),
    ["2026-03-19T22:00:00.000Z", "2026-04-19T21:00:00.000Z"],
  );
  assert.deepEqual(
    range("0 0 20 * *", "Asia/Kathmandu", "2026-10-20T00:00:00Z"),
    ["2026-10-19T18:15:00.000Z", "2026-11-19T18:15:00.000Z"],
  );
});
test("short months, leap years and year rollover use actual cron dates without clamping", () => {
  assert.deepEqual(range("0 0 31 * *", "UTC", "2026-04-15T00:00:00Z"), [
    "2026-03-31T00:00:00.000Z",
    "2026-05-31T00:00:00.000Z",
  ]);
  assert.deepEqual(range("0 0 29 2 *", "UTC", "2100-02-28T00:00:00Z"), [
    "2096-02-29T00:00:00.000Z",
    "2104-02-29T00:00:00.000Z",
  ]);
  const cycle = cronBillingCycle(
    "0 0 20 * *",
    "UTC",
    Date.parse("2026-12-25T00:00:00Z"),
  );
  assert.equal(
    billingCycleLabel(cycle, { language: "en-GB" }),
    "20 Dec 2026 – 19 Jan 2027",
  );
});
test("numeric lists, ranges, steps, Sunday alias and day/weekday OR semantics work", () => {
  assert.deepEqual(range("0 0 */2 * 1", "UTC", "2026-10-26T09:22:00Z"), [
    "2026-10-19T00:00:00.000Z",
    "2026-11-09T00:00:00.000Z",
  ]);
  assert.deepEqual(range("*/15 8-10 * * 1-5", "UTC", "2026-10-26T09:22:00Z"), [
    "2026-10-26T09:15:00.000Z",
    "2026-10-26T09:30:00.000Z",
  ]);
  assert.deepEqual(range("0 0 5,20 * *", "UTC", "2026-10-26T09:22:00Z"), [
    "2026-10-20T00:00:00.000Z",
    "2026-11-05T00:00:00.000Z",
  ]);
  assert.deepEqual(range("0 0 * * 7", "UTC", "2026-10-26T09:22:00Z"), [
    "2026-10-25T00:00:00.000Z",
    "2026-11-01T00:00:00.000Z",
  ]);
  assert.deepEqual(range("0 0 20 * 1", "UTC", "2026-10-21T09:22:00Z"), [
    "2026-10-20T00:00:00.000Z",
    "2026-10-26T00:00:00.000Z",
  ]);
});
test("exact minute boundaries and DST gaps/folds follow HA's fixed-time scheduler rules", () => {
  assert.deepEqual(
    range("*/30 3 * * *", "Europe/Athens", "2026-10-25T00:45:00Z"),
    ["2026-10-25T00:30:00.000Z", "2026-10-25T01:00:00.000Z"],
  );
  assert.deepEqual(range("* * * * *", "UTC", "2026-10-26T09:22:00Z"), [
    "2026-10-26T09:22:00.000Z",
    "2026-10-26T09:23:00.000Z",
  ]);
  assert.deepEqual(
    range("30 3 * * *", "Europe/Athens", "2026-10-25T00:45:00Z"),
    ["2026-10-25T00:30:00.000Z", "2026-10-26T01:30:00.000Z"],
  );
  assert.deepEqual(
    range("30 3 * * *", "Europe/Athens", "2026-03-29T00:45:00Z"),
    ["2026-03-28T01:30:00.000Z", "2026-03-29T01:00:00.000Z"],
  );
  const partial = cronBillingCycle(
    "30 6 20 * *",
    "UTC",
    Date.parse("2026-10-26T09:00:00Z"),
  );
  assert.equal(
    billingCycleLabel(partial, { language: "en-GB" }),
    "20 Oct, 06:30 – 20 Nov, 06:29",
  );
});
test("unsupported and impossible schedules fail clearly without guessing or using the browser zone", () => {
  for (const expression of [
    "0 0 L * *",
    "@monthly",
    "0 0 20 * * *",
    "60 0 20 * *",
    "*/0 * * * *",
    "0 0 32 * *",
    "0 0 * 13 *",
    "0 0 * * 8",
    "0 0 * * mon",
    123,
  ])
    assert.throws(() => parseBillingCron(expression));
  assert.match(
    cronBillingCycle("0 0 30 2 *", "UTC").error,
    /no matching reset/,
  );
  assert.match(cronBillingCycle("0 0 20 * *", undefined).error, /timezone/);
  assert.match(
    cronBillingCycle("0 0 20 * *", "Invalid/Zone").error,
    /unavailable/,
  );
});
function cardFixture(extra = {}) {
  const card = document.createElement("ikio-electricity-card");
  card.setConfig({
    power_entity: "sensor.power",
    billing_cycle_cron: "0 0 20 * *",
    forecast_bill_entity: "sensor.forecast",
    ...extra,
  });
  card.hass = {
    language: "en-GB",
    config: { time_zone: "UTC" },
    states: {
      "sensor.power": {
        state: "100",
        attributes: { unit_of_measurement: "W" },
      },
      "sensor.forecast": {
        state: "42",
        attributes: { unit_of_measurement: "EUR" },
      },
    },
  };
  document.body.append(card);
  return card;
}
test("only the inclusive label rolls over while idle; sensor readings stay unchanged and lifecycle cleans up", (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: Date.parse("2026-10-19T23:59:50Z"),
  });
  const card = cardFixture();
  const dates = () =>
    card.shadowRoot.querySelector(".ae-energy-header .ae-note").textContent;
  const bill = () =>
    card.shadowRoot.querySelector(".ae-energy-bills").textContent;
  assert.equal(dates(), "20 Sept – 19 Oct");
  assert.match(bill(), /42 EUR/);
  const summary = card.shadowRoot.querySelector(".ae-energy-summary").innerHTML;
  t.mock.timers.tick(10050);
  assert.equal(dates(), "20 Oct – 19 Nov");
  assert.match(bill(), /42 EUR/);
  assert.equal(
    card.shadowRoot.querySelector(".ae-energy-summary").innerHTML,
    summary,
  );
  t.mock.timers.tick(3600000);
  assert.match(bill(), /42 EUR/);
  card.visible = false;
  card.onVisibility();
  t.mock.timers.tick(32 * 86400000);
  assert.equal(dates(), "20 Oct – 19 Nov");
  card.visible = true;
  card.onVisibility();
  assert.equal(dates(), "20 Nov – 19 Dec");
  card.remove();
  const detached = card.billingCycle;
  t.mock.timers.tick(32 * 86400000);
  assert.equal(card.billingCycle, detached);
});
test("cron changes the label only, retaining legacy forecast gates, sensor values and label overrides", (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: Date.parse("2026-10-20T00:00:00Z"),
  });
  const card = cardFixture({
    billing_period_label: "Custom billing",
    cycle_start_entity: "sensor.old",
    forecast_minimum_hours: 1,
  });
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "sensor.old": { state: "2020-01-01T00:00:00Z", attributes: {} },
    },
  };
  assert.equal(
    card.shadowRoot.querySelector(".ae-energy-header .ae-note").textContent,
    "Custom billing",
  );
  assert.match(
    card.shadowRoot.querySelector(".ae-energy-bills").textContent,
    /42 EUR/,
  );
  card.setConfig({
    ...card.config,
    billing_cycle_cron: "",
    billing_period_label: "",
  });
  assert.match(
    card.shadowRoot.querySelector(".ae-energy-header .ae-note").textContent,
    /2020/,
  );
  assert.match(
    card.shadowRoot.querySelector(".ae-energy-bills").textContent,
    /42 EUR/,
  );
  card.remove();
});
test("timezone-only HA configuration changes recalculate the cycle", (t) => {
  t.mock.timers.enable({
    apis: ["Date", "setTimeout"],
    now: Date.parse("2026-10-19T22:00:00Z"),
  });
  const card = cardFixture();
  assert.equal(iso(card.billingCycle.start), "2026-09-20T00:00:00.000Z");
  card.hass = { ...card.hass, config: { time_zone: "Europe/Athens" } };
  assert.equal(iso(card.billingCycle.start), "2026-10-19T21:00:00.000Z");
  card.remove();
});
test("billing cron is editable without losing legacy sensor bindings or HA metadata", async () => {
  const Card = customElements.get("ikio-electricity-card"),
    editor = await Card.getConfigElement();
  const config = {
    power_entity: "sensor.power",
    cycle_start_entity: "sensor.start",
    cycle_end_entity: "sensor.end",
    visibility: [{ condition: "user", users: ["simulated-user"] }],
  };
  editor.setConfig(config);
  editor.hass = { states: {}, config: { time_zone: "UTC" } };
  document.body.append(editor);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const form = [...editor.shadowRoot.querySelectorAll("ha-form")].find((f) =>
    f.schema.some((s) => s.name === "billing_cycle_cron"),
  );
  assert.ok(
    form.schema.some(
      (field) => field.name === "billing_cycle_cron" && field.selector.text,
    ),
  );
  let saved;
  editor.addEventListener(
    "config-changed",
    (event) => (saved = event.detail.config),
  );
  form.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...form.data, billing_cycle_cron: "0 0 20 * *" } },
    }),
  );
  assert.equal(saved.billing_cycle_cron, "0 0 20 * *");
  assert.equal(saved.cycle_start_entity, "sensor.start");
  assert.deepEqual(saved.visibility, config.visibility);
  editor.remove();
});
