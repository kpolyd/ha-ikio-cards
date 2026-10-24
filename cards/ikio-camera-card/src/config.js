import { entity, validateConfig } from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("entity", "Camera", "camera", true),
  entity("power_switch", "Camera power switch", "switch"),
  entity("snapshot_automation", "Snapshot automation", "automation"),
  entity("snapshot_script", "Existing snapshot script", "script"),
  entity(
    "capture_timestamp_entity",
    "Image capture timestamp (optional)",
    "sensor",
  ),
];
export const lists = [];
export const validate = (c) => validateConfig(c, fields, lists);
