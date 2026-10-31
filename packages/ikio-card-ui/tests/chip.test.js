import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

test("shared chip icons follow entity status, including transitions and missing entities", async () => {
  const dom = new JSDOM(
    '<div><ha-state-icon data-chip-entity="switch.demo" data-chip-icon="mdi:star"></ha-state-icon></div>',
  );
  globalThis.HTMLElement = dom.window.HTMLElement;
  const { updateChipIcons } = await import("../src/chip.js");
  const content = dom.window.document.querySelector("div");
  const icon = content.querySelector("ha-state-icon");
  const card = {
    content,
    hass: {},
    state(id) {
      return this.hass.states?.[id];
    },
  };
  const cases = [
    ["binary_sensor", "off", "muted", "running"],
    ["binary_sensor", "on", "accent", "power"],
    ["light", "on", "accent"],
    ["light", "off", "muted"],
    ["switch", "on", "accent"],
    ["switch", "off", "muted"],
    ["binary_sensor", "on", "warning", "door"],
    ["binary_sensor", "off", "temperature", "door"],
    ["binary_sensor", "on", "error", "smoke"],
    ["binary_sensor", "off", "temperature", "smoke"],
    ["binary_sensor", "on", "temperature", "connectivity"],
    ["binary_sensor", "off", "error", "connectivity"],
    ["binary_sensor", "on", "accent", "motion"],
    ["binary_sensor", "off", "muted", "motion"],
    ["person", "home", "temperature"],
    ["person", "not_home", "muted"],
    ["person", "Work", "muted"],
    ["lock", "locked", "temperature"],
    ["lock", "unlocked", "warning"],
    ["lock", "jammed", "error"],
    ["cover", "open", "warning"],
    ["cover", "closed", "temperature"],
    ["alarm_control_panel", "armed_home", "temperature"],
    ["alarm_control_panel", "triggered", "error"],
    ["alarm_control_panel", "arming", "warning"],
    ["alarm_control_panel", "disarmed", "muted"],
    ["climate", "heat", "warning"],
    ["climate", "cool", "humidity"],
    ["sensor", "0", "accent"],
    ["sensor", "99", "accent"],
    ["light", "unavailable", "muted"],
    ["lock", "unknown", "muted"],
    ["sensor", undefined, "muted"],
  ];
  for (const [domain, value, color, device_class] of cases) {
    const id = `${domain}.demo`;
    icon.dataset.chipEntity = id;
    const state =
      value === undefined
        ? undefined
        : { entity_id: id, state: value, attributes: { device_class } };
    card.hass = { states: { [id]: state } };
    updateChipIcons(card);
    assert.equal(
      icon.style.getPropertyValue("--ikio-chip-color"),
      `var(--ae-${color})`,
      `${domain}/${value}/${device_class}`,
    );
    assert.equal(icon.stateObj, state);
    assert.equal(icon.hass, card.hass);
    assert.equal(icon.icon, "mdi:star");
  }
  dom.window.close();
});
