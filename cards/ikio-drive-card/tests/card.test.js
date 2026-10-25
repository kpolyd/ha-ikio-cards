import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom;
before(async () => {
  dom = new JSDOM("<body></body>", {
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

test("optional car image sits beside title/parking and missing images retain sensor readings", () => {
  const card = driveFixture(
    { tracker_entity: "device_tracker.car", image_url: "/local/car.png" },
    {
      "device_tracker.car": driveState("device_tracker.car", "home"),
    },
  );
  const header = card.shadowRoot.querySelector(".ae-drive-header");
  assert.match(
    header.querySelector(".ae-drive-heading").textContent,
    /CarParkingHome/,
  );
  const image = header.querySelector("img");
  assert.equal(image.getAttribute("src"), "/local/car.png");
  assert.equal(image.alt, "Car image");
  image.dispatchEvent(new dom.window.Event("error"));
  assert.equal(header.querySelector("img"), null);
  assert.match(header.textContent, /Car image unavailable/);
  assert.ok(card.shadowRoot.querySelector(".ae-drive-statuses"));
  card.setConfig({ tracker_entity: "device_tracker.car" });
  assert.equal(card.shadowRoot.querySelector("img"), null);
  assert.equal(card.shadowRoot.querySelector(".ae-drive-image-note"), null);
  card.remove();
});

test("uploaded media resolves once and stale results cannot replace a newly selected image", async () => {
  const card = driveFixture({
    image: { media_content_id: "media-source://image_upload/example" },
  });
  const calls = [];
  let resolve;
  card.hass = {
    ...card.hass,
    callWS: (args) => {
      calls.push(args);
      return new Promise((r) => (resolve = r));
    },
  };
  const pending = card.loadImage();
  card.update();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    type: "media_source/resolve_media",
    media_content_id: "media-source://image_upload/example",
  });
  resolve({ url: "/api/image/serve/example/original" });
  await pending;
  assert.equal(
    card.shadowRoot.querySelector("img").getAttribute("src"),
    "/api/image/serve/example/original",
  );
  const stale = card.loadImage(true);
  card.setConfig({ image_url: "/local/replacement.png" });
  resolve({ url: "/api/image/serve/stale/original" });
  await stale;
  assert.equal(
    card.shadowRoot.querySelector("img").getAttribute("src"),
    "/local/replacement.png",
  );
  card.remove();
});
test("failed media resolution stays inline and disconnected requests do not restore image state", async () => {
  const card = driveFixture({
    image: { media_content_id: "media-source://image_upload/example" },
  });
  card.hass = {
    ...card.hass,
    callWS: async () => {
      throw Error("Missing image");
    },
  };
  await card.loadImage();
  assert.match(card.shadowRoot.textContent, /Car image unavailable/);
  let resolve;
  card.hass = { ...card.hass, callWS: () => new Promise((r) => (resolve = r)) };
  const pending = card.loadImage(true);
  card.remove();
  resolve({ url: "/api/image/serve/stale/original" });
  await pending;
  assert.equal(card.resolvedImage, "");
  assert.equal(card.isConnected, false);
});
test("image editor offers native image upload, preserves selection, and rejects non-image URL schemes", async () => {
  const { fields } = await import("../src/config.js");
  const field = fields.find((f) => f.name === "image");
  assert.deepEqual(field.selector.media, {
    accept: ["image/*"],
    image_upload: true,
  });
  const editor = await customElements.get("ikio-drive-card").getConfigElement();
  const image = {
    media_content_id: "media-source://image_upload/example",
    media_content_type: "image/png",
  };
  editor.setConfig({ image });
  editor.hass = { states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const form = editor.shadowRoot.querySelector("ha-form");
  assert.deepEqual(form.data.image, image);
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  form.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: { value: { ...form.data, name: "Vehicle" } },
    }),
  );
  assert.deepEqual(saved.image, image);
  const card = driveFixture({ image_url: "javascript:alert(1)" });
  assert.equal(card.shadowRoot.querySelector("img"), null);
  assert.match(card.shadowRoot.textContent, /Car image unavailable/);
  card.remove();
  editor.remove();
});

