import { entity, text, validateConfig } from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("entity", "Vacuum", "vacuum", true),
  entity("battery_entity", "Battery sensor (optional)", "sensor"),
  entity("status_entity", "Supplemental status (optional)", "sensor"),
];
export const lists = [
  {
    name: "maintenance",
    label: "Maintenance readings",
    fields: [
      entity("entity", "Sensor", "sensor", true),
      text("name", "Display name"),
    ],
  },
  {
    name: "missions",
    label: "Existing cleaning missions",
    fields: [
      entity("entity", "Script", "script", true),
      text("label", "Mission name"),
    ],
  },
];
export const validate = (c) => validateConfig(c, fields, lists);
