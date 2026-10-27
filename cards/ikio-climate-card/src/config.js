import {
  entity,
  number,
  bool,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("climate_entity", "Climate entity", "climate", true),
  entity(
    "temperature_entity",
    "Current temperature sensor (optional)",
    "sensor",
  ),
  entity("humidity_entity", "Humidity sensor (optional)", "sensor"),
  entity("power_entity", "Power sensor (optional)", "sensor"),
  number("temperature_step", "Temperature step (empty = Auto)", 0.1, 10, 0.1),
  ...["fan", "preset", "swing", "horizontal", "vertical"].map((key) =>
    bool(
      `show_${key}`,
      `Show ${key === "horizontal" || key === "vertical" ? key + " position" : key}`,
    ),
  ),
  entity(
    "horizontal_position_entity",
    "Horizontal position entity (optional)",
    ["select", "number"],
  ),
  entity("vertical_position_entity", "Vertical position entity (optional)", [
    "select",
    "number",
  ]),
];
export const lists = [];
export function normalize(config) {
  const c = { ...config };
  c.power_entity ??= c.climate_power_entity;
  for (const k of ["fan", "preset", "swing", "horizontal", "vertical"])
    c[`show_${k}`] ??= true;
  for (const k of [
    "fridge_entity",
    "climate_power_entity",
    "humidifier_entity",
    "fan_entity",
    "default_device",
    "humidifier_power_entity",
    "fan_power_entity",
  ])
    delete c[k];
  return c;
}
export function validate(c) {
  validateConfig(c, fields, lists);
  for (const k of ["fan", "preset", "swing", "horizontal", "vertical"]) {
    if (c[`show_${k}`] !== undefined && typeof c[`show_${k}`] !== "boolean")
      throw Error(`Show ${k} must be a toggle`);
  }
}
