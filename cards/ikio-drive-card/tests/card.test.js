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
  const Card = customElements.get("ikio-drive-card");
  const card = document.createElement("ikio-drive-card");
  document.body.append(card);
  card.setConfig(Card.getStubConfig());
  card.hass = { states: {} };
  assert.ok(card.shadowRoot.textContent.length > 0);
  assert.ok(window.customCards.some((c) => c.type === "ikio-drive-card"));
  card.remove();
});
test("every schema field and repeating list has a visual editor and preserves HA metadata", async () => {
  const Card = customElements.get("ikio-drive-card");
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

test("car summaries never claim secure when some sensors are unknown", async () => {
  const { aggregate, mapUrl, fuelPercent } = await import("../src/adapter.js");
  assert.equal(aggregate([{ state: "on" }, undefined]), "Open");
  assert.equal(aggregate([{ state: "off" }, undefined]), "Unknown");
  assert.equal(aggregate([]), "Not configured");
  assert.equal(
    aggregate([{ state: "locked" }], "unlocked", "locked"),
    "Closed",
  );
  assert.equal(mapUrl({ attributes: { latitude: 91, longitude: 0 } }), null);
  assert.match(
    mapUrl({ attributes: { latitude: 38, longitude: 23 } }),
    /query=38%2C23/,
  );
  assert.equal(
    fuelPercent({ state: "86", attributes: { unit_of_measurement: "%" } }),
    86,
  );
  assert.equal(
    fuelPercent({ state: "86", attributes: { unit_of_measurement: "L" } }),
    null,
  );
});

test("map navigation is an unboxed text link in the parking row", () => {
  const card = document.createElement("ikio-drive-card");
  document.body.append(card);
  card.setConfig({ tracker_entity: "device_tracker.car" });
  card.hass = {
    states: {
      "device_tracker.car": {
        entity_id: "device_tracker.car",
        state: "home",
        attributes: { latitude: 38, longitude: 23 },
        last_updated: new Date().toISOString(),
      },
    },
  };
  const link = card.shadowRoot.querySelector("a");
  assert.equal(link.textContent, "Open location in maps");
  assert.equal(link.classList.contains("ae-button"), false);
  assert.match(link.href, /google.com\/maps/);
  assert.ok(link.parentElement.textContent.includes("Parking"));
  card.remove();
});

test("automatic lock summaries handle native locks and binary locks, including legacy defaults", async () => {
  const { locksSummary } = await import("../src/adapter.js");
  const lock = (id, state) => ({
    entity_id: id,
    state,
    attributes: { device_class: "lock" },
  });
  assert.equal(locksSummary([lock("binary_sensor.car_lock", "off")]), "Locked");
  assert.equal(
    locksSummary([lock("binary_sensor.car_lock", "on")]),
    "Unlocked",
  );
  assert.equal(
    locksSummary([lock("binary_sensor.car_lock", "off")], "unlocked"),
    "Locked",
  );
  assert.equal(
    locksSummary([
      lock("lock.car", "locked"),
      lock("binary_sensor.rear_lock", "off"),
    ]),
    "Locked",
  );
  assert.equal(
    locksSummary([
      lock("lock.car", "locked"),
      lock("binary_sensor.rear_lock", "on"),
    ]),
    "Unlocked",
  );
  assert.equal(locksSummary([lock("sensor.car_lock", " Locked ")]), "Locked");
  assert.equal(
    locksSummary([lock("binary_sensor.car_lock", "on")], "off"),
    "Locked",
  );
  assert.equal(
    locksSummary([lock("binary_sensor.car_lock", "off")], "off"),
    "Unlocked",
  );
});
test("lock aggregation distinguishes missing data and never treats a closed door as locked", async () => {
  const { locksSummary } = await import("../src/adapter.js");
  const lock = (state) => ({ entity_id: "lock.car", state });
  assert.equal(locksSummary([]), "Not configured");
  assert.equal(locksSummary([undefined]), "Unavailable");
  assert.equal(locksSummary([lock("unavailable")]), "Unavailable");
  assert.equal(locksSummary([lock("unknown")]), "Unknown");
  assert.equal(locksSummary([lock("locking")]), "Locking");
  assert.equal(locksSummary([lock("unlocking")]), "Unlocking");
  assert.equal(locksSummary([lock("jammed")]), "Jammed");
  assert.equal(locksSummary([lock("open")]), "Unlocked");
  assert.equal(
    locksSummary([{ entity_id: "sensor.car_door", state: "closed" }]),
    "Unknown",
  );
  assert.equal(locksSummary([lock("unlocked"), undefined]), "Unlocked");
});
test("adding binary lock entities displays Locked/Unlocked while door/window mappings stay unchanged", () => {
  const card = document.createElement("ikio-drive-card");
  document.body.append(card);
  card.setConfig({
    locks_active_state: "unlocked",
    locks: [{ entity: "binary_sensor.car_lock" }],
    doors: [{ entity: "binary_sensor.door" }],
    windows: [{ entity: "binary_sensor.window" }],
  });
  const states = {
    "binary_sensor.car_lock": {
      entity_id: "binary_sensor.car_lock",
      state: "off",
    },
    "binary_sensor.door": { entity_id: "binary_sensor.door", state: "off" },
    "binary_sensor.window": { entity_id: "binary_sensor.window", state: "on" },
  };
  card.hass = { states };
  const readings = () =>
    [...card.shadowRoot.querySelectorAll(".ae-reading .ae-value")].map(
      (n) => n.textContent,
    );
  assert.deepEqual(readings(), ["Locked", "Closed", "Open"]);
  card.hass = {
    states: {
      ...states,
      "binary_sensor.car_lock": {
        ...states["binary_sensor.car_lock"],
        state: "on",
      },
    },
  };
  assert.deepEqual(readings(), ["Unlocked", "Closed", "Open"]);
  card.remove();
});
