import { resolveConfiguration } from "../src/resolve-configuration.js";
import { home, inventory, devices } from "./fixtures/studio.js";
import { Room } from "../src/enums.js";
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { fileURLToPath } from "node:url";

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/model.js", import.meta.url))],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "reviewModel",
  plugins: [
    {
      name: "renderer-double",
      setup(builder) {
        builder.onResolve({ filter: /^three$/ }, () => ({
          path: "three",
          namespace: "renderer-double",
        }));
        builder.onLoad({ filter: /.*/, namespace: "renderer-double" }, () => ({
          contents: `export * from ${JSON.stringify(fileURLToPath(import.meta.resolve("three")))}; export const WebGLRenderer = window.TestRenderer;`,
          resolveDir: process.cwd(),
          loader: "js",
        }));
      },
    },
  ],
});

function setup(
  context,
  initialSize = { width: 900, height: 700 },
  configuration,
) {
  configuration ??= resolveConfiguration(
    structuredClone(home),
    structuredClone(inventory),
    structuredClone(devices),
  );
  const dom = new JSDOM(
    '<main><canvas></canvas><div class="tools"></div></main>',
    {
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const { window } = dom;
  let dimensions = { ...initialSize, left: 0, top: 0 };
  let resizeCallback;
  const frames = new Map();
  let nextFrame = 0;
  let time = 0;
  let renderCount = 0;
  let resizeCount = 0;
  let clearColor;
  let shadowCount = 0;
  const shadowRenders = new Map();
  let labelMeasurements = 0;
  let intersectionCallback;
  let intersectionDisconnected = false;
  window.IntersectionObserver = class {
    constructor(callback) {
      intersectionCallback = callback;
    }
    observe() {}
    disconnect() {
      intersectionDisconnected = true;
    }
  };
  Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", {
    get() {
      labelMeasurements++;
      return 60;
    },
  });
  Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
    get() {
      labelMeasurements++;
      return 30;
    },
  });
  window.requestAnimationFrame = (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  window.cancelAnimationFrame = (identifier) => frames.delete(identifier);
  window.ResizeObserver = class {
    constructor(callback) {
      resizeCallback = callback;
    }
    observe() {}
    disconnect() {}
  };
  window.TestRenderer = class {
    shadowMap = {};
    setPixelRatio() {}
    setClearColor(value, alpha) {
      clearColor = [value?.getHexString?.() ?? value, alpha];
    }
    setSize() {
      resizeCount++;
    }
    render(scene) {
      renderCount++;
      if (this.shadowMap.needsUpdate) {
        shadowCount++;
        // Emulate Three.js's global and per-light cache gates, without WebGL.
        scene.traverseVisible((light) => {
          if (!light.isLight || !light.castShadow) return;
          if (!light.shadow.autoUpdate && !light.shadow.needsUpdate) return;
          shadowRenders.set(light, (shadowRenders.get(light) ?? 0) + 1);
          light.shadow.needsUpdate = false;
        });
      }
      this.shadowMap.needsUpdate = false;
    }
    dispose() {}
  };
  window.HTMLCanvasElement.prototype.getContext = () =>
    new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
  const canvas = window.document.querySelector("canvas");
  Object.defineProperties(canvas, {
    clientWidth: { get: () => dimensions.width },
    clientHeight: { get: () => dimensions.height },
  });
  canvas.getBoundingClientRect = canvas.parentElement.getBoundingClientRect =
    () => dimensions;
  const toolbar = window.document.querySelector(".tools");
  toolbar.getBoundingClientRect = () => {
    const height = dimensions.width < 400 ? 66 : 37;
    return {
      height,
      top: dimensions.top + 10,
      bottom: dimensions.top + 10 + height,
    };
  };
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = () => {};
  const listeners = [];
  const add = canvas.addEventListener.bind(canvas);
  const remove = canvas.removeEventListener.bind(canvas);
  canvas.addEventListener = (type, callback, options) => {
    listeners.push({ type, callback });
    add(type, callback, options);
  };
  canvas.removeEventListener = (type, callback, options) => {
    const index = listeners.findIndex(
      (entry) => entry.type === type && entry.callback === callback,
    );
    if (index >= 0) listeners.splice(index, 1);
    remove(type, callback, options);
  };
  window.eval(bundle.outputFiles[0].text);
  const picks = [];
  const model = window.reviewModel.createModel(
    canvas,
    (hit) => picks.push(hit),
    configuration,
  );
  context.after(() => {
    model.dispose();
    window.close();
  });
  function touch(type, touches, changedTouches = touches) {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      touches: { value: touches },
      changedTouches: { value: changedTouches },
    });
    canvas.dispatchEvent(event);
    return event;
  }
  return {
    model,
    canvas,
    toolbar,
    window,
    picks,
    shadowRenders,
    frames,
    listeners,
    touch,
    get clearColor() {
      return clearColor;
    },
    get shadowCount() {
      return shadowCount;
    },
    get labelMeasurements() {
      return labelMeasurements;
    },
    get intersectionDisconnected() {
      return intersectionDisconnected;
    },
    intersect(visible) {
      intersectionCallback([{ isIntersecting: visible }]);
    },
    pageVisible(visible) {
      Object.defineProperty(window.document, "hidden", {
        configurable: true,
        value: !visible,
      });
      window.document.dispatchEvent(new window.Event("visibilitychange"));
    },
    get resizeCount() {
      return resizeCount;
    },
    get renderCount() {
      return renderCount;
    },
    tick() {
      time += 16;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(time));
    },
    settle() {
      for (let i = 0; frames.size && i < 300; i++) this.tick();
      assert.equal(frames.size, 0, "rendering must become idle");
    },
    resize(width, height) {
      dimensions = { ...dimensions, width, height };
      resizeCallback();
    },
  };
}

