import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { freezeStaticTransforms } from "../src/scene-transforms.js";

test("static transforms stay cached while moving subtrees update in world space", () => {
  const scene = new T.Scene(),
    root = new T.Group();
  root.rotation.y = Math.PI / 2;
  scene.add(root);
  const fixed = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  const moving = new T.Group(),
    child = fixed.clone();
  moving.add(child);
  root.add(fixed, moving);
  freezeStaticTransforms(scene, [moving]);
  let staticUpdates = 0;
  fixed.updateMatrix = () => {
    staticUpdates++;
  };
  const original = fixed.matrixWorld.clone();
  moving.position.x = 2;
  child.position.z = 1;
  moving.updateWorldMatrix(false, true);
  assert.equal(staticUpdates, 0);
  assert(fixed.matrixWorld.equals(original));
  const position = new T.Vector3().setFromMatrixPosition(child.matrixWorld);
  assert(position.distanceTo(new T.Vector3(1, 0, -2)) < 1e-10);
  assert.equal(scene.matrixWorldAutoUpdate, false);
});
