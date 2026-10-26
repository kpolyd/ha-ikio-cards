import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom, distributionModel;
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
  ({ distributionModel } = await import("../src/distribution.js"));
});
after(() => dom.window.close());
test("distribution switches and limits are available in the visual editor without losing circuit metadata", async () => {
  const Card = customElements.get("ikio-energy-card"),
    editor = await Card.getConfigElement();
  const { config, hass } = fixture();
  config.visibility = [{ condition: "user", users: ["simulated-owner"] }];
  editor.setConfig(config);
  editor.hass = hass;
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  const form = editor.shadowRoot.querySelector("ha-form");
  assert.ok(
    form.schema.some(
      (f) => f.name === "show_power_distribution" && f.selector.boolean,
    ),
  );
  assert.ok(form.schema.some((f) => f.name === "distribution_max_devices"));
  let saved;
  editor.addEventListener("config-changed", (e) => (saved = e.detail.config));
  form.dispatchEvent(
    new CustomEvent("value-changed", {
      detail: {
        value: {
          ...form.data,
          show_power_distribution: true,
          distribution_max_devices: 5,
        },
      },
    }),
  );
  assert.equal(saved.distribution_max_devices, 5);
  assert.deepEqual(saved.circuits, config.circuits);
  assert.deepEqual(saved.visibility, config.visibility);
  const { validate } = await import("../src/config.js");
  for (const limit of [0, 21, 1.5, NaN])
    assert.throws(() =>
      validate({ ...config, distribution_max_devices: limit }),
    );
  editor.remove();
});
const sensor = (value, unit = "W") => ({
  state: String(value),
  attributes: { unit_of_measurement: unit },
});
function fixture() {
  return {
    config: {
      power_entity: "sensor.total",
      show_power_distribution: true,
      non_overlapping: true,
      circuits: [
        { power_entity: "sensor.pc", name: "PC" },
        { power_entity: "sensor.desk", name: "Desk" },
        { power_entity: "sensor.tv", name: "TV" },
        { power_entity: "sensor.fridge", name: "Fridge" },
      ],
    },
    hass: {
      locale: { language: "en" },
      states: {
        "sensor.total": sensor(1.24, "kW"),
        "sensor.pc": sensor(540),
        "sensor.desk": sensor(140),
        "sensor.tv": sensor(210),
        "sensor.fridge": sensor(150),
      },
      entities: {
        "sensor.pc": { area_id: "office", device_id: "wrong" },
        "sensor.desk": { device_id: "desk" },
        "sensor.tv": { area_id: "living" },
        "sensor.fridge": { area_id: "kitchen" },
      },
      devices: { wrong: { area_id: "living" }, desk: { area_id: "office" } },
      areas: {
        office: { name: "Office" },
        living: { name: "Living room" },
        kitchen: { name: "Kitchen" },
      },
    },
  };
}
function cardFixture(config, hass) {
  const card = document.createElement("ikio-energy-card");
  card.setConfig(config);
  card.hass = hass;
  document.body.append(card);
  return card;
}
const click = (node) =>
  node.dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true, detail: 1 }),
  );
