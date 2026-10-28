import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Keep independently controlled/pickable objects out of static render batches.
export function batchStaticMeshes(root, excluded) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const matrix = new T.Matrix4();
  root.traverse((mesh) => {
    if (
      !mesh.isMesh ||
      mesh.isInstancedMesh ||
      mesh.name ||
      Array.isArray(mesh.material) ||
      mesh.material.transparent ||
      mesh.userData.overviewFit === false ||
      mesh.renderOrder !== 0
    )
      return;
    for (let parent = mesh; parent && parent !== root; parent = parent.parent)
      if (excluded.has(parent) || !parent.visible) return;
    matrix.multiplyMatrices(inverse, mesh.matrixWorld);
    if (matrix.determinant() <= 0) return;
    const position = new T.Vector3().setFromMatrixPosition(matrix);
    const attributes = Object.entries(mesh.geometry.attributes)
      .map(([name, a]) => `${name}:${a.itemSize}:${a.normalized}`)
      .sort()
      .join();
    // Small spatial groups retain useful frustum and shadow culling.
    const key = [
      mesh.material.uuid,
      mesh.castShadow,
      mesh.receiveShadow,
      mesh.layers.mask,
      Math.floor(position.x / 3),
      Math.floor(position.z / 3),
      !!mesh.geometry.index,
      attributes,
    ].join("|");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ mesh, matrix: matrix.clone() });
  });
  const batches = [];
  function finish(batch, sources) {
    const first = sources[0].mesh;
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.layers.mask = first.layers.mask;
    // Preserve the original physical fitting points, rather than fitting a
    // larger bounding box spanning empty space between batched objects.
    batch.userData.overviewCorners = sources.flatMap(({ mesh, matrix }) =>
      geometryCorners(mesh.geometry).map((p) => p.applyMatrix4(matrix)),
    );
    for (const { mesh } of sources) mesh.removeFromParent();
    root.add(batch);
    batches.push(batch);
  }
  for (const sources of buckets.values()) {
    const repeated = new Map();
    for (const source of sources) {
      const key = source.mesh.geometry;
      if (!repeated.has(key)) repeated.set(key, []);
      repeated.get(key).push(source);
    }
    const remaining = [];
    for (const group of repeated.values()) {
      if (group.length < 2) {
        remaining.push(...group);
        continue;
      }
      const first = group[0].mesh;
      const batch = new T.InstancedMesh(
        first.geometry,
        first.material,
        group.length,
      );
      group.forEach((source, i) => batch.setMatrixAt(i, source.matrix));
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingBox();
      batch.computeBoundingSphere();
      finish(batch, group);
    }
    if (remaining.length < 2) continue;
    const geometries = remaining.map(({ mesh, matrix }) =>
      mesh.geometry.clone().applyMatrix4(matrix),
    );
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());
    if (merged)
      finish(new T.Mesh(merged, remaining[0].mesh.material), remaining);
  }
  return batches;
}

function geometryCorners(geometry) {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const points = [];
  for (const x of [min.x, max.x])
    for (const y of [min.y, max.y])
      for (const z of [min.z, max.z]) points.push(new T.Vector3(x, y, z));
  return points;
}

export function overviewPoints(root) {
  const points = [];
  root.updateWorldMatrix(true, true);
  root.traverseVisible((mesh) => {
    if (!mesh.isMesh || mesh.userData.overviewFit === false) return;
    const corners =
      mesh.userData.overviewCorners ?? geometryCorners(mesh.geometry);
    for (const corner of corners)
      points.push(corner.clone().applyMatrix4(mesh.matrixWorld));
  });
  return points;
}
