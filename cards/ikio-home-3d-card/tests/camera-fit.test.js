import test from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { fitTopView } from "../src/camera-fit.js";

test("top-view fitting accounts for elevation and asymmetric toolbar space", () => {
  const points = [
    new Vector3(-4, 0, -6),
    new Vector3(3, 0, 7),
    new Vector3(-3, 3, -5),
    new Vector3(2, 2, 6),
  ];
  for (const [width, height, top] of [
    [390, 650, 84],
    [1024, 738, 62],
    [650, 390, 62],
  ]) {
    const fit = fitTopView(points, { width, height, top, fov: 38 });
    const camera = new PerspectiveCamera(38, width / height, 0.1, 100);
    camera.up.set(0, 0, -1);
    camera.position.set(fit.x, fit.distance, fit.z);
    camera.lookAt(fit.x, 0, fit.z);
    camera.updateMatrixWorld(true);
    const margins = [];
    for (const point of points) {
      const projected = point.clone().project(camera);
      const screenX = ((projected.x + 1) * width) / 2;
      const screenY = ((1 - projected.y) * height) / 2;
      assert(screenX >= 8 && screenX <= width - 8);
      assert(screenY >= top && screenY <= height - 8);
      margins.push(
        screenX - 8,
        width - 8 - screenX,
        screenY - top,
        height - 8 - screenY,
      );
    }
    assert(Math.min(...margins) < 1, "fit must use the available space");
  }
});

test("unmeasurable viewports have no fit and tiny models respect minimum distance", () => {
  const points = [new Vector3(0, 0, 0)];
  for (const [width, height] of [
    [0, 0],
    [0, 700],
    [900, 0],
    [16, 700],
    [900, 16],
  ]) {
    assert.equal(fitTopView(points, { width, height, fov: 38 }), null);
  }
  assert.equal(fitTopView([], { width: 900, height: 700, fov: 38 }), null);
  const fit = fitTopView(points, { width: 900, height: 700, fov: 38 });
  assert(fit.distance >= 3);
  assert(fit.distance < 3.1);
});
