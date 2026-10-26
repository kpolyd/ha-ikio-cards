import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom, Card, adapter, normalize;
before(async () => {
  dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost" });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  ({ IkioLightsCard: Card } = await import("../src/card.js"));
  adapter = await import("../src/adapter.js");
  ({ normalizeConfig: normalize } = await import("../src/config.js"));
  customElements.define("ikio-lights-card", Card);
});
after(() => dom.window.close());
const light = (state = "on", brightness = 102, modes = ["brightness"]) => ({
  entity_id: "light.strip",
  state,
  attributes: {
    friendly_name: "Ceiling strip",
    brightness,
    supported_color_modes: modes,
  },
});
function fixture(states, config = { lights: [{ entity: "light.strip" }] }) {
  const calls = [];
  const card = document.createElement("ikio-lights-card");
  document.body.append(card);
  card.setConfig(config);
  card.hass = {
    states,
    callService: async (...args) => {
      calls.push(args);
    },
  };
  return { card, calls };
}
test("power-only state follows on/off and never brightness or RGB zero", () => {
  assert.equal(
    adapter.lightState(light("on", 0, ["onoff"]), { control_mode: "auto" })
      .status,
    "On",
  );
  const { card } = fixture(
    { "light.strip": light("on", 0, ["rgb"]) },
    { lights: [{ entity: "light.strip", control_mode: "power-only" }] },
  );
  assert.equal(card.shadowRoot.querySelector("input"), null);
  assert.equal(
    card.shadowRoot.querySelector(".location").textContent,
    "No area assigned",
  );
  assert.equal(
    card.shadowRoot.querySelector(".toggle").getAttribute("aria-pressed"),
    "true",
  );
  card.remove();
});
test("switches do not gain sliders and invoke the switch domain", async () => {
  const { card, calls } = fixture(
    {
      "switch.strip": {
        entity_id: "switch.strip",
        state: "off",
        attributes: {},
      },
    },
    { lights: [{ entity: "switch.strip" }] },
  );
  card.shadowRoot.querySelector(".toggle").click();
  await Promise.resolve();
  assert.deepEqual(calls, [
    ["switch", "turn_on", { entity_id: "switch.strip" }],
  ]);
  assert.equal(card.shadowRoot.querySelector("input"), null);
  card.remove();
});
test("location comes from entity area before device area, with optional override", () => {
  const { card } = fixture({ "light.strip": light() });
  card.hass = {
    ...card.hass,
    entities: { "light.strip": { device_id: "lamp", area_id: "office" } },
    devices: { lamp: { area_id: "living" } },
    areas: { office: { name: "Office" }, living: { name: "Living room" } },
  };
  assert.equal(
    card.shadowRoot.querySelector(".location").textContent,
    "Office",
  );
  card.hass = {
    ...card.hass,
    entities: { "light.strip": { device_id: "lamp" } },
  };
  assert.equal(
    card.shadowRoot.querySelector(".location").textContent,
    "Living room",
  );
  card.setConfig({ lights: [{ entity: "light.strip", location: "Balcony" }] });
  assert.equal(
    card.shadowRoot.querySelector(".location").textContent,
    "Balcony",
  );
  assert.equal(card.shadowRoot.querySelector("input"), null);
  card.remove();
});
test("hold opens native details and prevents toggle", async () => {
  const { card, calls } = fixture({ "light.strip": light() });
  let detail;
  card.addEventListener("hass-more-info", (e) => {
    detail = e.detail;
  });
  const button = card.shadowRoot.querySelector(".toggle");
  button.dispatchEvent(new dom.window.MouseEvent("pointerdown"));
  await new Promise((r) => setTimeout(r, 570));
  button.click();
  assert.deepEqual(detail, { entityId: "light.strip" });
  assert.equal(calls.length, 0);
  card.remove();
});
test("unavailable and preview controls cannot send commands", async () => {
  const { card, calls } = fixture({ "light.strip": light("unavailable") });
  await card.toggle({ entity: "light.strip" });
  assert.equal(calls.length, 0);
  card.hass = { ...card.hass, states: { "light.strip": light() } };
  card.preview = true;
  await card.toggle({ entity: "light.strip" });
  assert.equal(calls.length, 0);
  card.remove();
});
test("remapping ignores late rejected commands from the old entity", async () => {
  const { card } = fixture({ "light.strip": light() });
  let reject;
  card.hass.callService = () =>
    new Promise((_, r) => {
      reject = r;
    });
  const request = card.toggle({ entity: "light.strip" });
  card.setConfig({ lights: [{ entity: "switch.other" }] });
  reject(new Error("old request failure"));
  await request;
  assert.equal(card.shadowRoot.querySelector(".error").textContent, "");
  assert.equal(card.pending.size, 0);
  card.remove();
});
test("registry updates refresh location without replacing the toggle", () => {
  const { card } = fixture({ "light.strip": light() });
  const button = card.shadowRoot.querySelector(".toggle");
  card.hass = {
    ...card.hass,
    entities: { "light.strip": { area_id: "room" } },
    areas: { room: { name: "Bedroom" } },
  };
  assert.equal(card.shadowRoot.querySelector(".toggle"), button);
  assert.equal(
    card.shadowRoot.querySelector(".location").textContent,
    "Bedroom",
  );
  card.remove();
});
test("configuration rejects invalid domains and duplicates without mutating incoming values", () => {
  const config = {
    lights: ["light.strip"],
    grid_options: { columns: 6 },
    appearance: { theme: "ha" },
  };
  const result = normalize(config);
  assert.equal(config.lights[0], "light.strip");
  assert.deepEqual(result.grid_options, { columns: 6 });
  assert.throws(() => normalize({ lights: ["sensor.temperature"] }));
  assert.throws(() => normalize({ lights: ["light.strip", "light.strip"] }));
  assert.throws(() => normalize({ schema_version: 5 }));
});
test("service failures remain visible", async () => {
  const { card } = fixture({ "light.strip": light() });
  card.hass.callService = async () => {
    throw new Error("Device rejected request");
  };
  await card.toggle({ entity: "light.strip" });
  assert.match(
    card.shadowRoot.querySelector(".error").textContent,
    /Device rejected/,
  );
  assert.equal(card.pending.size, 0);
  card.remove();
});

