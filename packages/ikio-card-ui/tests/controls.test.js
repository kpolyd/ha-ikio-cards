import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom, ui;
before(async () => {
  dom = new JSDOM("<body></body>");
  for (const k of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[k] = dom.window[k];
  ui = await import("../src/controls.js");
});
after(() => dom.window.close());
test("patched selects and ranges read the retained live element, not detached render nodes", () => {
  const root = document.createElement("div");
  let value;
  ui.patchChildren(root, [
    ui.select("Mode", ["a", "b"], "a", (v) => (value = v)),
  ]);
  const select = root.querySelector("select");
  ui.patchChildren(root, [
    ui.select("Mode", ["a", "b"], "a", (v) => (value = v)),
  ]);
  assert.equal(root.querySelector("select"), select);
  select.value = "b";
  select.dispatchEvent(new dom.window.Event("change"));
  assert.equal(value, "b");
  ui.patchChildren(root, [
    ui.range("Volume", 0, 0, 100, 1, (v) => (value = v)),
  ]);
  const range = root.querySelector("input");
  ui.patchChildren(root, [
    ui.range("Volume", 0, 0, 100, 1, (v) => (value = v)),
  ]);
  range.value = "75";
  range.dispatchEvent(new dom.window.Event("change"));
  assert.equal(value, 75);
});
test("readings open native details from retained node after reconciliation", () => {
  const root = document.createElement("div");
  document.body.append(root);
  let entity;
  root.addEventListener("hass-more-info", (e) => (entity = e.detail.entityId));
  ui.patchChildren(root, [ui.reading("Power", "1 W", "sensor.power")]);
  const node = root.firstChild;
  ui.patchChildren(root, [ui.reading("Power", "2 W", "sensor.power")]);
  node.click();
  assert.equal(entity, "sensor.power");
  root.remove();
});
test("numeric and unit adapters preserve zero and reject absent data", () => {
  assert.equal(ui.numeric({ state: "0" }), 0);
  assert.equal(ui.numeric({ state: "unavailable" }), null);
  assert.equal(ui.numeric({ state: "" }), null);
  assert.equal(
    ui.unitValue(
      { state: "2", attributes: { unit_of_measurement: "kW" } },
      "power",
    ),
    2000,
  );
  assert.equal(
    ui.unitValue(
      { state: "2", attributes: { unit_of_measurement: "kWh" } },
      "power",
    ),
    null,
  );
});

test("only accepted button commands vibrate once through both send and act paths", async () => {
  class ActionCard extends ui.ControlCard {
    render() {
      return [];
    }
  }
  customElements.define("ikio-haptic-test", ActionCard);
  const card = document.createElement("ikio-haptic-test");
  card.config = {};
  card.hass = {
    states: { "switch.test": { state: "off", attributes: {} } },
    callService: async () => {},
  };
  document.body.append(card);
  const feedback = [];
  const listen = (e) => feedback.push(e.detail);
  window.addEventListener("haptic", listen);
  try {
    const node = document.createElement("button");
    card.shell.append(node);
    for (const confirm of [undefined, () => false]) {
      let command;
      node.onclick = () => {
        command = card.send("switch.test", "switch", "turn_on", {}, confirm);
      };
      node.click();
      await command;
      assert.equal(feedback.at(-1), "selection");
      const count = feedback.length;
      if (confirm) {
        node.click(); // pending commands are blocked
        await command;
        assert.equal(feedback.length, count);
      }
      card.cancelActions();
    }
    assert.equal(feedback.length, 2);
    node.onclick = () => ui.details(card, "switch.test");
    node.click();
    await Promise.resolve();
    await card.send("switch.test", "switch", "turn_on"); // no button activation
    assert.equal(feedback.length, 2);
    card.preview = true;
    node.onclick = () => card.send("switch.test", "switch", "turn_on");
    node.click();
    assert.equal(feedback.length, 2);
  } finally {
    window.removeEventListener("haptic", listen);
    card.remove();
  }
});
