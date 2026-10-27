import {
  entity,
  text,
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
export const lists = [
  {
    name: "more_controls",
    label: "More controls",
    fields: [
      entity(
        "entity",
        "Control entity",
        ["light", "switch", "scene", "script"],
        true,
      ),
      text("name", "Name (optional)"),
    ],
  },
];
export function normalize(config) {
  if (!config || typeof config !== "object") return config;
  const c = structuredClone(config);
  c.show_volume ??= true;
  c.show_source ??= true;
  if (c.volume_step === undefined || c.volume_step === "") c.volume_step = 5;
  if (c.more_controls === undefined) {
    if (c.shortcuts !== undefined && !Array.isArray(c.shortcuts))
      throw Error("Shortcuts must be a list");
    c.more_controls = [
      ...(c.backlight_entity ? [{ entity: c.backlight_entity }] : []),
      ...(c.shortcuts || []).map((row) => ({
        entity: row.entity,
        ...(row.label ? { name: row.label } : {}),
      })),
    ];
  }
  for (const key of ["show_artwork", "backlight_entity", "shortcuts"])
    delete c[key];
  return c;
}
export function validate(c) {
  if (
    Array.isArray(c?.more_controls) &&
    c.more_controls.some(
      (row) => !row || typeof row !== "object" || Array.isArray(row),
    )
  )
    throw Error("Each control must have an entity and optional name.");
  validateConfig(c, fields, lists);
  for (const key of ["volume", "source"])
    if (c[`show_${key}`] !== undefined && typeof c[`show_${key}`] !== "boolean")
      throw Error(`Show ${key} must be a toggle`);
  if (c.volume_step !== undefined && !Number.isInteger(c.volume_step))
    throw Error("Volume step must be a whole number.");
}
