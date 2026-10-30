import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom, fields, lists, normalize, adapter;
before(async () => {
  dom = new JSDOM("<body/>", {
    url: "http://localhost",
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
  await import("../src/index.js");
  ({ fields, lists, normalize } = await import("../src/config.js"));
  adapter = await import("../src/adapter.js");
});
after(() => dom.window.close());
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function setup(config = {}, attributes = {}, state = "playing") {
  const calls = [],
    card = document.createElement("ikio-media-card");
  card.setConfig({ entity: "media_player.test", ...config });
  card.hass = {
    locale: { language: "en" },
    hassUrl: (path) => "http://localhost" + path,
    states: {
      "media_player.test": {
        entity_id: "media_player.test",
        state,
        attributes: {
          friendly_name: "Speaker",
          supported_features:
            1 | 2 | 4 | 8 | 16 | 32 | 128 | 256 | 16384 | 2048,
          media_title: "Example track",
          media_artist: "Artist",
          media_position: 84,
          media_duration: 244,
          volume_level: 0.4,
          is_volume_muted: false,
          source: "Music",
          source_list: ["Music", "TV"],
          ...attributes,
        },
      },
    },
    callService: async (...args) => calls.push(args),
  };
  document.body.append(card);
  return { card, calls };
}
function update(card, state = card.state().state, attributes = {}, extra = {}) {
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      ...extra,
      "media_player.test": {
        ...card.state(),
        state,
        attributes: { ...card.state().attributes, ...attributes },
      },
    },
  };
}
const byKey = (card, key) => card.content.querySelector(`[data-key="${key}"]`);

test("stub registers and renders a safe editor prompt", () => {
  const Card = customElements.get("ikio-media-card"),
    card = document.createElement("ikio-media-card");
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.match(card.content.textContent, /Choose a media player/);
  assert.ok(window.customCards.some((c) => c.type === "ikio-media-card"));
});
test("configuration retires More controls and legacy bindings while preserving other options and HA metadata", () => {
  const old = {
    entity: "media_player.test",
    name: "Speaker",
    appearance: { theme: "light" },
    power_entity: "sensor.power",
    more_controls: [{ entity: "light.back" }],
    show_artwork: false,
    backlight_entity: "light.back",
    shortcuts: [{ entity: "scene.movie", label: "Film" }],
    visibility: [{ condition: "user", users: ["owner"] }],
    grid_options: { columns: 6 },
  };
  const config = normalize(old);
  for (const key of [
    "more_controls",
    "show_artwork",
    "backlight_entity",
    "shortcuts",
  ])
    assert.equal(Object.hasOwn(config, key), false);
  assert.deepEqual(normalize(config), config);
  assert.equal(old.more_controls.length, 1);
  assert.equal(old.shortcuts.length, 1);
  for (const key of [
    "entity",
    "name",
    "appearance",
    "power_entity",
    "visibility",
    "grid_options",
  ])
    assert.deepEqual(config[key], old[key]);
  assert.equal(config.volume_step, 5);
});

test("editor removes the More controls list while retaining media settings, name, theme and HA metadata", async () => {
  const editor = await customElements.get("ikio-media-card").getConfigElement();
  const original = {
    entity: "media_player.test",
    more_controls: [{ entity: "scene.movie", name: "Cinema" }],
    grid_options: { columns: 6 },
  };
  editor.setConfig(original);
  editor.hass = { states: {} };
  document.body.append(editor);
  await tick();
  const forms = editor.shadowRoot.querySelectorAll("ha-form");
  assert.ok(forms.length >= 2);
  assert.deepEqual(lists, []);
  const names = [...forms].flatMap((form) => form.schema.map((f) => f.name));
  for (const field of fields) assert.ok(names.includes(field.name));
  assert.ok(names.includes("name"));
  assert.equal(editor.shadowRoot.querySelectorAll("section").length, 3);
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  forms[0].dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...forms[0].data, name: "Changed" } },
    }),
  );
  assert.equal(saved.name, "Changed");
  assert.equal(Object.hasOwn(saved, "more_controls"), false);
  assert.deepEqual(saved.grid_options, original.grid_options);
  assert.equal(original.more_controls.length, 1);
  editor.remove();
});

