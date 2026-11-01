import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom, ControlCard, title, el;
before(async () => {
  dom = new JSDOM("<body/>", { url: "https://ha.example/dashboard/home" });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  customElements.define("ha-form", class extends HTMLElement {});
  await import("../../../cards/ikio-entity-card/src/index.js");
  await import("../../../cards/ikio-chip-card/src/index.js");
  ({ ControlCard, title, el } = await import("../src/controls.js"));
  class HeaderCard extends ControlCard {
    render() {
      const root = el("div");
      root.append(title(this, "Demo", "switch.demo"));
      const power = el("button", "Power");
      power.onclick = () => this.hass.callService("switch", "turn_on", {});
      root.querySelector("header").append(power);
      return root;
    }
  }
  customElements.define("test-header-card", HeaderCard);
});
after(() => dom.window.close());
function fixture(config = {}, type = "ikio-entity-card") {
  const card = document.createElement(type),
    calls = [],
    opened = [];
  card.setConfig({ entity: "switch.demo", ...config });
  card.hass = {
    states: {
      "switch.demo": { entity_id: "switch.demo", state: "off", attributes: {} },
    },
    callService: async (...args) => calls.push(args),
  };
  card.addEventListener("hass-more-info", (e) =>
    opened.push(e.detail.entityId),
  );
  document.body.append(card);
  return {
    card,
    calls,
    opened,
    target: card.control || card.content.querySelector("button"),
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const hold = async (target) => {
  target.dispatchEvent(
    new dom.window.MouseEvent("pointerdown", { bubbles: true, button: 0 }),
  );
  await new Promise((r) => setTimeout(r, 570));
  target.dispatchEvent(
    new dom.window.MouseEvent("pointerup", { bubbles: true }),
  );
  target.click();
  await tick();
};
test("default actions preserve toggles and details; explicit tap actions replace them", async () => {
  for (const type of [
    "ikio-entity-card",
    "ikio-chip-card",
    "ikio-chip-badge",
  ]) {
    const { card, target, calls, opened } = fixture({}, type);
    target.click();
    await tick();
    if (type === "ikio-entity-card") assert.equal(calls[0][1], "turn_on");
    else assert.deepEqual(opened, ["switch.demo"]);
    card.setConfig({ entity: "switch.demo", tap_action: { action: "none" } });
    calls.length = 0;
    opened.length = 0;
    card.content.querySelector("button").click();
    await tick();
    assert.deepEqual(calls, []);
    assert.deepEqual(opened, []);
    card.setConfig({
      entity: "switch.demo",
      tap_action: { action: "more-info" },
    });
    card.content.querySelector("button").click();
    assert.deepEqual(opened, ["switch.demo"]);
    assert.deepEqual(calls, []);
    card.remove();
  }
});
test("custom holds run once, suppress the following tap, and preserve default holds", async () => {
  const { card, target, calls, opened } = fixture({
    tap_action: { action: "more-info" },
    hold_action: {
      action: "perform-action",
      perform_action: "select.select_option",
      data: { option: "Grid" },
      target: { entity_id: "select.example" },
    },
  });
  await hold(target);
  assert.deepEqual(calls, [
    [
      "select",
      "select_option",
      { option: "Grid" },
      { entity_id: "select.example" },
    ],
  ]);
  assert.deepEqual(opened, []);
  card.setConfig({ entity: "switch.demo", tap_action: { action: "none" } });
  await hold(target);
  assert.deepEqual(opened, ["switch.demo"]);
  card.remove();
});
test("headers are keyboard accessible and dedicated controls retain their action", async () => {
  const { card, calls, opened } = fixture(
    { tap_action: { action: "none" }, hold_action: { action: "more-info" } },
    "test-header-card",
  );
  const header = card.content.querySelector("header");
  header.querySelector(".ae-title").click();
  header.querySelectorAll("button")[1].click();
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "turn_on");
  header.querySelector(".ae-title").dispatchEvent(
    new dom.window.KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
    }),
  );
  assert.deepEqual(opened, ["switch.demo"]);
  card.remove();
});
test("preview blocks custom commands, details and navigation; unavailable entities can open details", async () => {
  const { card, target, calls, opened } = fixture({
    tap_action: { action: "more-info" },
  });
  card.hass = {
    ...card.hass,
    states: { "switch.demo": { state: "unavailable", attributes: {} } },
  };
  assert.equal(target.disabled, false);
  target.click();
  assert.deepEqual(opened, ["switch.demo"]);
  card.preview = true;
  target.click();
  assert.equal(opened.length, 1);
  card.setConfig({
    entity: "switch.demo",
    tap_action: { action: "perform-action", perform_action: "script.turn_on" },
  });
  target.click();
  await tick();
  assert.deepEqual(calls, []);
  card.setConfig({
    entity: "switch.demo",
    tap_action: { action: "navigate", navigation_path: "/dashboard/other" },
  });
  target.click();
  assert.equal(window.location.pathname, "/dashboard/home");
  card.remove();
});
test("navigation uses the HA event; URL actions only allow HTTP(S); unsupported toggles do not call services", async () => {
  const { card, target, calls } = fixture({
    tap_action: { action: "navigate", navigation_path: "/dashboard/other" },
  });
  let changed = 0;
  const listen = () => changed++;
  window.addEventListener("location-changed", listen);
  target.click();
  assert.equal(window.location.pathname, "/dashboard/other");
  assert.equal(changed, 1);
  window.removeEventListener("location-changed", listen);
  for (const url_path of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///tmp/test",
  ])
    assert.throws(() =>
      card.setConfig({ tap_action: { action: "url", url_path } }),
    );
  card.setConfig({
    entity: "select.example",
    tap_action: { action: "toggle" },
  });
  card.hass = {
    ...card.hass,
    states: { "select.example": { state: "Grid", attributes: {} } },
  };
  target.click();
  await tick();
  assert.deepEqual(calls, []);
  assert.match(card.error.textContent, /does not support toggle/);
  card.remove();
});
test("perform-action preserves targets and data, prevents duplicate requests and ignores stale failures", async () => {
  const { card, target, calls } = fixture({
    tap_action: {
      action: "perform-action",
      perform_action: "light.turn_on",
      target: { area_id: "test_area" },
      data: { brightness: 100 },
    },
  });
  let reject;
  card.hass.callService = (...args) => {
    calls.push(args);
    return new Promise((_, r) => (reject = r));
  };
  target.click();
  target.click();
  assert.deepEqual(calls, [
    ["light", "turn_on", { brightness: 100 }, { area_id: "test_area" }],
  ]);
  card.setConfig({ entity: "sensor.other" });
  reject(Error("stale failure"));
  await tick();
  assert.equal(card.error.textContent, "");
  card.remove();
});
test("confirmation stays inline, requires an explicit action, and is cancelled on remap", async () => {
  const config = {
    entity: "switch.demo",
    tap_action: {
      action: "perform-action",
      perform_action: "script.turn_on",
      confirmation: true,
    },
  };
  const { card, target, calls } = fixture(config);
  target.click();
  assert.equal(calls.length, 0);
  assert.equal(card.shell.querySelector("dialog"), null);
  card.shell.querySelector(".ikio-action-review button").click();
  await tick();
  assert.equal(calls.length, 1);
  target.click();
  const confirm = card.shell.querySelector(".ikio-action-review button");
  card.setConfig({ entity: "switch.other" });
  confirm.click();
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(card.shell.querySelector(".ikio-action-review"), null);
  card.remove();
});
test("disconnect cancels an armed hold", async () => {
  const { card, target, calls } = fixture({
    hold_action: { action: "perform-action", perform_action: "script.turn_on" },
  });
  target.dispatchEvent(
    new dom.window.MouseEvent("pointerdown", { bubbles: true }),
  );
  card.remove();
  await new Promise((r) => setTimeout(r, 570));
  assert.deepEqual(calls, []);
});

test("remapping during a hold cancels the gesture and its trailing click", async () => {
  const { card, target, calls } = fixture({
    hold_action: { action: "perform-action", perform_action: "script.old" },
  });
  target.dispatchEvent(
    new dom.window.MouseEvent("pointerdown", { bubbles: true }),
  );
  card.setConfig({
    entity: "switch.demo",
    tap_action: { action: "perform-action", perform_action: "script.new" },
  });
  await new Promise((r) => setTimeout(r, 570));
  target.dispatchEvent(
    new dom.window.MouseEvent("pointerup", { bubbles: true }),
  );
  target.click();
  await tick();
  assert.deepEqual(calls, []);
  target.dispatchEvent(
    new dom.window.MouseEvent("pointerdown", { bubbles: true }),
  );
  target.dispatchEvent(
    new dom.window.MouseEvent("pointerup", { bubbles: true }),
  );
  target.click();
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "new");
  card.remove();
});
