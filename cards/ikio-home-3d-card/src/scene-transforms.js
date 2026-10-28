// Static world matrices remain valid while camera/material state changes.
// Dynamic subtrees opt back in and are refreshed at their mutation sites.
export function freezeStaticTransforms(scene, dynamicRoots) {
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
  });
  for (const root of dynamicRoots)
    root.traverse((object) => {
      object.matrixAutoUpdate = true;
      object.matrixWorldAutoUpdate = true;
    });
}
