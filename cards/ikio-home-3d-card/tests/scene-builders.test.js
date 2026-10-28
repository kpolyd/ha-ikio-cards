import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { buildHomeScene } from "../src/scene-builders.js";

function build(objects) {
  const root = new T.Group();
  const result = buildHomeScene({
    root,
    home: { materials: { white: { color: "white" } }, floors: [], objects },
    bindings: [],
    pos: (x, y, z) => new T.Vector3(x, y, z),
    cachePointLightShadows() {},
  });
  return { root, ...result };
}
const box = (id, x, width = 1) => ({
  id,
  kind: "box",
  position: { x, y: 0, z: 0 },
  size: { width, height: 1, depth: 1 },
  material: "white",
  round: 0.01,
});

test("identical shapes share buffers while transforms remain independent", () => {
  const { objects } = build([
    box("first", 0),
    box("second", 2),
    box("wider", 4, 2),
  ]);
  const first = objects.get("first"),
    second = objects.get("second"),
    wider = objects.get("wider");
  assert.equal(first.geometry, second.geometry);
  assert.notEqual(first.geometry, wider.geometry);
  second.position.x += 1;
  assert.equal(first.position.x, 0);
  assert.equal(second.position.x, 3);
  assert.equal(first.geometry.parameters.width, 1);
  assert.equal(wider.geometry.parameters.width, 2);
});
