import {
  entity,
  bool,
  number,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("entity", "Media player", "media_player", true),
  bool("show_volume", "Show volume"),
  number("volume_step", "Volume step (percentage points)", 1, 100, 1),
  bool("show_source", "Show source"),
  entity("power_entity", "Power sensor", "sensor"),
];
export const lists = [];
export function normalize(config) {
  if (!config || typeof config !== "object") return config;
  const c = structuredClone(config);
  c.show_volume ??= true;
  c.show_source ??= true;
  if (c.volume_step === undefined || c.volume_step === "") c.volume_step = 5;
  for (const key of [
    "more_controls",
    "show_artwork",
    "backlight_entity",
    "shortcuts",
  ])
    delete c[key];
  return c;
}
export function validate(c) {
  validateConfig(c, fields, lists);
  for (const key of ["volume", "source"])
    if (c[`show_${key}`] !== undefined && typeof c[`show_${key}`] !== "boolean")
      throw Error(`Show ${key} must be a toggle`);
  if (c.volume_step !== undefined && !Number.isInteger(c.volume_step))
    throw Error("Volume step must be a whole number.");
}