test("volume buttons use percentage-point steps and wait for confirmed state without optimistic values", async () => {
  const { card, calls } = setup({ volume_step: 7 });
  byKey(card, "volume-up").click();
  await tick();
  assert.deepEqual(calls[0], [
    "media_player",
    "volume_set",
    { entity_id: "media_player.test", volume_level: 0.47 },
  ]);
  assert.equal(
    card.content.querySelector(".media-volume output").textContent,
    "40%",
  );
  assert.equal(byKey(card, "volume-up").disabled, true);
  update(card, "playing", { volume_level: 0.47 });
  assert.equal(
    card.content.querySelector(".media-volume output").textContent,
    "47%",
  );
  byKey(card, "volume-down").click();
  await tick();
  assert.equal(calls[1][2].volume_level, 0.4);
  card.remove();
});
test("zero/maximum volume are real values and increments clamp to boundaries", async () => {
  const { card, calls } = setup({}, { volume_level: 0 });
  assert.equal(
    card.content.querySelector(".media-volume output").textContent,
    "0%",
  );
  assert.ok(byKey(card, "volume-down").disabled);
  update(card, "playing", { volume_level: 0.98 });
  byKey(card, "volume-up").click();
  await tick();
  assert.equal(calls[0][2].volume_level, 1);
  update(card, "playing", { volume_level: 1 });
  assert.ok(byKey(card, "volume-up").disabled);
  card.remove();
});
test("the centred speaker/percentage is the mute button and shows Muted only after confirmation", async () => {
  const { card, calls } = setup();
  byKey(card, "volume-center").click();
  await tick();
  assert.deepEqual(calls[0], [
    "media_player",
    "volume_mute",
    { entity_id: "media_player.test", is_volume_muted: true },
  ]);
  assert.equal(
    card.content.querySelector(".media-volume output").textContent,
    "40%",
  );
  update(card, "playing", { is_volume_muted: true });
  assert.equal(
    byKey(card, "volume-center").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    card.content.querySelector(".media-volume output").textContent,
    "Muted",
  );
  assert.equal(
    byKey(card, "volume-center").querySelector("ha-icon").getAttribute("icon"),
    "mdi:volume-off",
  );
  card.remove();
});
test("unknown volume is never rendered as 0 and native step-only players use volume_up/down", async () => {
  const { card, calls } = setup(
    {},
    { supported_features: 1024 | 8, volume_level: null },
  );
  assert.equal(
    card.content.querySelector(".media-volume output").textContent,
    "—",
  );
  byKey(card, "volume-up").click();
  await tick();
  assert.equal(calls[0][1], "volume_up");
  byKey(card, "volume-down").click();
  await tick();
  assert.equal(calls[1][1], "volume_down");
  card.remove();
  const unknown = setup({}, { supported_features: 4, volume_level: null }).card;
  assert.equal(
    unknown.content.querySelector(".media-volume output").textContent,
    "—",
  );
  assert.equal(byKey(unknown, "volume-up"), null);
  unknown.remove();
});
test("unsupported controls are absent, while a non-mutable known volume is read-only", () => {
  const { card } = setup({}, { supported_features: 4, volume_level: 0.2 });
  assert.equal(byKey(card, "volume-center").tagName, "DIV");
  assert.equal(
    card.content.querySelector(".media-transport").children.length,
    0,
  );
  assert.equal(card.content.querySelector("select"), null);
  assert.equal(card.content.querySelector("input"), null);
  card.remove();
  const disabled = setup({ show_volume: false, show_source: false }).card;
  assert.equal(disabled.content.querySelector(".media-controls").hidden, true);
  disabled.remove();
});
test("artwork is automatic, failure falls back, and a changed image retries without replacing the seek control", () => {
  const { card } = setup(
    { show_artwork: false },
    { entity_picture: "/art.jpg" },
  );
  assert.equal(card.config.show_artwork, undefined);
  assert.ok(card.content.querySelector(".has-art"));
  const input = card.content.querySelector("input");
  input.focus();
  card.content
    .querySelector("img")
    .dispatchEvent(new dom.window.Event("error"));
  assert.equal(card.content.querySelector(".has-art"), null);
  assert.equal(card.content.querySelector("img").hasAttribute("src"), false);
  assert.equal(card.content.querySelector("input"), input);
  assert.equal(card.shadowRoot.activeElement, input);
  update(card, "playing", { entity_picture: "/new.jpg" });
  assert.ok(card.content.querySelector(".has-art"));
  assert.match(card.content.querySelector("img").src, /new.jpg/);
  card.remove();
});
test("off hides every body row while independent watts remain beside the power button", async () => {
  const { card, calls } = setup({
    power_entity: "sensor.power",
    more_controls: [{ entity: "switch.extra", name: "Bias light" }],
  });
  update(
    card,
    "off",
    {},
    {
      "sensor.power": {
        state: "0.0016",
        attributes: { unit_of_measurement: "kW" },
      },
    },
  );
  assert.equal(card.content.querySelector(".media-now").hidden, true);
  assert.equal(card.content.querySelector(".media-controls").hidden, true);
  assert.equal(byKey(card, "player-message").hidden, true);
  assert.equal(card.content.querySelector("img").hasAttribute("src"), false);
  const group = card.content.querySelector("header .media-power-group");
  assert.equal(
    group.firstElementChild.className.includes("media-power-reading"),
    true,
  );
  assert.equal(group.lastElementChild.className.includes("media-power"), true);
  assert.match(group.textContent, /2 W/);
  assert.equal(card.content.querySelector(".media-footer"), null);
  assert.equal(card.content.querySelector("details"), null);
  let detail;
  card.addEventListener("hass-more-info", (e) => (detail = e.detail.entityId));
  group.firstElementChild.click();
  assert.equal(detail, "sensor.power");
  assert.equal(calls.length, 0);
  update(card, "unavailable");
  assert.match(byKey(card, "player-message").textContent, /Player unavailable/);
  assert.equal(card.content.querySelector(".media-power").disabled, true);
  assert.equal(group.firstElementChild.disabled, false);
  card.remove();
});

