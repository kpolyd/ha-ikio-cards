import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { batchStaticMeshes, overviewPoints } from "../src/static-batches.js";

function vertices(root) {
  root.updateWorldMatrix(true, true);
  const points = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (
      let instance = 0;
      instance < (mesh.isInstancedMesh ? mesh.count : 1);
      instance++
    ) {
      const matrix = mesh.matrixWorld.clone();
      if (mesh.isInstancedMesh) {
        const local = new T.Matrix4();
        mesh.getMatrixAt(instance, local);
        matrix.multiply(local);
      }
      const geometry = mesh.geometry;
      for (
        let i = 0;
        i < (geometry.index?.count ?? geometry.attributes.position.count);
        i++
      ) {
        const index = geometry.index ? geometry.index.getX(i) : i;
        points.push(
          new T.Vector3()
            .fromBufferAttribute(geometry.attributes.position, index)
            .applyMatrix4(matrix)
            .toArray()
            .map((v) => v.toFixed(5))
            .join(","),
        );
      }
    }
  });
  return points.sort();
}

test("static batches preserve world-space surfaces, fitting points and shadow flags", () => {
  const root = new T.Group();
  root.rotation.y = -Math.PI / 2;
  const material = new T.MeshStandardMaterial();
  const geometry = new T.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 4; i++) {
    const mesh = new T.Mesh(
      i < 2 ? geometry : new T.BoxGeometry(0.5 + i / 10, 1, 1),
      material,
    );
    mesh.position.set(i * 0.4, 0.5, 0);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  const before = vertices(root);
  const corners = overviewPoints(root)
    .map((p) =>
      p
        .toArray()
        .map((v) => v.toFixed(8))
        .join(","),
    )
    .sort();
  const batches = batchStaticMeshes(root, new Set());
  assert.equal(batches.length, 2);
  assert(batches.some((mesh) => mesh.isInstancedMesh));
  assert.deepEqual(vertices(root), before);
  assert.deepEqual(
    overviewPoints(root)
      .map((p) =>
        p
          .toArray()
          .map((v) => v.toFixed(8))
          .join(","),
      )
      .sort(),
    corners,
  );
  assert(batches.every((mesh) => mesh.castShadow && mesh.receiveShadow));
});

test("controlled subtrees, named objects and transparent materials stay independent", () => {
  const root = new T.Group();
  const group = new T.Group();
  root.add(group);
  const material = new T.MeshStandardMaterial();
  const geometry = new T.BoxGeometry();
  const named = new T.Mesh(geometry, material);
  named.name = "Named cabinet";
  const controlled = new T.Mesh(geometry, material);
  group.add(controlled);
  const glass = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({ transparent: true }),
  );
  root.add(named, glass);
  for (let i = 0; i < 3; i++) root.add(new T.Mesh(geometry, material));
  batchStaticMeshes(root, new Set([group]));
  assert.equal(named.parent, root);
  assert.equal(glass.parent, root);
  assert.equal(controlled.parent, group);
  controlled.position.x = 2;
  root.updateWorldMatrix(true, true);
  assert.equal(
    new T.Vector3().setFromMatrixPosition(controlled.matrixWorld).x,
    2,
  );
});
