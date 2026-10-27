import { entity, text, validateConfig } from "@ikio/card-ui/schema-editor";
const metrics = [
  ["uptime", "Uptime", "sensor"],
  ["cpu", "CPU utilization", "sensor"],
  ["temperature", "System temperature", "sensor"],
  ["ram_used", "RAM used", "sensor"],
  ["ram_free", "RAM remaining / available", "sensor"],
  ["ram_total", "RAM total (optional with remaining)", "sensor"],
  ["ram_percent", "RAM utilization", "sensor"],
  ["disk_used", "Disk used", "sensor"],
  ["disk_free", "Disk remaining", "sensor"],
  ["disk_total", "Disk total (optional with remaining)", "sensor"],
  ["disk_percent", "Disk utilization", "sensor"],
  ["network_rx", "Network receive rate", "sensor"],
  ["network_tx", "Network transmit rate", "sensor"],
];
export const fields = [
  ...metrics.map(([k, label, domain]) => entity(k + "_entity", label, domain)),
];
export const lists = [
  {
    name: "extra_readings",
    label: "Extra readings",
    item: "reading",
    fields: [
      entity("entity", "Sensor", "sensor", true),
      text("name", "Name (optional)"),
    ],
  },
  {
    name: "services",
    label: "Service status and controls",
    fields: [
      text("name", "Service name"),
      entity("status_entity", "Service health/status", [
        "binary_sensor",
        "sensor",
      ]),
      entity("control_entity", "Service power switch", "switch"),
      entity("restart_action", "Existing restart action", ["script", "button"]),
    ],
  },
];
export const validate = (c) => validateConfig(c, fields, lists);

// Preserve legacy DB bindings without duplicating them or resurrecting a removed chip.
export function migrateConfig(config) {
  if (!config || typeof config !== "object") return config;
  const result = { ...config };
  if (result.extra_readings === undefined && result.database_entity)
    result.extra_readings = [
      { name: "Database", entity: result.database_entity },
    ];
  delete result.database_entity;
  return result;
}
