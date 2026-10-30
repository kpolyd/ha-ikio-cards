import {
  entity,
  showNameField,
  text,
  choice,
  number,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
const sensor = (key, label) => entity(key + "_entity", label, "sensor");
const status = (key, label) =>
  entity(key + "_entity", label, ["binary_sensor", "sensor"]);
export const sections = [
  {
    label: "Router",
    fields: [
      status("availability", "Router availability"),
      sensor("local_ip", "Local IP"),
      sensor("uptime", "Uptime"),
    ],
  },
  {
    label: "Internet",
    fields: [
      status("internet_status", "Internet connection status"),
      text("connected_state", "Connected state (optional override)"),
      sensor("internet_ip", "Internet / WAN IP"),
      sensor("latency", "Latency"),
    ],
  },
  { label: "Devices", fields: [sensor("devices", "Connected-device count")] },
  {
    label: "Network traffic",
    fields: [
      sensor("network_rx", "Download rate"),
      sensor("network_tx", "Upload rate"),
      number("history_minutes", "History duration (minutes)", 5, 1440),
      number("graph_height", "Graph height (px)", 80, 300),
    ],
  },
  {
    label: "Connection",
    fields: [
      choice("connection_type", "Connection type", [
        { value: "generic", label: "Generic" },
        { value: "ethernet", label: "Ethernet" },
        { value: "fibre", label: "Fibre" },
        { value: "dsl", label: "DSL" },
        { value: "cellular", label: "Cellular" },
      ]),
    ],
  },
  {
    label: "Cellular readings",
    visible: (config) => config.connection_type === "cellular",
    fields: [
      sensor("network_type", "Network type (4G / 5G / LTE)"),
      sensor("signal", "Signal percentage"),
      sensor("rsrp", "Strength (RSRP)"),
      sensor("rsrq", "Quality (RSRQ)"),
      sensor("snr", "SNR / SINR"),
    ],
  },
  ...["rsrp", "rsrq", "snr"].map((metric) => ({
    label: { rsrp: "RSRP gauge", rsrq: "RSRQ gauge", snr: "SNR gauge" }[metric],
    visible: (config) => config.connection_type === "cellular",
    fields: [
      number(metric + "_min", "Gauge minimum", -200, 100, 0.1),
      number(metric + "_max", "Gauge maximum", -200, 100, 0.1),
      number(metric + "_warning", "Warning below", -200, 100, 0.1),
      number(metric + "_critical", "Critical below", -200, 100, 0.1),
    ],
  })),
];
export const fields = sections.flatMap((s) => s.fields);
export const lists = [
  {
    name: "extra_readings",
    label: "Extra readings",
    item: "reading",
    fields: [
      entity("entity", "Sensor", "sensor", true),
      text("name", "Name (optional)"),
      showNameField,
    ],
  },
];
export const defaults = {
  connection_type: "generic",
  history_minutes: 30,
  graph_height: 132,
};
export const gaugeDefaults = {
  rsrp: { min: -130, max: -60, warning: -90, critical: -110 },
  rsrq: { min: -20, max: -3, warning: -10, critical: -15 },
  snr: { min: -10, max: 30, warning: 13, critical: 0 },
};
export function validate(c) {
  validateConfig(c, fields, lists);
  for (const row of c.extra_readings || [])
    if (row.show_name !== undefined && typeof row.show_name !== "boolean")
      throw Error("Show name must be a toggle");
  if (
    c.connection_type &&
    !["generic", "ethernet", "fibre", "dsl", "cellular"].includes(
      c.connection_type,
    )
  )
    throw Error("Unsupported connection type");
  for (const [metric, d] of Object.entries(gaugeDefaults)) {
    if ((c[metric + "_min"] ?? d.min) >= (c[metric + "_max"] ?? d.max))
      throw Error("Gauge minimum must be below maximum");
    if (
      (c[metric + "_critical"] ?? d.critical) >
      (c[metric + "_warning"] ?? d.warning)
    )
      throw Error("Critical threshold must not exceed warning threshold");
  }
}

export const editorOptions = {
  sections,
  defaults: () => ({
    ...defaults,
    ...Object.fromEntries(
      Object.entries(gaugeDefaults).flatMap(([metric, values]) =>
        Object.entries(values).map(([key, value]) => [
          `${metric}_${key}`,
          value,
        ]),
      ),
    ),
  }),
};
