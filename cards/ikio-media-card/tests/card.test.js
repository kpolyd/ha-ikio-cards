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
  const Card = customElements.get("ikio-media-card");
  const card = document.createElement("ikio-media-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-media-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-media-card");
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

test("media capabilities gate icons and zero volume remains valid", async () => {
  const { transport, position } = await import("../src/adapter.js");
  assert.equal(
    transport({ state: "playing", attributes: { supported_features: 1 } })[0]
      .service,
    "media_pause",
  );
  assert.equal(
    transport({ state: "paused", attributes: { supported_features: 16384 } })[0]
      .service,
    "media_play",
  );
  assert.deepEqual(
    transport({ state: "idle", attributes: { supported_features: 0 } }),
    [],
  );
  assert.equal(
    position({
      state: "playing",
      attributes: { media_position: 0, media_duration: 0 },
    }),
    null,
  );
  const card = document.createElement("ikio-media-card");
  document.body.append(card);
  card.setConfig({ entity: "media_player.tv" });
  card.hass = {
    states: {
      "media_player.tv": {
        entity_id: "media_player.tv",
        state: "paused",
        attributes: { supported_features: 4 | 16384, volume_level: 0 },
      },
    },
  };
  assert.equal(card.shadowRoot.querySelector("input").value, "0");
  assert.ok(card.shadowRoot.querySelector('[aria-label="Play"] ha-icon'));
  card.remove();
});
