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

test("parking is in the header and map navigation is an unboxed footer link", () => {
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
  assert.ok(link.parentElement.textContent.includes("Location ·"));
  assert.match(
    card.shadowRoot.querySelector(".ae-drive-header").textContent,
    /ParkingHome/,
  );
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

const driveState = (entity_id, state, attributes = {}) => ({
  entity_id,
  state: String(state),
  attributes,
});
function driveFixture(config = {}, states = {}) {
  const card = document.createElement("ikio-drive-card");
  card.setConfig(config);
  card.hass = { locale: { language: "en" }, states };
  document.body.append(card);
  return card;
}
test("all six readings have decorative icons and use two compact groups", () => {
  const card = driveFixture(
    {
      range_entity: "sensor.range",
      fuel_entity: "sensor.fuel",
      odometer_entity: "sensor.odo",
      locks: [{ entity: "lock.car" }],
      doors: [{ entity: "binary_sensor.doors" }],
      windows: [{ entity: "binary_sensor.windows" }],
    },
    {
      "sensor.range": driveState("sensor.range", 437, {
        unit_of_measurement: "km",
      }),
      "sensor.fuel": driveState("sensor.fuel", 86, {
        unit_of_measurement: "%",
      }),
      "sensor.odo": driveState("sensor.odo", 25901, {
        unit_of_measurement: "km",
      }),
      "lock.car": driveState("lock.car", "locked"),
      "binary_sensor.doors": driveState("binary_sensor.doors", "off"),
      "binary_sensor.windows": driveState("binary_sensor.windows", "on"),
    },
  );
  const metrics = card.shadowRoot.querySelectorAll(
    ".ae-drive-metrics .ae-reading",
  );
  assert.equal(metrics.length, 3);
  assert.deepEqual(
    [...metrics].map((n) => n.querySelector("ha-icon").getAttribute("icon")),
    ["mdi:map-marker-distance", "mdi:gas-station", "mdi:counter"],
  );
  const statuses = card.shadowRoot.querySelectorAll(
    ".ae-drive-statuses .ae-reading",
  );
  assert.equal(statuses.length, 3);
  assert.ok(statuses[0].classList.contains("drive-secure"));
  assert.ok(statuses[1].classList.contains("drive-secure"));
  assert.ok(statuses[2].classList.contains("drive-warning"));
  assert.equal(
    statuses[2].querySelector("ha-icon").getAttribute("icon"),
    "mdi:window-open",
  );
  assert.ok(
    [...card.shadowRoot.querySelectorAll("ha-icon")].every(
      (n) => n.getAttribute("aria-hidden") === "true",
    ),
  );
  assert.equal(card.shadowRoot.querySelector("progress"), null);
  card.remove();
});
test("status colours distinguish secure, alerts, jammed, transitions and unknown data", async () => {
  const { statusPresentation } = await import("../src/adapter.js");
  for (const status of ["Locked", "Closed"])
    assert.equal(statusPresentation("locks", status).tone, "secure");
  for (const status of ["Unlocked", "Open"])
    assert.equal(statusPresentation("doors", status).tone, "warning");
  assert.equal(statusPresentation("locks", "Jammed").tone, "error");
  for (const status of ["Locking", "Unlocking"])
    assert.equal(statusPresentation("locks", status).tone, "pending");
  for (const status of [
    "Unknown",
    "Unavailable",
    "Not configured",
    "unexpected",
  ])
    assert.equal(statusPresentation("windows", status).tone, "neutral");
});
test("status updates change icons/colours without losing focus or enabling vehicle commands", async () => {
  const card = driveFixture(
    { locks: [{ entity: "lock.car" }] },
    { "lock.car": driveState("lock.car", "locked") },
  );
  const button = card.shadowRoot.querySelector("[data-key=status-locks]");
  button.focus();
  let detail,
    calls = 0;
  card.addEventListener("hass-more-info", (e) => {
    detail = e.detail.entityId;
  });
  card.hass = {
    ...card.hass,
    callService: async () => {
      calls++;
    },
    states: { "lock.car": driveState("lock.car", "unlocked") },
  };
  assert.equal(
    card.shadowRoot.querySelector("[data-key=status-locks]"),
    button,
  );
  assert.equal(card.shadowRoot.activeElement, button);
  assert.ok(button.classList.contains("drive-warning"));
  assert.equal(
    button.querySelector("ha-icon").getAttribute("icon"),
    "mdi:lock-open",
  );
  button.click();
  assert.equal(detail, "lock.car");
  assert.equal(calls, 0);
  card.hass = {
    ...card.hass,
    states: { "lock.car": driveState("lock.car", "jammed") },
  };
  assert.ok(button.classList.contains("drive-error"));
  card.hass = {
    ...card.hass,
    states: { "lock.car": driveState("lock.car", "unavailable") },
  };
  assert.ok(button.classList.contains("drive-neutral"));
  assert.equal(button.dataset.status, "Unavailable");
  card.remove();
});
test("aggregate status tap and hold open the member responsible for the alert", async () => {
  const card = driveFixture(
    {
      doors: [
        { entity: "binary_sensor.first" },
        { entity: "binary_sensor.second" },
      ],
    },
    {
      "binary_sensor.first": driveState("binary_sensor.first", "off"),
      "binary_sensor.second": driveState("binary_sensor.second", "on"),
    },
  );
  const button = card.shadowRoot.querySelector("[data-key=status-doors]");
  let detail;
  card.addEventListener("hass-more-info", (e) => {
    detail = e.detail.entityId;
  });
  button.click();
  assert.equal(detail, "binary_sensor.second");
  detail = undefined;
  button.dispatchEvent(new dom.window.MouseEvent("pointerdown"));
  await new Promise((r) => setTimeout(r, 570));
  button.click();
  assert.equal(detail, "binary_sensor.second");
  card.remove();
});
test("fuel capacity retains a compact percentage display without a separate progress row", () => {
  const card = driveFixture(
    { fuel_entity: "sensor.fuel", fuel_capacity: 40 },
    {
      "sensor.fuel": driveState("sensor.fuel", 20, {
        unit_of_measurement: "L",
      }),
    },
  );
  assert.equal(
    card.shadowRoot.querySelector(".ae-drive-metrics .ae-value").textContent,
    "50%",
  );
  card.setConfig({ fuel_entity: "sensor.fuel" });
  assert.equal(
    card.shadowRoot.querySelector(".ae-drive-metrics .ae-value").textContent,
    "20L",
  );
  assert.equal(card.shadowRoot.querySelector("progress"), null);
  card.remove();
});
test("invalid coordinates stay disabled and missing timestamps stay explicit", () => {
  const card = driveFixture(
    { tracker_entity: "device_tracker.car" },
    {
      "device_tracker.car": driveState("device_tracker.car", "home", {
        latitude: 200,
        longitude: 0,
      }),
    },
  );
  const link = card.shadowRoot.querySelector("a");
  assert.equal(link.getAttribute("aria-disabled"), "true");
  assert.equal(link.hasAttribute("href"), false);
  assert.match(
    card.shadowRoot.querySelector(".ae-drive-footer").textContent,
    /Location update time unknown/,
  );
  card.remove();
});
