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
  bool("confirm_arm", "Review before arming"),
  bool("allow_override", "Show Alarmo open-sensor override"),
];
export const lists = [
  {
    name: "persons",
    label: "Presence",
    fields: [entity("entity", "Person", "person", true), text("name", "Name")],
  },
  {
    name: "contacts",
    label: "Monitored openings",
    fields: [
      entity("entity", "Contact", "binary_sensor", true),
      text("name", "Name"),
    ],
  },
  {
    name: "motion",
    label: "Current motion",
    fields: [
      entity("entity", "Motion / occupancy", "binary_sensor", true),
      text("name", "Name"),
    ],
  },
];
export const validate = (c) => validateConfig(c, fields, lists);
