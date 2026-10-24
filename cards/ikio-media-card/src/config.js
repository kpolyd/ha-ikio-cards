import {
  entity,
  text,
  bool,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("entity", "Media player", "media_player", true),
  bool("show_artwork", "Show artwork"),
  bool("show_volume", "Show volume"),
  bool("show_source", "Show source"),
  entity("power_entity", "Power sensor", "sensor"),
  entity("backlight_entity", "Optional backlight", ["light", "switch"]),
];
export const lists = [
  {
    name: "shortcuts",
    label: "Shortcuts",
    fields: [
      entity("entity", "Existing scene/script", ["scene", "script"], true),
      text("label", "Button label"),
    ],
  },
];
export const validate = (c) => validateConfig(c, fields, lists);
