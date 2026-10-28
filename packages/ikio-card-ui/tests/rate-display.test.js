import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<body></body>");
globalThis.HTMLElement = dom.window.HTMLElement;
const { rateDisplay, rateFactor } = await import("../src/rate-display.js");
const { valueText } = await import("../src/controls.js");
function hass(value, unit) {
  return {
    states: {
      "sensor.rate": {
        state: String(value),
        attributes: { unit_of_measurement: unit },
      },
    },
    locale: { language: "en" },
  };
}
test("rates scale up and down within byte/bit and decimal/binary families", () => {
  for (const [value, unit, expected] of [
    [0, "MB/s", "0 B/s"],
    [850, "B/s", "850 B/s"],
    [12500, "bytes/s", "12.5 kB/s"],
    [12500, "bits/s", "12.5 kbit/s"],
    [2, " MB /s ", "2 MB/s"],
    [12500, "B/s", "12.5 kB/s"],
    [3200000, "B/s", "3.2 MB/s"],
    [1000000000, "B/s", "1 GB/s"],
    [1000000000000, "B/s", "1 TB/s"],
    [0.002, "MB/s", "2 kB/s"],
    [8, "Mbit/s", "8 Mbit/s"],
    [12500, "bit/s", "12.5 kbit/s"],
    [2000, "Mbps", "2 Gbit/s"],
    [2048, "KiB/s", "2 MiB/s"],
    [0.5, "MiB/s", "512 KiB/s"],
    [2048, "Kibit/s", "2 Mibit/s"],
  ]) {
    const state = hass(value, unit);
    const snapshot = JSON.stringify(state);
    assert.equal(rateDisplay(state, { entity: "sensor.rate" }), expected);
    assert.equal(valueText(state, "sensor.rate"), expected);
    assert.equal(
      JSON.stringify(state),
      snapshot,
      "formatting must not mutate HA state",
    );
  }
});
test("boundaries, unknowns, non-rates and normalized graph ticks remain honest", () => {
  assert.equal(
    rateDisplay(hass(999, "B/s"), { entity: "sensor.rate" }),
    "999 B/s",
  );
  assert.equal(
    rateDisplay(hass(1000, "B/s"), { entity: "sensor.rate" }),
    "1 kB/s",
  );
  assert.equal(
    rateDisplay(hass("unavailable", "B/s"), { entity: "sensor.rate" }),
    "unavailable",
  );
  assert.equal(valueText(hass(3, "MB"), "sensor.rate"), "3 MB");
  assert.equal(rateFactor("MB"), null);
  assert.equal(
    rateDisplay(hass(8, "Mbit/s"), { entity: "sensor.rate" }, 125000),
    "1 Mbit/s",
  );
});
dom.window.close();
