import {
  entity,
  number,
  bool,
  choice,
  validateConfig,
} from "@ikio/card-ui/schema-editor";

export const fields = [
  entity("humidifier_entity", "Dehumidifier entity", "humidifier", true),
  entity("humidity_entity", "Humidity sensor (optional)", "sensor"),
  entity("power_entity", "Power sensor (optional)", "sensor"),
  entity("tank_full_entity", "Tank-full sensor (optional)", "binary_sensor"),
  choice("tank_full_state", "Tank-full state", [
    { value: "on", label: "On" },
    { value: "off", label: "Off" },
  ]),
  number("humidity_step", "Humidity step (empty = Auto)", 1, 100, 1),
  bool("show_mode", "Show mode"),
  entity("fan_entity", "Fan-speed entity (optional)", ["select", "fan"]),
];
export const lists = [];
export function normalize(config) {
  return {
    ...config,
    show_mode: config.show_mode ?? true,
    tank_full_state: config.tank_full_state || "on",
  };
}
export function validate(config) {
  validateConfig(config, fields, lists);
  if (config.show_mode !== undefined && typeof config.show_mode !== "boolean")
    throw Error("Show mode must be a toggle");
  if (
    config.tank_full_state !== undefined &&
    !["on", "off"].includes(config.tank_full_state)
  )
    throw Error("Choose On or Off for the tank-full state.");
  if (
    config.humidity_step !== undefined &&
    config.humidity_step !== "" &&
    !Number.isInteger(config.humidity_step)
  )
    throw Error("Humidity step must be a whole number.");
}
