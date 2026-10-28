import test from "node:test";
import assert from "node:assert/strict";
import { sunDirection as direction } from "../src/sun-position.js";
const homeModel = { coordinates: { bearing: 90 } };
const sunDirection = (state) => direction(state, homeModel.coordinates.bearing);
const sample = (azimuth, elevation) => ({
  state: "above_horizon",
  attributes: { azimuth, elevation },
});
const close = (a, b) => assert(Math.abs(a - b) < 1e-10);

test("090-degree plan bearing maps compass directions to default screen axes", () => {
  for (const [azimuth, x, z] of [
    [90, 0, -1],
    [180, 1, 0],
    [270, 0, 1],
    [0, -1, 0],
  ]) {
    const d = sunDirection(sample(azimuth, 30));
    close(d.x, x * Math.cos(Math.PI / 6));
    close(d.z, z * Math.cos(Math.PI / 6));
    close(d.y, 0.5);
    assert(d.aboveHorizon);
  }
  const zenith = sunDirection(sample(90, 90));
  close(zenith.y, 1);
  close(zenith.x, 0);
  close(zenith.z, 0);
  assert(!sunDirection(sample(90, -10)).aboveHorizon);
  assert(!sunDirection(sample(90, 0)).aboveHorizon);
});

test("invalid or unavailable sun data does not invent a direction", () => {
  for (const state of [
    undefined,
    {},
    sample(null, 30),
    sample(90, ""),
    sample(90, NaN),
    sample(90, 91),
    sample(361, 30),
    { ...sample(90, 30), state: "unavailable" },
  ])
    assert.equal(sunDirection(state), null);
});

test("a synthetic afternoon sun casts shadows to the right of plan-up", () => {
  const direction = sunDirection(sample(282.69, 33.39));
  const shadowX = -direction.x / direction.y;
  const shadowZ = -direction.z / direction.y;
  assert(shadowX > 0);
  assert(shadowZ < 0);
  close((Math.atan2(shadowX, -shadowZ) * 180) / Math.PI, 12.69);
});
