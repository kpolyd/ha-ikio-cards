import {
  entity,
  text,
  bool,
  choice,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("entity", "Alarm panel", "alarm_control_panel", true),
  choice(
    "modes",
    "Arming modes",
    ["home", "away", "night", "vacation", "custom_bypass"],
    true,
  ),
  bool("allow_override", "Show Alarmo open-sensor override"),
];
export const lists = [
  {
    name: "contacts",
    label: "Extra openings (optional; Alarmo sensors are automatic)",
    fields: [
      entity("entity", "Contact", "binary_sensor", true),
      text("name", "Name"),
    ],
  },
  {
    name: "motion",
    label: "Extra motion (optional; Alarmo sensors are automatic)",
    fields: [
      entity("entity", "Motion / occupancy", "binary_sensor", true),
      text("name", "Name"),
    ],
  },
];
export const validate = (c) => validateConfig(c, fields, lists);
