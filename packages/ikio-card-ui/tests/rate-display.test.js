import { test, after } from "node:test";
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
after(() => dom.window.close());

for (const [family, base, prefixes] of [
  ["decimal", 1000, ["", "k", "M", "G", "T"]],
  ["binary", 1024, ["", "Ki", "Mi", "Gi", "Ti"]],
]) {
  for (const [kind, suffix, divisor] of [
    ["bytes", "B", 1],
    ["bits", "bit", 8],
    ["short bits", "b", 8],
  ]) {
    for (const [power, prefix] of prefixes.entries()) {
      for (const ending of ["/s", "ps"]) {
        const unit = prefix + suffix + ending;
        test(`${family} ${kind} ${unit}: factor, live reading and normalized graph label`, () => {
          const factor = base ** power / divisor;
          assert.equal(rateFactor(unit), factor);
          const state = hass(2.5, unit);
          const expected = `2.5 ${prefix}${suffix === "B" ? "B" : "bit"}/s`;
          assert.equal(rateDisplay(state, { entity: "sensor.rate" }), expected);
          // Normalized graph history contains bytes/s regardless of source unit.
          state.formatEntityState = () => {
            throw Error("Anonymous graph tick reached entity formatter");
          };
          assert.equal(rateDisplay(state, { unit }, 2.5 * factor), expected);
        });
      }
    }
  }
}

test("all decimal and binary boundaries scale in both directions", () => {
  for (const [base, prefixes] of [
    [1000, ["", "k", "M", "G", "T"]],
    [1024, ["", "Ki", "Mi", "Gi", "Ti"]],
  ]) {
    for (const suffix of ["B", "bit"]) {
      for (let power = 1; power < prefixes.length; power++) {
        const unit = `${prefixes[power]}${suffix}/s`;
        assert.equal(
          rateDisplay(hass(1 / base, unit), { entity: "sensor.rate" }),
          `1 ${prefixes[power - 1]}${suffix}/s`,
        );
        assert.equal(
          rateDisplay(hass(base, `${prefixes[power - 1]}${suffix}/s`), {
            entity: "sensor.rate",
          }),
          // Bare B/s and bit/s carry no IEC marker and therefore scale in SI.
          base === 1024 && power === 1 ? `1.02 k${suffix}/s` : `1 ${unit}`,
        );
      }
    }
  }
});

test("native entity formatter receives valid entity metadata and scaled values", () => {
  for (const [unit, value, scaled, target] of [
    ["B/s", 12500, "12.5", "kB/s"],
    ["Mbit/s", 0.0005, "500", "bit/s"],
    ["KiB/s", 2048, "2", "MiB/s"],
  ]) {
    const state = hass(value, unit);
    state.entities = { "sensor.rate": { display_precision: 3 } };
    state.formatEntityState = function (entity) {
      assert.equal(entity.entity_id, "sensor.rate");
      assert.equal(entity.state, scaled);
      assert.equal(entity.attributes.unit_of_measurement, target);
      return (
        Number(entity.state).toFixed(
          this.entities[entity.entity_id].display_precision,
        ) +
        " " +
        target
      );
    };
    assert.equal(
      rateDisplay(state, { entity: "sensor.rate" }),
      `${Number(scaled).toFixed(3)} ${target}`,
    );
  }
});

test("unsupported, missing and cumulative units are never treated as network rates", () => {
  for (const unit of [
    undefined,
    "",
    "MB",
    "MiB",
    "%",
    "W",
    "MB/min",
    "mB/s",
    "iB/s",
    "iBit/s",
    "packets/s",
  ]) {
    assert.equal(rateFactor(unit), null, String(unit));
    assert.equal(
      valueText(hass(12, unit), "sensor.rate"),
      `12 ${unit || ""}`.trim(),
    );
  }
  for (const value of ["unknown", "unavailable", "not-a-number", ""]) {
    const state = hass(value, "MB/s");
    assert.equal(rateDisplay(state, { entity: "sensor.rate" }), value);
  }
  assert.equal(
    rateDisplay({ states: {} }, { entity: "sensor.missing" }),
    "Entity not found",
  );
});

test("scaled values preserve explicit zero precision, trailing zeros and locale", () => {
  const state = hass(12500, "B/s");
  state.entities = { "sensor.rate": { display_precision: 0 } };
  assert.equal(rateDisplay(state, { entity: "sensor.rate" }), "13 kB/s");
  state.entities["sensor.rate"].display_precision = 3;
  state.locale.number_format = "decimal_comma";
  assert.equal(rateDisplay(state, { entity: "sensor.rate" }), "12,500 kB/s");
  // Entity precision must not leak into anonymous System graph ticks.
  assert.equal(
    rateDisplay(state, { unit: "B/s", precision: 1 }, 12500),
    "12,5 kB/s",
  );
});