test("plate and exact VIN occupy the two header rows between title and image", () => {
  const card = driveFixture(
    {
      license_plate: "DEMO 1234",
      vin_entity: "sensor.vin",
      image_url: "/local/car.png",
    },
    {
      "sensor.vin": driveState("sensor.vin", "00012345678901234"),
    },
  );
  const header = card.shadowRoot.querySelector(".ae-drive-header");
  assert.deepEqual(
    [...header.children].map((n) => n.className),
    ["ae-drive-heading", "ae-drive-identifiers", "ae-drive-image"],
  );
  const ids = header.querySelector(".ae-drive-identifiers");
  assert.equal(ids.children.length, 2);
  assert.equal(
    ids.querySelector(".ae-drive-plate-number").textContent,
    "DEMO 1234",
  );
  assert.equal(ids.querySelector(".ae-value").textContent, "00012345678901234");
  let entity;
  card.addEventListener("hass-more-info", (e) => (entity = e.detail.entityId));
  ids.querySelector("button").click();
  assert.equal(entity, "sensor.vin");
  card.hass = {
    ...card.hass,
    states: { "sensor.vin": driveState("sensor.vin", "unavailable") },
  };
  assert.equal(
    card.shadowRoot.querySelector(".ae-drive-vin .ae-value").textContent,
    "unavailable",
  );
  card.setConfig({ license_plate: "DEMO 1234" });
  assert.equal(
    card.shadowRoot.querySelector(".ae-drive-plate-number").textContent,
    "DEMO 1234",
  );
  assert.equal(card.shadowRoot.querySelector(".ae-drive-vin"), null);
  card.remove();
});

test("car image entity follows entity_picture changes and recovers from image failures", () => {
  const entity = "image.vehicle";
  const card = driveFixture(
    { image_entity: entity, image_url: "/local/fallback.png" },
    {
      [entity]: driveState(entity, "2026-10-25T10:00:00Z", {
        entity_picture: "/api/image_proxy/vehicle?token=one",
      }),
    },
  );
  assert.ok(card.entityIds.includes(entity));
  assert.equal(
    card.shadowRoot.querySelector("img").getAttribute("src"),
    "/api/image_proxy/vehicle?token=one",
  );
  card.shadowRoot
    .querySelector("img")
    .dispatchEvent(new dom.window.Event("error"));
  assert.equal(card.shadowRoot.querySelector("img"), null);
  card.hass = {
    ...card.hass,
    states: {
      [entity]: driveState(entity, "2026-10-25T10:01:00Z", {
        entity_picture: "/api/image_proxy/vehicle?token=two",
      }),
    },
  };
  assert.equal(
    card.shadowRoot.querySelector("img").getAttribute("src"),
    "/api/image_proxy/vehicle?token=two",
  );
  card.hass = {
    ...card.hass,
    states: { [entity]: driveState(entity, "unavailable") },
  };
  assert.equal(card.shadowRoot.querySelector("img"), null);
  assert.match(
    card.shadowRoot.querySelector(".ae-drive-image-note").textContent,
    /unavailable/,
  );
  card.remove();
});
test("a sensor URL can supply the car image and selecting it is available in the visual editor", async () => {
  const { fields } = await import("../src/config.js");
  assert.ok(
    fields
      .find((f) => f.name === "image_entity")
      .selector.entity.filter.domain.includes("sensor"),
  );
  const card = driveFixture(
    { image_entity: "sensor.car_image" },
    {
      "sensor.car_image": driveState(
        "sensor.car_image",
        "https://example.invalid/car.png",
      ),
    },
  );
  assert.equal(
    card.shadowRoot.querySelector("img").getAttribute("src"),
    "https://example.invalid/car.png",
  );
  card.remove();
});

test("minimal plate preserves registration text, supports a country section, and keeps VIN labelled", () => {
  const config = { license_plate: "DEMO 1234", vin_entity: "sensor.vin" };
  const card = driveFixture(config, {
    "sensor.vin": driveState("sensor.vin", "VNK12345678901234"),
  });
  const plate = () => card.shadowRoot.querySelector(".ae-drive-plate");
  assert.equal(plate().getAttribute("aria-label"), "License plate: DEMO 1234");
  assert.equal(
    plate().querySelector(".ae-drive-plate-country").textContent,
    "GR",
  );
  assert.equal(
    plate().querySelector(".ae-drive-plate-number").textContent,
    "DEMO 1234",
  );
  assert.equal(
    card.shadowRoot.querySelector(".ae-drive-vin .ae-label").textContent,
    "VIN ·",
  );
  card.setConfig({ ...config, plate_country: "de" });
  assert.equal(
    plate().querySelector(".ae-drive-plate-country").textContent,
    "DE",
  );
  card.setConfig({ ...config, plate_country: "" });
  assert.equal(plate().querySelector(".ae-drive-plate-country"), null);
  assert.equal(
    plate().querySelector(".ae-drive-plate-number").textContent,
    "DEMO 1234",
  );
  card.remove();
});
