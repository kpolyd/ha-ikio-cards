import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom;
before(async () => {
  dom = new JSDOM("<body></body>", { url: "http://localhost" });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  customElements.define("ha-form", class extends HTMLElement {});
  await import("../src/index.js");
});
after(() => dom.window.close());
test("card registers and safely renders an empty visual-editor stub", () => {
  const Card = customElements.get("ikio-camera-card");
  const card = document.createElement("ikio-camera-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-camera-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-camera-card");
  const editor = await Card.getConfigElement();
  const config = {
    ...Card.getStubConfig(),
    grid_options: { columns: 6 },
    visibility: [{ condition: "user", users: ["owner"] }],
  };
  editor.setConfig(config);
  editor.hass = { states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const forms = editor.shadowRoot.querySelectorAll("ha-form");
  assert.ok(forms.length >= 2);
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  forms[0].dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...forms[0].data, name: "Changed" } },
    }),
  );
  assert.equal(saved.name, "Changed");
  assert.deepEqual(saved.grid_options, config.grid_options);
  assert.deepEqual(saved.visibility, config.visibility);
  assert.equal(config.name, undefined);
  editor.setConfig(saved);
  assert.equal(editor.shadowRoot.querySelector("ha-form").data.name, "Changed");
  editor.remove();
});

test("camera rendering never starts a stream or powers a device without a click", async () => {
  let calls = 0;
  window.loadCardHelpers = async () => {
    calls++;
    return {};
  };
  const card = document.createElement("ikio-camera-card");
  document.body.append(card);
  card.setConfig({ entity: "camera.room", power_switch: "switch.camera" });
  card.hass = {
    states: {
      "camera.room": {
        entity_id: "camera.room",
        state: "unavailable",
        attributes: {},
      },
      "switch.camera": {
        entity_id: "switch.camera",
        state: "off",
        attributes: {},
      },
    },
    callService: async () => calls++,
  };
  assert.ok(card.shadowRoot.textContent.includes("Camera power is off"));
  assert.equal(calls, 0);
  assert.equal(
    card.shadowRoot.querySelector('[aria-label="Open live view"]').disabled,
    true,
  );
  card.remove();
});

test("camera native player is mounted on demand and disposed when hidden or remapped", async () => {
  const card = document.createElement("ikio-camera-card");
  document.body.append(card);
  card.setConfig({ entity: "camera.room" });
  card.hass = {
    states: {
      "camera.room": {
        entity_id: "camera.room",
        state: "idle",
        attributes: {},
      },
    },
  };
  let player;
  window.loadCardHelpers = async () => ({
    createCardElement: async () => {
      player = document.createElement("div");
      return player;
    },
  });
  card.visible = true;
  await card.openFeed();
  assert.equal(card.live, true);
  assert.ok(card.shadowRoot.contains(player));
  card.visible = false;
  card.onVisibility();
  assert.equal(card.live, false);
  assert.equal(player.isConnected, false);
  card.remove();
});

test("on-demand camera loading times out and a late helper cannot revive an obsolete request", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const card = document.createElement("ikio-camera-card");
  card.setConfig({ entity: "camera.test" });
  card.hass = {
    states: {
      "camera.test": {
        entity_id: "camera.test",
        state: "idle",
        attributes: {},
      },
    },
  };
  document.body.append(card);
  card.visible = true;
  let resolveHelpers,
    created = 0;
  window.loadCardHelpers = () =>
    new Promise((resolve) => (resolveHelpers = resolve));
  const loading = card.openFeed();
  assert.equal(card.loadingFeed, true);
  t.mock.timers.tick(8000);
  await loading;
  assert.equal(card.loadingFeed, false);
  assert.match(card.error.textContent, /too long/);
  resolveHelpers({
    createCardElement: async () => {
      created++;
      return document.createElement("div");
    },
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(created, 0);
  assert.equal(card.live, false);
  window.loadCardHelpers = async () => ({
    createCardElement: async () => document.createElement("div"),
  });
  await card.openFeed();
  assert.equal(card.live, true);
  card.visible = false;
  card.onVisibility();
  assert.equal(card.live, false);
  card.remove();
});