test("builds a fictional studio and updates fixture lights without hardcoded homes", (context) => {
  const view = setup(context);
  const { model } = view;
  model.update({
    "light.example_lamp": { state: "on", attributes: { brightness: 128 } },
    "sensor.example_temperature": {
      state: "0",
      attributes: { unit_of_measurement: "°C" },
    },
  });
  view.settle();
  const lights = [];
  model.scene.traverse((o) => {
    if (o.isPointLight) lights.push(o);
  });
  assert.equal(lights.length, 1);
  assert(lights[0].intensity > 0);
  assert(lights[0].intensity < 6);
  assert.equal(model.stats().rooms, 1);
  assert.equal(
    view.window.document.querySelector(
      '[data-sensor="sensor.example_temperature"] .badge-temp',
    ).textContent,
    "0.0°C",
  );
});
test("hidden and zero-size views resume with finite camera and no duplicate render loops", (context) => {
  const view = setup(context);
  view.settle();
  view.resize(0, 0);
  assert.equal(view.frames.size, 0);
  view.resize(320, 480);
  view.settle();
  assert(view.model.camera.position.toArray().every(Number.isFinite));
  view.intersect(false);
  view.model.update({ "light.example_lamp": { state: "on" } });
  assert.equal(view.frames.size, 0);
  view.intersect(true);
  assert(view.frames.size > 0);
  view.settle();
  view.pageVisible(false);
  view.model.focus("Studio", false);
  assert.equal(view.frames.size, 0);
  view.pageVisible(true);
  view.settle();
});
test("label-only changes avoid WebGL and active light shadows remain cached", (context) => {
  const view = setup(context);
  const states = {
    "light.example_lamp": { state: "on", attributes: { brightness: 128 } },
    "sensor.example_temperature": { state: "20" },
  };
  view.model.update(states);
  view.settle();
  const renders = view.renderCount,
    shadows = view.shadowCount;
  view.model.update({
    ...states,
    "sensor.example_temperature": { state: "21" },
  });
  view.settle();
  assert.equal(view.renderCount, renders);
  assert.equal(view.shadowCount, shadows);
  view.model.update({
    ...states,
    "light.example_lamp": {
      state: "on",
      attributes: { brightness: 200, rgb_color: [0, 0, 255] },
    },
  });
  view.settle();
  assert(view.renderCount > renders);
  assert.equal(view.shadowCount, shadows);
});
test("disposal is idempotent and removes canvas listeners, labels and scheduled frames", (context) => {
  const view = setup(context);
  view.model.dispose();
  view.model.dispose();
  assert.equal(view.listeners.length, 0);
  assert.equal(view.frames.size, 0);
  assert.equal(view.intersectionDisconnected, true);
  assert.equal(view.window.document.querySelector(".sensor-badges"), null);
});
test("sun samples once and below-horizon daylight never fabricates direct sunlight", (context) => {
  const view = setup(context);
  view.model.initializeSun({
    state: "above_horizon",
    attributes: { azimuth: 90, elevation: 30 },
  });
  const light = view.model.scene.children.find((o) => o.isDirectionalLight),
    initial = light.position.clone();
  view.model.initializeSun({
    state: "above_horizon",
    attributes: { azimuth: 180, elevation: 60 },
  });
  assert(light.position.equals(initial));
  view.model.setDaylight(0);
  view.model.setDaylight(1);
  assert(light.position.equals(initial));
});

test("sun lighting changes intensity without changing the transparent background", (context) => {
  const view = setup(context);
  const sun = view.model.scene.children.find((o) => o.isDirectionalLight);
  const ambient = view.model.scene.children.find((o) => o.isHemisphereLight);
  const background = view.clearColor;
  assert.deepEqual(background, [0, 0]);
  view.model.initializeSun({
    state: "below_horizon",
    attributes: { azimuth: 90, elevation: -20 },
  });
  view.model.setDaylight(0);
  assert.equal(sun.intensity, 0);
  const nightAmbient = ambient.intensity;
  view.model.setDaylight(0.5);
  assert.equal(sun.intensity, 1.1);
  assert(ambient.intensity > nightAmbient);
  view.model.setDaylight(1);
  assert.equal(sun.intensity, 2.2);
  assert.deepEqual(view.clearColor, background);
});