test("native source values and transport services are preserved", async () => {
  const { card, calls } = setup();
  const source = card.content.querySelector("select");
  source.value = "TV";
  source.dispatchEvent(new dom.window.Event("change"));
  await tick();
  assert.deepEqual(calls[0], [
    "media_player",
    "select_source",
    { source: "TV", entity_id: "media_player.test" },
  ]);
  update(card, "playing", { source: "TV" });
  byKey(card, "media_pause").click();
  await tick();
  assert.equal(calls[1][1], "media_pause");
  update(card, "paused");
  assert.ok(byKey(card, "media_play"));
  card.remove();
});
test("seek drafts survive position ticks/focus and send one bounded command only on commit", async () => {
  const { card, calls } = setup();
  const input = card.content.querySelector("input");
  input.focus();
  input.value = "120";
  input.dispatchEvent(new dom.window.Event("input"));
  assert.equal(calls.length, 0);
  card.update();
  assert.equal(card.content.querySelector("input"), input);
  assert.equal(input.value, "120");
  assert.match(card.content.querySelector(".media-times").textContent, /2:00/);
  input.dispatchEvent(new dom.window.Event("change"));
  await tick();
  assert.deepEqual(calls[0], [
    "media_player",
    "media_seek",
    { seek_position: 120, entity_id: "media_player.test" },
  ]);
  update(card, "playing", { media_position: 120 });
  assert.equal(card.pending.size, 0);
  card.remove();
});
test("missing position stays missing, non-seekable media shows read-only progress, and hour formatting is correct", () => {
  assert.equal(
    adapter.position({
      state: "playing",
      attributes: { media_duration: 100, media_position: null },
    }),
    null,
  );
  assert.equal(
    adapter.position({
      state: "playing",
      attributes: { media_duration: 100, media_position: "" },
    }),
    null,
  );
  assert.equal(adapter.playbackTime(3661), "1:01:01");
  const { card } = setup({}, { supported_features: 1 });
  assert.ok(card.content.querySelector("progress"));
  assert.equal(card.content.querySelector("input"), null);
  card.remove();
});
test("independent power is readable without player power capabilities and reports zero or unknown honestly", () => {
  const { card } = setup(
    {
      power_entity: "sensor.power",
      more_controls: [{ entity: "light.removed" }],
    },
    { supported_features: 0 },
  );
  update(
    card,
    "playing",
    {},
    {
      "sensor.power": { state: "0", attributes: { unit_of_measurement: "W" } },
    },
  );
  assert.equal(card.content.querySelector(".media-power"), null);
  assert.equal(
    card.content.querySelector(".media-power-reading .ae-value").textContent,
    "0 W",
  );
  assert.equal(card.content.querySelector(".media-extra"), null);
  assert.equal(card.entityIds.includes("light.removed"), false);
  update(
    card,
    "playing",
    {},
    {
      "sensor.power": {
        state: "unavailable",
        attributes: { unit_of_measurement: "W" },
      },
    },
  );
  assert.match(
    card.content.querySelector(".media-power-reading").textContent,
    /unavailable/i,
  );
  card.remove();
});