test("a late rejection cannot clear a newer action for the same entity", async () => {
  const { card } = fixture({ "light.strip": light("off") });
  let rejectOld;
  card.hass.callService = () =>
    new Promise((_, reject) => {
      rejectOld = reject;
    });
  const old = card.toggle({ entity: "light.strip" });
  card.hass = { ...card.hass, states: { "light.strip": light("on") } };
  card.hass.callService = async () => {};
  const next = card.toggle({ entity: "light.strip" });
  rejectOld(new Error("late failure"));
  await old;
  await next;
  assert.equal(card.pending.size, 1);
  assert.equal(card.error.textContent, "");
  card.remove();
});

test("configured heading renders text rather than the native host title property", () => {
  const { card } = fixture(
    { "light.strip": light() },
    { name: "Living room lights", lights: [{ entity: "light.strip" }] },
  );
  assert.equal(
    card.shadowRoot.querySelector("h2").textContent,
    "Living room lights",
  );
  assert.equal(card.shadowRoot.textContent.includes("[object HTML"), false);
  card.remove();
});

test("grouping packs 3, 2+1 and 1+1+1 without reordering configured areas", () => {
  const counts = [3, 2, 1, 1, 1, 1];
  const lights = counts.flatMap((count, area) =>
    Array.from({ length: count }, (_, i) => ({
      entity: `light.area_${area}_${i}`,
      location: `Area ${area}`,
    })),
  );
  const packed = adapter.groupLights(lights, {});
  assert.deepEqual(
    packed.map((row) => row.map((group) => group.lights.length)),
    [[3], [2, 1], [1, 1, 1]],
  );
  assert.deepEqual(
    packed.flat().map((group) => group.location),
    counts.map((_, i) => `Area ${i}`),
  );
  const interleaved = [
    lights[0],
    lights[3],
    lights[1],
    lights[2],
    ...lights.slice(4),
  ];
  assert.deepEqual(adapter.groupLights(interleaved, {}).flat()[0].lights, [
    lights[0],
    lights[1],
    lights[2],
  ]);
});

