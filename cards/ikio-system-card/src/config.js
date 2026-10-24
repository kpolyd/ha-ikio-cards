import {
  entity,
  text,
  choice,
  number,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
const metrics = [
  [
    "availability",
    "Availability",
    ["binary_sensor", "sensor", "input_boolean"],
  ],
  ["uptime", "Uptime", "sensor"],
  ["cpu", "CPU utilization", "sensor"],
  ["temperature", "CPU temperature", "sensor"],
  ["ram_used", "RAM used", "sensor"],
  ["ram_total", "RAM total", "sensor"],
  ["ram_percent", "RAM utilization", "sensor"],
  ["disk_used", "Disk used", "sensor"],
  ["disk_total", "Disk total", "sensor"],
  ["disk_percent", "Disk utilization", "sensor"],
  ["database", "Database size", "sensor"],
  ["network_rx", "Network receive rate", "sensor"],
  ["network_tx", "Network transmit rate", "sensor"],
];
export const fields = [
  ...metrics.map(([k, label, domain]) => entity(k + "_entity", label, domain)),
  text("online_state", "Availability state meaning Online (default on)"),
  choice("uptime_mode", "Uptime interpretation", ["duration", "timestamp"]),
];
export const lists = [
  {
    name: "thresholds",
    label: "Metric thresholds",
    fields: [
      choice("metric", "Metric", [
        "cpu",
        "temperature",
        "ram_percent",
        "disk_percent",
      ]),
      number("warning", "Warning threshold", -1000, 1e9, 0.1),
      number("critical", "Critical threshold", -1000, 1e9, 0.1),
      choice("direction", "Threshold direction", ["above", "below"]),
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
