import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { resolveConfiguration } from "../src/resolve-configuration.js";
import { home, inventory, devices } from "./fixtures/studio.js";
let dom, loadConfiguration, configurationUrl, Card;
before(async () => {
  dom = new JSDOM("<body/>", {
    url: "https://ha.example/dashboard",
    pretendToBeVisual: true,
  });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  customElements.define("ha-form", class extends HTMLElement {});
  ({ loadConfiguration } = await import("../src/load-configuration.js"));
  ({ configurationUrl } = await import("../src/config.js"));
  await import("../src/index.js");
  Card = customElements.get("ikio-home-3d-card");
});
after(() => dom.window.close());
const config = {
  home_model: "/local/home.json",
  entity_inventory: "/local/entities.json",
  device_bindings: "/local/bindings.json",
};
const definitions = [home, inventory, devices];
const copy = (value) => structuredClone(value);
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

test("generic studio resolves references without modifying the three inputs", () => {
  const inputs = copy(definitions),
    result = resolveConfiguration(...inputs);
  assert.equal(result.home.name, "Example studio");
  assert.equal(result.entities[3].humidity, "sensor.example_humidity");
  assert.equal(result.bindings[0].entity, "light.example_lamp");
  assert.deepEqual(inputs, definitions);
  for (const mutate of [
    ([h]) => h.objects.push(copy(h.objects[0])),
    ([, i]) => i.push(copy(i[0])),
    ([, , d]) => (d.labels[0].humidity = "absent"),
    ([, , d]) => (d.scene[0].object = "absent"),
    ([, , d]) => d.groups.push({ members: ["absent"] }),
    ([h]) => (h.rooms.Overview = [NaN, 0]),
    ([h]) => (h.objects[0].kind = "unknown"),
  ]) {
    const values = copy(definitions);
    mutate(values);
    assert.throws(() => resolveConfiguration(...values));
  }
});
test("loads exactly three JSON files with same-origin credentials and no-store atomically", async () => {
  const calls = [];
  const result = await loadConfiguration(config, {
    base: "https://ha.example/lovelace",
    fetcher: async (url, options) => {
      calls.push({ url, options });
      const index = calls.length - 1;
      return { ok: true, json: async () => definitions[index] };
    },
  });
  assert.equal(result.entities.length, inventory.length);
  assert.equal(calls.length, 3);
  for (const { url, options } of calls) {
    assert.match(url, /^https:\/\/ha.example\/local\//);
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
  }
});
test("rejects foreign origins and executable URLs without issuing a request", async () => {
  for (const value of [
    "https://other.example/home.json",
    "javascript:alert(1)",
    "https://user:pass@ha.example/data",
    "/local/data#fragment",
  ]) {
    assert.throws(() => configurationUrl(value, "https://ha.example/lovelace"));
  }
  let requested = 0;
  await assert.rejects(
    loadConfiguration(
      { ...config, home_model: "https://other.example/home.json" },
      {
        base: "https://ha.example/",
        fetcher: async () => {
          requested++;
          return { ok: true, json: async () => ({}) };
        },
      },
    ),
  );
  // All file URLs are validated before any requests start.
  assert.equal(requested, 0);
});
test("HTTP, JSON and schema failures identify the file without exposing its contents", async () => {
  for (const fetcher of [
    async () => ({ ok: false, status: 404 }),
    async () => ({
      ok: true,
      json: async () => {
        throw Error("private body");
      },
    }),
  ])
    await assert.rejects(
      loadConfiguration(config, { base: "https://ha.example/", fetcher }),
      (error) =>
        error.key !== undefined && !error.message.includes("private body"),
    );
  await assert.rejects(
    loadConfiguration(config, {
      base: "https://ha.example/",
      fetcher: async () => ({ ok: true, json: async () => ({}) }),
    }),
    (error) => error.key === "schema",
  );
});
function fixture() {
  const c = new Card();
  c.hass = { states: {}, locale: { language: "en" } };
  c.setConfig(Card.getStubConfig());
  document.body.append(c);
  return c;
}
function fakeFactory(canvas, onPick, configuration, initial) {
  return {
    canvas,
    onPick,
    configuration,
    initial,
    focus() {},
    setDaylight() {},
    setWalls() {},
    initializeSun() {},
    update() {},
    dispose() {
      this.disposed = true;
    },
  };
}
test("empty and partial configuration never load a personal default or initialize WebGL", () => {
  const c = fixture();
  assert.equal(c.model, null);
  assert.match(c.statusText.textContent, /three/);
  c.setConfig({ home_model: "/local/home.json" });
  assert.equal(c.loading, false);
  assert.equal(c.configuration, null);
  assert.equal(c.shadowRoot.querySelector("canvas"), null);
  c.remove();
});
test("mounting preserves view controls, uses file inventory, and details never issue commands", () => {
  const c = fixture();
  c.configuration = resolveConfiguration(...copy(definitions));
  c.createModel = fakeFactory;
  c.mount();
  const model = c.model;
  assert.equal(c.roomSelect.options.length, 2);
  assert.equal(c.top, true);
  assert.equal(c.walls, true);
  assert.equal(
    c.shadowRoot.querySelector('select[aria-label="Colour theme"]'),
    null,
  );
  let target;
  c.addEventListener("hass-more-info", (e) => (target = e.detail));
  model.onPick({ badgeEntity: "light.example_lamp" });
  assert.deepEqual(target, { entityId: "light.example_lamp" });
  c.topButton.click();
  assert.equal(c.top, false);
  c.wallsButton.click();
  assert.equal(c.walls, false);
  c.resetButton.click();
  assert.equal(c.top, true);
  assert.equal(c.room, "Overview");
  c.hass = { states: {}, locale: { language: "el-GR" } };
  assert.match(c.topButton.textContent, /Κάτοψη/);
  assert.equal(c.roomSelect.options[1].textContent, "Studio");
  c.remove();
  assert.equal(model.disposed, true);
  document.body.append(c);
  assert.ok(c.model);
  assert.notEqual(c.model, model);
  c.remove();
});
test("remapping or disconnect aborts all requests and late results cannot create a scene", async () => {
  const c = fixture();
  const requests = [];
  const original = window.fetch;
  window.fetch = (url, options) =>
    new Promise((resolve) => requests.push({ url, options, resolve }));
  c.setConfig(config);
  assert.equal(requests.length, 3);
  c.setConfig({ ...config, home_model: "/local/new-home.json" });
  assert.equal(requests.length, 6);
  assert.equal(requests[0].options.signal.aborted, true);
  for (const [i, r] of requests.slice(0, 3).entries())
    r.resolve({ ok: true, json: async () => definitions[i] });
  await flush();
  assert.equal(c.configuration, null);
  c.remove();
  assert.equal(requests[3].options.signal.aborted, true);
  for (const [i, r] of requests.slice(3).entries())
    r.resolve({ ok: true, json: async () => definitions[i] });
  await flush();
  assert.equal(c.model, null);
  window.fetch = original;
});
test("timeout is bounded, aborts requests and offers a recoverable retry", async (context) => {
  const c = fixture();
  const original = window.fetch;
  window.fetch = async () => new Promise(() => {});
  context.mock.timers.enable({ apis: ["setTimeout"] });
  c.setConfig(config);
  assert.equal(c.loading, true);
  context.mock.timers.tick(15001);
  assert.equal(c.loading, false);
  assert.equal(c.controller.signal.aborted, true);
  assert.match(c.statusText.textContent, /timed out/);
  assert.equal(c.retry.hidden, false);
  c.retry.click();
  assert.equal(c.loading, true);
  c.remove();
  context.mock.timers.reset();
  window.fetch = original;
});
test("visual editor exposes the three file fields and preserves HA metadata", async () => {
  const editor = await Card.getConfigElement();
  editor.setConfig({ ...config, view_layout: { column: 2 } });
  editor.hass = { locale: { language: "en" } };
  document.body.append(editor);
  await flush();
  const form = editor.shadowRoot.querySelector("ha-form");
  assert.deepEqual(
    form.schema.map((f) => f.name),
    Object.keys(config),
  );
  let changed;
  editor.addEventListener("config-changed", (e) => (changed = e.detail.config));
  form.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...form.data, home_model: "/local/edited.json" } },
    }),
  );
  assert.equal(changed.home_model, "/local/edited.json");
  assert.deepEqual(changed.view_layout, { column: 2 });
  editor.remove();
});

