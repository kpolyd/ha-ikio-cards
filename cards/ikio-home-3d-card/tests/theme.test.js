import test from "node:test";
import assert from "node:assert/strict";
import { daylightForSun } from "../src/theme.js";
const sun = (elevation) => ({
  state: "above_horizon",
  attributes: { elevation },
});
test("Sun lighting blends across twilight and clamps to exact day/night endpoints", () => {
  for (const [elevation, expected] of [
    [-30, 0],
    [-6, 0],
    [-3, 0.25],
    [0, 0.5],
    [3, 0.75],
    [6, 1],
    [80, 1],
  ])
    assert.equal(daylightForSun(sun(elevation)), expected);
  for (const state of [
    undefined,
    {},
    sun(null),
    sun("0"),
    sun(NaN),
    sun(91),
    { ...sun(0), state: "unavailable" },
  ])
    assert.equal(daylightForSun(state), null);
});
