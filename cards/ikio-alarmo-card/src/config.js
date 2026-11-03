import {
  entity,
  bool,
  number,
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
  { ...bool("show_people", "Show people at home"), default: true },
  bool("show_activity", "Show activity"),
  number("activity_hours", "Activity hours to show", 1, 168),
];
export const lists = [
  {
    name: "ignored_persons",
    label: "Ignored people",
    fields: [entity("entity", "Person", "person", true)],
  },
];
export const validate = (c) => validateConfig(c, fields, lists);