test("standard appearance options are independent of solar lighting and preserve the loaded model", async () => {
  const c = fixture();
  c.configuration = resolveConfiguration(...copy(definitions));
  c.createModel = fakeFactory;
  c.mount();
  const model = c.model;
  for (const theme of ["dark", "light", "ha"]) {
    c.setConfig({ ...Card.getStubConfig(), appearance: { theme } });
    assert.equal(c.getAttribute("appearance"), theme);
    assert.equal(c.model, model);
    c.hass = {
      states: {
        "sun.sun": { state: "above_horizon", attributes: { elevation: 30 } },
      },
    };
    assert.equal(c.daylight, 1);
    c.hass = {
      states: {
        "sun.sun": { state: "below_horizon", attributes: { elevation: -20 } },
      },
    };
    assert.equal(c.daylight, 0);
    assert.equal(c.getAttribute("appearance"), theme);
  }
  c.remove();
  const editor = await Card.getConfigElement();
  editor.setConfig(config);
  document.body.append(editor);
  await flush();
  const appearance = editor.shadowRoot.querySelectorAll("ha-form")[1];
  assert.deepEqual(
    appearance.schema[0].selector.select.options.map((o) => o.value),
    ["dark", "light", "ha"],
  );
  let changed;
  editor.addEventListener("config-changed", (e) => (changed = e.detail.config));
  appearance.dispatchEvent(
    new CustomEvent("value-changed", { detail: { value: { theme: "light" } } }),
  );
  assert.equal(changed.appearance.theme, "light");
  assert.equal(changed.home_model, config.home_model);
  editor.remove();
});