test("larger areas wrap independently and empty grouping produces no sections", () => {
  const lights = [0, 1, 2, 3].map((i) => ({
    entity: `light.room_${i}`,
    location: "Room",
  }));
  const packed = adapter.groupLights(
    [...lights, { entity: "light.other", location: "Other" }],
    {},
  );
  assert.deepEqual(
    packed.map((row) => row.map((g) => [g.columns, g.lights.length])),
    [[[3, 4]], [[1, 1]]],
  );
  assert.deepEqual(adapter.groupLights([], {}), []);
});

test("grouped card hides repeated area labels, retains offline status and updates counts without replacing controls", () => {
  const { card } = fixture(
    {
      "light.strip": light(),
      "switch.other": { state: "unavailable", attributes: {} },
    },
    {
      group_by_location: true,
      lights: [
        { entity: "light.strip", location: "Kitchen" },
        { entity: "switch.other", location: "Kitchen" },
      ],
    },
  );
  const button = card.rows[0].toggle;
  button.focus();
  assert.equal(card.shadowRoot.querySelector("h3").textContent, "Kitchen");
  assert.equal(
    card.shadowRoot.querySelector(".area-count").textContent,
    "1/2 on",
  );
  assert.equal(card.rows[0].location.hidden, true);
  assert.equal(card.rows[1].location.hidden, false);
  assert.match(card.rows[1].location.textContent, /unavailable/i);
  assert.equal(card.rows[1].toggle.disabled, true);
  const section = card.shadowRoot.querySelector(".area-group");
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      "switch.other": { state: "on", attributes: {} },
    },
  };
  assert.equal(
    card.shadowRoot.querySelector(".area-count").textContent,
    "2/2 on",
  );
  assert.equal(card.shadowRoot.querySelector(".area-group"), section);
  assert.equal(card.rows[0].toggle, button);
  assert.equal(card.shadowRoot.activeElement, button);
  card.remove();
});

test("area registry changes regroup existing controls and preserve native hold behaviour", async () => {
  const { card, calls } = fixture(
    { "light.strip": light() },
    { group_by_location: true, lights: ["light.strip"] },
  );
  assert.equal(card.shadowRoot.querySelector("h3").textContent, "Unassigned");
  const button = card.rows[0].toggle;
  button.focus();
  card.hass = {
    ...card.hass,
    entities: { "light.strip": { device_id: "strip" } },
    devices: { strip: { area_id: "office" } },
    areas: { office: { name: "Office" } },
  };
  assert.equal(card.shadowRoot.querySelector("h3").textContent, "Office");
  assert.equal(card.rows[0].toggle, button);
  assert.equal(card.shadowRoot.activeElement, button);
  assert.equal(card.shadowRoot.querySelector(".area-count").hidden, true);
  let detail;
  card.addEventListener("hass-more-info", (e) => {
    detail = e.detail;
  });
  button.dispatchEvent(new dom.window.MouseEvent("pointerdown"));
  await new Promise((r) => setTimeout(r, 570));
  button.click();
  assert.deepEqual(detail, { entityId: "light.strip" });
  assert.equal(calls.length, 0);
  card.remove();
});

test("grouping is opt-in and config changes can restore the flat location labels", () => {
  assert.equal(normalize({ lights: [] }).group_by_location, false);
  assert.throws(() => normalize({ group_by_location: "true" }), /toggle/);
  const { card } = fixture(
    { "light.strip": light() },
    { lights: [{ entity: "light.strip", location: "Office" }] },
  );
  assert.equal(card.shadowRoot.querySelector(".area-group"), null);
  card.setConfig({ ...card.config, group_by_location: true });
  assert.equal(card.shadowRoot.querySelector("h3").textContent, "Office");
  card.setConfig({ ...card.config, group_by_location: false });
  assert.equal(card.shadowRoot.querySelector(".area-group"), null);
  assert.equal(card.rows[0].location.hidden, false);
  assert.equal(card.rows[0].location.textContent, "Office");
  card.remove();
});

test("reconnecting a grouped card rebuilds working controls without duplicates", async () => {
  const { card, calls } = fixture(
    { "light.strip": light("off") },
    { group_by_location: true, lights: ["light.strip"] },
  );
  card.remove();
  document.body.append(card);
  assert.equal(card.shadowRoot.querySelectorAll(".toggle").length, 1);
  card.rows[0].toggle.click();
  await Promise.resolve();
  assert.deepEqual(calls, [["light", "turn_on", { entity_id: "light.strip" }]]);
  card.remove();
});
