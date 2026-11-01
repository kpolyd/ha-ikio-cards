import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { resolveConfiguration } from "../src/resolve-configuration.js";
import { buildHomeScene } from "../src/scene-builders.js";

test("demo room encloses all four sides with real door and window gaps", async () => {
  const inputs = await Promise.all(
    ["home-model", "entities", "device-bindings"].map(async (file) =>
      JSON.parse(
        await readFile(
          new URL(`../examples/${file}.json`, import.meta.url),
          "utf8",
        ),
      ),
    ),
  );
  const configuration = resolveConfiguration(...inputs);
  assert.equal(Object.keys(configuration.rooms).length, 2); // One room plus overview.
  const scene = buildHomeScene({
    root: new T.Group(),
    home: configuration.home,
    bindings: configuration.bindings,
    pos: (x, y, z) => new T.Vector3(x, y, z),
    cachePointLightShadows: () => {},
  });
  const walls = scene.walls.map(({ o }) => o);
  const hitsWall = (x, y, z, dx, dz) =>
    new T.Raycaster(
      new T.Vector3(x, y, z),
      new T.Vector3(dx, 0, dz),
      0,
      0.8,
    ).intersectObjects(walls).length > 0;
  for (const x of [0.4, 2, 3.6]) {
    assert.ok(hitsWall(x, 1.5, 0.3, 0, -1), "back wall encloses the room");
    assert.ok(hitsWall(x, 1.5, 2.7, 0, 1), "front wall encloses the room");
  }
  for (const z of [0.3, 1.5, 2.7])
    assert.ok(hitsWall(0.3, 1.5, z, -1, 0), "left wall encloses the room");
  for (const z of [0.3, 2.7])
    assert.ok(hitsWall(3.7, 1.5, z, 1, 0), "right wall flanks the window");
  assert.equal(hitsWall(1.1, 1, 2.7, 0, 1), false, "doorway is cut out");
  assert.ok(hitsWall(1.1, 2.4, 2.7, 0, 1), "wall remains above the door");
  assert.equal(hitsWall(3.7, 1.5, 1.5, 1, 0), false, "window is cut out");
  assert.ok(hitsWall(3.7, 0.5, 1.5, 1, 0), "wall remains below the window");
  assert.ok(hitsWall(3.7, 2.4, 1.5, 1, 0), "wall remains above the window");
  assert.deepEqual(scene.openings.map(({ entity }) => entity).sort(), [
    "binary_sensor.example_door",
    "binary_sensor.example_window",
  ]);
});