test("source focus and header wattage survive updates and language changes without commands", () => {
  const { card, calls } = setup({ power_entity: "sensor.power" });
  update(
    card,
    "playing",
    {},
    {
      "sensor.power": { state: "18", attributes: { unit_of_measurement: "W" } },
    },
  );
  const source = card.content.querySelector("select");
  source.focus();
  const reading = card.content.querySelector(".media-power-reading");
  update(card, "playing", { volume_level: 0.5 });
  assert.equal(card.content.querySelector(".media-power-reading"), reading);
  assert.equal(card.shadowRoot.activeElement, source);
  card.hass = { ...card.hass, locale: { language: "el-GR" } };
  assert.match(card.content.textContent, /Πηγή/);
  assert.equal(card.content.querySelector("details"), null);
  assert.equal(card.shadowRoot.activeElement, source);
  assert.equal(calls.length, 0);
  card.remove();
});

test("preview and action failures prevent unintended commands and preserve readable error feedback", async () => {
  const { card, calls } = setup();
  card.preview = true;
  byKey(card, "volume-up").click();
  assert.equal(calls.length, 0);
  card.preview = false;
  card.hass.callService = async () => {
    throw Error("Backend rejected command");
  };
  byKey(card, "volume-up").click();
  await tick();
  assert.match(card.error.textContent, /Backend rejected command/);
  assert.equal(card.pending.size, 0);
  card.remove();
});
test("position timers stop while hidden, in preview, after pause and after disconnect", () => {
  const { card } = setup();
  assert.ok(card.clock);
  const running = card.clock;
  card.update();
  assert.equal(card.clock, running);
  card.visible = false;
  card.onVisibility();
  assert.equal(card.clock, undefined);
  card.visible = true;
  card.onVisibility();
  assert.ok(card.clock);
  card.preview = true;
  assert.equal(card.clock, undefined);
  card.preview = false;
  assert.ok(card.clock);
  update(card, "paused");
  assert.equal(card.clock, undefined);
  update(card, "playing");
  assert.ok(card.clock);
  card.remove();
  assert.equal(card.clock, undefined);
});
test("invalid configuration is rejected and unsafe artwork schemes are excluded", () => {
  const { card } = setup();
  assert.throws(
    () => card.setConfig({ entity: "light.bad" }),
    /compatible entity/,
  );
  assert.throws(() => card.setConfig({ volume_step: 0.5 }), /permitted range/);
  assert.throws(() => card.setConfig({ volume_step: 1.5 }), /whole number/);
  card.setConfig({ more_controls: [{ entity: "sensor.retired" }] });
  assert.equal(card.config.more_controls, undefined);
  assert.equal(adapter.safeImage("javascript:alert(1)", {}), null);
  assert.equal(adapter.safeImage("data:image/svg+xml,<svg/>", {}), null);
  card.remove();
});
