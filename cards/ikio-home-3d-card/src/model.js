import { Room } from "./enums.js";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildHomeScene } from "./scene-builders.js";
import { overviewPoints } from "./static-batches.js";
import { freezeStaticTransforms } from "./scene-transforms.js";

import { createLabelLayer } from "./labels/layer.js";
import { fitTopView } from "./camera-fit.js";
import { sunDirection } from "./sun-position.js";
export function createModel(canvas, onPick, configuration, initialView = {}) {
  const { home, entities, rooms, bindings, labelGroups, layout } =
    configuration;
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(12, 14, 16);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 3;
  controls.maxDistance = 30;
  // One scheduler serves independent WebGL and HTML invalidations.
  let frameId = null;
  let lastFrame = null;
  let sceneDirty = true;
  let labelsDirty = true;
  let inViewport = true;
  let hasSize = true;
  const canRender = () => inViewport && hasSize && !document.hidden;
  function scheduleFrame() {
    if (alive && canRender() && frameId === null)
      frameId = requestAnimationFrame(frame);
  }
  function requestRender() {
    sceneDirty = true;
    scheduleFrame();
  }
  function requestLayout() {
    labelsDirty = true;
    scheduleFrame();
  }
  function cameraChanged() {
    requestLayout();
    requestRender();
  }
  function visibilityChanged() {
    if (!alive) return;
    if (!canRender()) {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      lastFrame = null;
    } else {
      // Refresh layout after hidden elements regain measurable dimensions.
      requestLayout();
      if (sceneDirty || fanRunning) scheduleFrame();
    }
  }
  controls.addEventListener("change", cameraChanged);
  // Native one-finger page scroll; two fingers orbit/pinch the model.
  canvas.style.touchAction = "auto";
  const stopTouchPointer = (e) => {
    if (e.pointerType === "touch") e.stopImmediatePropagation();
  };
  for (const event of ["pointerdown", "pointermove", "pointerup"])
    canvas.addEventListener(event, stopTouchPointer, true);
  let touchGesture = null;
  let touchTap = null;
  const touchStart = (e) => {
    touchTap =
      e.touches.length === 1
        ? {
            identifier: e.touches[0].identifier,
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          }
        : null;
    if (e.touches.length !== 2) {
      touchGesture = null;
      return;
    }
    e.preventDefault();
    const [a, b] = e.touches;
    touchGesture = {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
      d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
    };
  };
  const touchMove = (e) => {
    if (touchTap) {
      const touch = Array.from(e.touches).find(
        (item) => item.identifier === touchTap.identifier,
      );
      if (
        !touch ||
        Math.hypot(touch.clientX - touchTap.x, touch.clientY - touchTap.y) > 6
      )
        touchTap = null;
    }
    if (e.touches.length !== 2 || !touchGesture) return;
    e.preventDefault();
    const [a, b] = e.touches;
    const x = (a.clientX + b.clientX) / 2,
      y = (a.clientY + b.clientY) / 2,
      d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new T.Spherical().setFromVector3(offset);
    spherical.radius = T.MathUtils.clamp(
      (spherical.radius * touchGesture.d) / Math.max(d, 1),
      controls.minDistance,
      controls.maxDistance,
    );
    spherical.theta -= (x - touchGesture.x) * 0.006;
    spherical.phi = T.MathUtils.clamp(
      spherical.phi - (y - touchGesture.y) * 0.006,
      0.001,
      controls.maxPolarAngle,
    );
    camera.position
      .copy(controls.target)
      .add(new T.Vector3().setFromSpherical(spherical));
    controls.update();
    touchGesture = { x, y, d };
  };
  const touchEnd = (event) => {
    const tap = touchTap;
    touchTap = null;
    touchGesture = null;
    if (event.type === "touchcancel" || event.touches.length || !tap) return;
    const touch = Array.from(event.changedTouches).find(
      (item) => item.identifier === tap.identifier,
    );
    if (
      touch &&
      Math.hypot(touch.clientX - tap.x, touch.clientY - tap.y) <= 6
    ) {
      event.preventDefault();
      pick(touch.clientX, touch.clientY);
    }
  };
  canvas.addEventListener("touchstart", touchStart, { passive: false });
  canvas.addEventListener("touchmove", touchMove, { passive: false });
  canvas.addEventListener("touchend", touchEnd);
  canvas.addEventListener("touchcancel", touchEnd);
  const ambient = new T.HemisphereLight(0xe8f5ff, 0xb9a48c, 1.8);
  scene.add(ambient);
  const sun = new T.DirectionalLight(0xfff3dc, 2.2);
  sun.position.set(-5, 15, 6);
  sun.castShadow = true;
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
    near: 0.1,
    far: 40,
  });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
  const shadowLights = [sun];
  function cachePointLightShadows(light) {
    light.castShadow = true;
    light.visible = false;
    light.shadow.autoUpdate = false;
    light.shadow.needsUpdate = true;
    // Six views per point light; allocate only when that light first turns on.
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 0.05;
    light.shadow.camera.far = light.distance;
    light.shadow.bias = -0.0001;
    light.shadow.normalBias = 0.015;
    shadowLights.push(light);
  }
  function invalidateGeometryShadows() {
    // Inactive lights keep the dirty flag until they are next switched on.
    for (const light of shadowLights) light.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  }
  function setPointLightIntensity(light, intensity) {
    light.intensity = intensity;
    light.visible = intensity > 0;
    if (light.visible && light.shadow.needsUpdate)
      renderer.shadowMap.needsUpdate = true;
  }
  let sunInitialized = false;
  const root = new T.Group();
  root.rotation.y = home.coordinates.rotationY;
  scene.add(root);
  const {
    mats,
    walls,
    openings,
    targets,
    lighting,
    fans,
    halos,
    screens,
    floors,
    fullWallObjects,
  } = buildHomeScene({
    root,
    home,
    bindings,
    pos,
    cachePointLightShadows,
  });
  let selected = initialView.room ?? Room.OVERVIEW;
  let alive = true;
  let full;
  let fitPoints;
  let fitResult;
  function pos(x, y, z) {
    return new T.Vector3(
      x - home.coordinates.origin.x,
      y,
      z - home.coordinates.origin.z,
    );
  }
  // Screen-facing labels are independent of the 3D scene construction.
  const labelLayer = createLabelLayer({
    canvas,
    camera,
    worldPoint,
    entities,
    labelGroups,
    layout,
    openings,
    onPick,
    onLayoutChange: requestLayout,
    getHass: initialView.getHass,
  });
  // Room markers sit above floors; selection still works on the floor itself.
  const highlights = {};
  for (const [name, x1, z1, x2, z2] of floors) {
    if (highlights[name]) continue;
    const h = new T.Mesh(
      new T.BoxGeometry(x2 - x1, 0.012, z2 - z1),
      new T.MeshStandardMaterial({
        color: "#6ea89f",
        roughness: 0.7,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    h.position.copy(pos((x1 + x2) / 2, 0.014, (z1 + z2) / 2));
    h.castShadow = h.receiveShadow = true;
    root.add(h);
    highlights[name] = h;
    h.userData.overviewFit = false;
  }

  let fanRunning = false;
  let daylight = 1;
  function setDaylight(value) {
    if (!alive || !Number.isFinite(value)) return;
    value = Math.max(0, Math.min(1, value));
    if (value === daylight) return;
    daylight = value;
    ambient.intensity = 0.6 + daylight * 1.2;
    sun.intensity = daylight * 2.2;
    requestRender();
  }
  let sceneSnapshot;
  let openingSnapshot;
  const sceneIds = [
    ...new Set([
      ...lighting.map(({ id }) => id),
      ...fans.map(({ id }) => id),
      ...screens.map(({ id }) => id),
      ...openings.map(({ entity }) => entity).filter(Boolean),
    ]),
  ];
  function update(states) {
    if (!alive) return;
    if (labelLayer.update(states)) requestLayout();
    const snapshot = JSON.stringify(
      sceneIds.map((id) => {
        const value = states[id];
        return [
          value?.state,
          ...(lighting.some((light) => light.id === id && !light.onOffOnly)
            ? [value?.attributes?.brightness, value?.attributes?.rgb_color]
            : []),
        ];
      }),
    );
    if (snapshot === sceneSnapshot) return;
    sceneSnapshot = snapshot;
    const nextOpenings = JSON.stringify(
      openings.map((o) => states[o.entity]?.state === "on"),
    );
    if (nextOpenings !== openingSnapshot) {
      invalidateGeometryShadows();
      fitPoints = fitResult = undefined;
    }
    openingSnapshot = nextOpenings;
    requestRender();
    for (const fan of fans) fan.running = states[fan.id]?.state === "on";
    fanRunning = fans.some((fan) => fan.running);
    for (const f of lighting) {
      const state = states[f.id];
      const on = state?.state === "on";
      const attrs = state?.attributes || {};
      const level = on
        ? f.onOffOnly
          ? 1
          : typeof attrs.brightness === "number"
            ? Math.max(0, Math.min(1, attrs.brightness / 255))
            : 1
        : 0;
      const rgb = f.onOffOnly ? null : attrs.rgb_color;
      const color =
        Array.isArray(rgb) && rgb.length === 3
          ? new T.Color().setRGB(
              ...rgb.map((v) => Math.max(0, Math.min(255, v)) / 255),
              T.SRGBColorSpace,
            )
          : new T.Color(f.color);
      f.mesh.material.emissive.copy(color);
      f.mesh.material.emissiveIntensity = level * 2;
      f.light.color.copy(color);
      setPointLightIntensity(f.light, f.power * level);
    }
    for (const halo of halos) {
      const source = lighting.find((light) => light.object === halo.source);
      halo.mesh.material.color.copy(source.light.color);
      halo.mesh.material.opacity =
        source.mesh.material.emissiveIntensity * halo.opacity;
    }
    for (const o of openings) {
      const s = states[o.entity]?.state;
      const v = s === "on" ? o.width * 0.4 : 0;
      o.panel.position.copy(
        pos(
          o.x + (o.axis === "x" ? v : 0),
          o.panel.position.y,
          o.z + (o.axis === "z" ? v : 0),
        ),
      );
      o.panel.updateWorldMatrix(false, true);
    }
    for (const screen of screens)
      screen.mesh.material = screen.activeStates.includes(
        states[screen.id]?.state,
      )
        ? screen.activeMaterial
        : screen.inactiveMaterial;
  }
  function setWalls(value) {
    if (value === full) return false;
    full = value;
    fitPoints = fitResult = undefined;
    for (const { o, h, base } of walls) {
      const shown = value ? h : Math.max(0, Math.min(h, 0.65 - base));
      o.visible = shown > 0;
      o.scale.y = shown / h;
      o.position.y = base + shown / 2;
      o.updateWorldMatrix(false, true);
    }
    for (const object of fullWallObjects) object.visible = value;
    invalidateGeometryShadows();
    requestRender();
    return true;
  }
  setWalls(initialView.walls ?? true);
  freezeStaticTransforms(scene, [
    sun,
    ...walls.map(({ o }) => o),
    ...openings.map(({ panel }) => panel),
    ...fans.map(({ blades }) => blades),
  ]);
  function worldPoint(x, z, y = 0) {
    return root.localToWorld(pos(x, y, z));
  }
  let topView = initialView.top ?? true;
  const toolbar = canvas.parentElement.querySelector(".tools");
  function overviewFit() {
    const bounds = canvas.getBoundingClientRect();
    const toolbarBounds = toolbar?.getBoundingClientRect();
    const top = toolbarBounds?.height
      ? Math.max(8, toolbarBounds.bottom - bounds.top + 8)
      : 8;
    fitPoints ??= overviewPoints(root);
    const key = [
      bounds.width,
      bounds.height,
      top,
      camera.fov,
      controls.minDistance,
    ].join();
    if (fitResult?.key === key) return fitResult.value;
    const value = fitTopView(fitPoints, {
      width: bounds.width,
      height: bounds.height,
      fov: camera.fov,
      top,
      minDistance: controls.minDistance,
    });
    fitResult = { key, value };
    return value;
  }

  function focus(name, top = true) {
    selected = name;
    topView = top;
    for (const [n, o] of Object.entries(highlights))
      o.material.opacity = n === name ? 0.1 : 0;
    const [x, z] =
      name === Room.OVERVIEW
        ? [home.overviewTarget.x, home.overviewTarget.z]
        : rooms[name] || rooms[Room.OVERVIEW];
    const fit = name === Room.OVERVIEW && top ? overviewFit() : null;
    const p = fit ? new T.Vector3(fit.x, 0, fit.z) : worldPoint(x, z);
    controls.target.copy(p);
    const dist =
      fit?.distance ??
      (name === Room.OVERVIEW ? 14 : 7) * Math.max(1, 0.95 / camera.aspect);
    controls.maxDistance = Math.max(30, dist);
    controls.enableDamping = false;
    camera.position
      .copy(p)
      .add(
        top
          ? new T.Vector3(0, dist, 0.01)
          : new T.Vector3(dist * 0.65, dist * 0.8, dist * 0.85),
      );
    camera.lookAt(p);
    controls.update();
    controls.enableDamping = true;
    cameraChanged();
  }
  const ray = new T.Raycaster();
  const pointer = new T.Vector2();
  let down;
  const pointerDown = (event) => {
    down =
      event.button === 0
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : null;
  };
  const pointerMove = (event) => {
    if (
      down &&
      (event.pointerId !== down.id ||
        Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6)
    )
      down = null;
  };
  const pointerCancel = () => {
    down = null;
  };
  const pointerUp = (event) => {
    pointerMove(event);
    const tap = down;
    down = null;
    if (tap) pick(event.clientX, event.clientY);
  };
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    if (!alive || r.width <= 0 || r.height <= 0) return;
    pointer.set(
      ((clientX - r.left) / r.width) * 2 - 1,
      (-(clientY - r.top) / r.height) * 2 + 1,
    );
    camera.updateMatrixWorld();
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(targets, false)[0];
    if (hit) onPick(hit.object.userData);
  }
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerCancel);
  let width, height, toolbarHeight;
  let initialFocus = true;
  const resize = () => {
    if (!alive) return;
    const r = canvas.parentElement.getBoundingClientRect();
    const wasSized = hasSize;
    hasSize = r.width > 0 && r.height > 0;
    if (wasSized !== hasSize) visibilityChanged();
    if (!hasSize) return;
    const nextToolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
    const sizeChanged = r.width !== width || r.height !== height;
    const toolbarChanged = nextToolbarHeight !== toolbarHeight;
    if (!sizeChanged && !toolbarChanged) return;
    toolbarHeight = nextToolbarHeight;
    if (sizeChanged) {
      width = r.width;
      height = r.height;
      renderer.setSize(width, height, false);
      const oldFit = Math.max(1, 0.95 / camera.aspect);
      camera.aspect = width / height;
      const newFit = Math.max(1, 0.95 / camera.aspect);
      camera.position
        .sub(controls.target)
        .multiplyScalar(newFit / oldFit)
        .add(controls.target);
      camera.updateProjectionMatrix();
    }
    cameraChanged();
    if (initialFocus || (selected === Room.OVERVIEW && topView)) {
      initialFocus = false;
      focus(selected, topView);
    }
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  if (toolbar) ro.observe(toolbar);
  resize();
  const intersection =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver((entries) => {
          inViewport = entries[entries.length - 1].isIntersecting;
          visibilityChanged();
        });
  intersection?.observe(canvas);
  document.addEventListener("visibilitychange", visibilityChanged);
  let shadersPrepared = false;
  let preparingShaders = false;
  function prepareShaders() {
    if (shadersPrepared || typeof renderer.compileAsync !== "function") return;
    shadersPrepared = true;
    preparingShaders = true;
    // Initial HA state/theme/view have been applied before the first frame.
    // Let supported drivers compile in parallel rather than stall render().
    Promise.resolve()
      .then(() => {
        if (alive) return renderer.compileAsync(scene, camera);
      })
      .catch((error) => {
        if (alive)
          console.warn(
            "Ikio Home 3D shader preparation failed; rendering normally.",
            error,
          );
      })
      .finally(() => {
        preparingShaders = false;
        if (alive) requestRender();
        else disposeResources();
      });
  }
  function frame(now) {
    frameId = null;
    if (!alive || !canRender()) return;
    const dt =
      lastFrame === null ? 0 : Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    for (const fan of fans)
      if (fan.running) {
        fan.blades.rotation.y += dt * 7;
        fan.blades.updateWorldMatrix(false, true);
      }
    controls.update();
    if (labelsDirty || sceneDirty || fanRunning) {
      camera.updateMatrixWorld();
    }
    if (labelsDirty) {
      labelsDirty = false;
      labelLayer.place(topView);
    }
    if (sceneDirty || fanRunning) prepareShaders();
    if (!preparingShaders && (sceneDirty || fanRunning)) {
      sceneDirty = false;
      renderer.render(scene, camera);
    }
    // Fan blades do not cast shadows. If that changes, invalidate their
    // shadows here as well; currently fan-only frames reuse the cached map.
    if (fanRunning && !preparingShaders) scheduleFrame();
    if (frameId === null) lastFrame = null;
  }
  function disposeResources() {
    const geometries = new Set();
    const materials = new Set([
      ...Object.values(mats),
      ...screens.flatMap((screen) => [
        screen.activeMaterial,
        screen.inactiveMaterial,
      ]),
    ]);
    const textures = new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      for (const material of object.material
        ? Array.isArray(object.material)
          ? object.material
          : [object.material]
        : [])
        materials.add(material);
      object.shadow?.dispose();
      if (object.isInstancedMesh) object.dispose();
    });
    for (const material of materials) {
      for (const value of Object.values(material))
        if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    for (const texture of textures) texture.dispose();
    for (const geometry of geometries) geometry.dispose();
    renderer.dispose();
  }
  requestRender();
  return {
    focus,
    update,
    setWalls(value) {
      if (setWalls(value) && selected === Room.OVERVIEW && topView)
        focus(Room.OVERVIEW, true);
    },
    initializeSun(state) {
      if (!alive || sunInitialized) return;
      const direction = sunDirection(state, home.coordinates.bearing);
      // HA may deliver its first states after the card mounts. Wait for the
      // first valid sample, then keep it fixed until this model is recreated.
      if (!direction) return;
      sunInitialized = true;
      sun.position.set(direction.x * 20, direction.y * 20, direction.z * 20);
      sun.updateWorldMatrix(false, true);
      sun.intensity = daylight * 2.2;
      sun.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      requestRender();
    },
    setDaylight,
    dispose() {
      if (!alive) return;
      alive = false;
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = null;
      controls.removeEventListener("change", cameraChanged);
      intersection?.disconnect();
      document.removeEventListener("visibilitychange", visibilityChanged);
      for (const event of ["pointerdown", "pointermove", "pointerup"])
        canvas.removeEventListener(event, stopTouchPointer, true);
      canvas.removeEventListener("touchstart", touchStart);
      canvas.removeEventListener("touchmove", touchMove);
      canvas.removeEventListener("touchend", touchEnd);
      canvas.removeEventListener("touchcancel", touchEnd);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerCancel);
      labelLayer.dispose();
      ro.disconnect();
      controls.dispose();
      // compileAsync polls material programs until it settles. Keep their GPU
      // resources alive while immediately removing the card and its listeners.
      if (!preparingShaders) disposeResources();
    },
    stats() {
      let meshes = 0;
      scene.traverse((o) => {
        if (o.isMesh) meshes++;
      });
      return {
        meshes,
        entities: entities.length,
        rooms: Object.keys(rooms).length - 1,
      };
    },
    get camera() {
      return camera;
    },
    get scene() {
      return scene;
    },
    get root() {
      return root;
    },
  };
}