test("rings conserve total watts, resolve entity/device areas and retain stable area shades", () => {
  const { config, hass } = fixture(),
    model = distributionModel(config, hass);
  assert.equal(model.total, 1240);
  assert.deepEqual(
    model.areas.map((a) => [a.name, a.value]),
    [
      ["Office", 680],
      ["Living room", 210],
      ["Kitchen", 150],
      ["Untracked", 200],
    ],
  );
  assert.equal(
    model.areas.flatMap((a) => a.devices).reduce((s, d) => s + d.value, 0),
    1240,
  );
  const office = model.areas[0];
  assert.notEqual(office.devices[0].color, office.devices[1].color);
  assert.equal(
    office.devices[0].color.match(/hsl\(([^ ]+)/)[1],
    office.color.match(/hsl\(([^ ]+)/)[1],
  );
  const changed = distributionModel(config, {
    ...hass,
    states: { ...hass.states, "sensor.pc": sensor(0) },
  });
  assert.equal(changed.areas[0].devices[0].color, office.devices[1].color);
});
test("missing, incompatible, negative and overlapping readings never become reassuring zero shares", () => {
  const { config, hass } = fixture();
  for (const state of [sensor("unavailable"), sensor(12, "kWh"), sensor(-5)])
    assert.match(
      distributionModel(config, {
        ...hass,
        states: { ...hass.states, "sensor.pc": state },
      }).message,
      /PC.*non-negative/,
    );
  assert.match(
    distributionModel({ ...config, non_overlapping: false }, hass).message,
    /overlap/,
  );
  assert.match(
    distributionModel(config, {
      ...hass,
      states: { ...hass.states, "sensor.total": sensor(100) },
    }).message,
    /exceeds/,
  );
  assert.match(
    distributionModel(
      { ...config, circuits: [...config.circuits, config.circuits[0]] },
      hass,
    ).message,
    /distinct/,
  );
  assert.match(
    distributionModel({ ...config, untracked_entity: "sensor.missing" }, hass)
      .message,
    /untracked/,
  );
});
test("device limits aggregate smaller consumers inside their original area, separate from untracked", () => {
  const { config, hass } = fixture();
  const model = distributionModel(
    { ...config, distribution_max_devices: 1 },
    hass,
  );
  assert.equal(model.areas[0].devices[0].name, "PC");
  assert.deepEqual(model.areas[0].devices[1].name, "Other (Office)");
  assert.equal(model.areas[0].devices[1].value, 140);
  assert.equal(
    model.areas.reduce(
      (s, a) => s + a.devices.reduce((n, d) => n + d.value, 0),
      0,
    ),
    model.total,
  );
  assert.equal(model.areas.at(-1).name, "Untracked");
});
test("distribution is opt-in and appended after the unmodified existing device grid", () => {
  const { config, hass } = fixture();
  const card = cardFixture({ ...config, show_power_distribution: false }, hass);
  assert.equal(card.shadowRoot.querySelector(".ae-power-distribution"), null);
  const before = card.shadowRoot.querySelector(".ae-energy").innerHTML;
  card.setConfig(config);
  const section = card.shadowRoot.querySelector(".ae-power-distribution");
  assert.equal(section.previousElementSibling.className, "ae-grid");
  assert.equal(section, section.parentElement.lastElementChild);
  const copy = card.shadowRoot.querySelector(".ae-energy").cloneNode(true);
  copy.lastElementChild.remove();
  assert.equal(copy.innerHTML, before);
  assert.equal(section.querySelectorAll('[data-ring="device"]').length, 5);
  assert.equal(section.querySelectorAll('[data-ring="area"]').length, 4);
  assert.equal(section.querySelector("svg").getAttribute("height"), "184");
  card.remove();
});
test("tapping device/area/name/centre updates watts and preserves selected controls across live updates", () => {
  const { config, hass } = fixture(),
    card = cardFixture(config, hass);
  const root = card.shadowRoot,
    button = root.querySelector(".ae-ring-button");
  button.focus();
  click(root.querySelector('path[data-selection="device:sensor.pc"]'));
  assert.equal(root.querySelector(".ae-ring-number").textContent, "540");
  assert.equal(root.querySelector("[data-center-name]").textContent, "PC");
  assert.equal(root.activeElement, button);
  card.hass = { ...hass, states: { ...hass.states, "sensor.pc": sensor(500) } };
  assert.equal(root.querySelector(".ae-ring-number").textContent, "500");
  assert.equal(root.querySelector(".ae-ring-button"), button);
  click(root.querySelector('path[data-selection="area:office"]'));
  assert.equal(root.querySelector(".ae-ring-number").textContent, "640");
  click(root.querySelector('g[data-selection="device:sensor.desk"] text'));
  assert.equal(root.querySelector(".ae-ring-number").textContent, "140");
  click(root.querySelector('[data-selection=""] circle'));
  assert.equal(root.querySelector(".ae-ring-number").textContent, "1,240");
  button.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
    }),
  );
  assert.match(button.getAttribute("aria-label"), /Office/);
  button.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  assert.equal(root.querySelector("[data-center-name]").textContent, "Total");
  card.remove();
});
test("resize observation starts after attachment, updates geometry once and cleans up on removal", () => {
  const observers = [];
  globalThis.ResizeObserver = class {
    constructor(fn) {
      this.fn = fn;
      observers.push(this);
    }
    observe(node) {
      this.node = node;
    }
    disconnect() {
      this.stopped = true;
    }
  };
  const { config, hass } = fixture(),
    card = cardFixture(config, hass);
  assert.equal(observers.length, 1);
  observers[0].fn([{ contentRect: { width: 260 } }]);
  assert.match(
    card.shadowRoot
      .querySelector(".ae-power-distribution svg")
      .getAttribute("viewBox"),
    /260/,
  );
  assert.equal(observers.length, 1);
  card.remove();
  assert.equal(observers[0].stopped, true);
  document.body.append(card);
  assert.equal(observers.length, 2);
  card.setConfig({ ...config, show_power_distribution: false });
  assert.equal(observers[1].stopped, true);
  card.remove();
  delete globalThis.ResizeObserver;
});
test("zero power draws a neutral empty ring and invalid readings retain existing live values", () => {
  const { config, hass } = fixture();
  const zero = {
    ...hass,
    states: Object.fromEntries(
      Object.keys(hass.states).map((id) => [id, sensor(0)]),
    ),
  };
  const card = cardFixture(config, zero);
  assert.equal(
    card.shadowRoot.querySelector(".ae-ring-number").textContent,
    "0",
  );
  assert.equal(
    card.shadowRoot.querySelectorAll('[data-ring="device"]').length,
    0,
  );
  assert.ok(
    !card.shadowRoot
      .querySelector(".ae-power-distribution svg")
      .innerHTML.includes("NaN"),
  );
  card.hass = {
    ...hass,
    states: { ...hass.states, "sensor.pc": sensor("unavailable") },
  };
  assert.match(
    card.shadowRoot.querySelector(".ae-power-distribution").textContent,
    /PC/,
  );
  assert.equal(
    card.shadowRoot.querySelector(".ae-energy-summary .ae-value").textContent,
    "1,240W",
  );
  card.remove();
});
test("hold on a device segment targets that sensor and suppresses selection", async () => {
  const { config, hass } = fixture(),
    card = cardFixture(config, hass);
  let entity;
  card.addEventListener(
    "hass-more-info",
    (event) => (entity = event.detail.entityId),
  );
  const segment = card.shadowRoot.querySelector(
    'path[data-selection="device:sensor.pc"]',
  );
  segment.dispatchEvent(
    new dom.window.MouseEvent("pointerdown", {
      bubbles: true,
      clientX: 10,
      clientY: 10,
      button: 0,
    }),
  );
  await new Promise((r) => setTimeout(r, 580));
  segment.dispatchEvent(
    new dom.window.MouseEvent("pointerup", { bubbles: true }),
  );
  click(segment);
  assert.equal(entity, "sensor.pc");
  assert.equal(
    card.shadowRoot.querySelector("[data-center-name]").textContent,
    "Total",
  );
  card.remove();
});
test("long direct labels wrap at narrow widths without dropping their text or watts", async () => {
  const { distributionView } = await import("../src/distribution.js"),
    { config, hass } = fixture();
  config.circuits[0].name = "Extremely long simulated office workstation";
  const model = distributionModel(config, hass);
  for (const width of [258, 298, 368, 498]) {
    const section = distributionView(model, {
      hass,
      width,
      selection: null,
      totalEntity: config.power_entity,
      onSelect() {},
    });
    const label = section.querySelector(
      'g[data-selection="device:sensor.pc"] text',
    );
    assert.ok(label.querySelectorAll("tspan").length > 1);
    assert.equal(
      label.textContent.replaceAll(" ", ""),
      config.circuits[0].name.replaceAll(" ", ""),
    );
    assert.ok(!section.innerHTML.includes("NaN"));
    assert.ok(
      Number(section.querySelector("svg").getAttribute("height")) >= 184,
    );
    assert.equal(section.querySelector(".ae-ring-number").textContent, "1,240");
  }
});
