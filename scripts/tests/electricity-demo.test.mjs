import { test } from "node:test";
import assert from "node:assert/strict";
import {
  electricityIds,
  demoPower,
  demoPowerHistory,
} from "../../dev/previews/fixtures/electricity.js";
test("demo power stays continuous and spans low/high colour thresholds with consistent device totals", () => {
  const start = Date.parse("2026-10-27T06:00:00Z"),
    end = start + 6 * 3600000;
  const samples = demoPowerHistory("sensor.total", start, end);
  assert.equal(samples[0].lu, start / 1000);
  assert.equal(samples.at(-1).lu, end / 1000);
  assert.ok(
    samples.every((s) => Number.isFinite(Number(s.s)) && Number(s.s) >= 0),
  );
  assert.ok(Math.min(...samples.map((s) => +s.s)) < 250);
  assert.ok(Math.max(...samples.map((s) => +s.s)) > 3200);
  for (let i = 0; i < samples.length; i++) {
    const sum = electricityIds
      .slice(1)
      .reduce((v, id) => v + demoPower(id, i / (samples.length - 1)), 0);
    assert.ok(+samples[i].s >= sum);
    if (i) assert.equal(samples[i].lu - samples[i - 1].lu, 30);
  }
  for (const id of electricityIds)
    assert.equal(+demoPowerHistory(id, start, end).at(-1).s, demoPower(id, 1));
});
