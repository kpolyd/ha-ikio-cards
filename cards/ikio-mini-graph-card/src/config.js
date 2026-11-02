import {
  entity,
  number,
  bool,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("primary_entity", "Primary numeric entity", "sensor", true),
  entity("secondary_entity", "Secondary entity (optional)"),
  { ...number("hours", "History hours", 1, 168), default: 6 },
  number(
    "expected_min",
    "Minimum colour value (empty = Auto)",
    -1e9,
    1e9,
    0.01,
  ),
  number(
    "expected_max",
    "Maximum colour value (empty = Auto)",
    -1e9,
    1e9,
    0.01,
  ),
  { ...number("graph_height", "Graph height (px)", 24, 120), default: 32 },
  { ...bool("show_extrema", "Show minimum and maximum"), default: true },
  { ...bool("show_time_labels", "Show time labels"), default: true },
];
export const lists = [];
export function normalizeConfig(config) {
  const c = structuredClone(config);
  for (const key of ["expected_min", "expected_max"])
    if (c[key] === "" || c[key] === null) delete c[key];
  validateConfig(c, fields);
  if (
    Number.isFinite(c.expected_min) &&
    Number.isFinite(c.expected_max) &&
    c.expected_min >= c.expected_max
  )
    throw Error("Expected minimum must be less than maximum");
  for (const key of ["show_extrema", "show_time_labels"])
    if (c[key] !== undefined && typeof c[key] !== "boolean")
      throw Error("Display options must be toggles");
  return {
    ...c,
    hours: c.hours ?? 6,
    graph_height: c.graph_height ?? 32,
    show_extrema: c.show_extrema ?? true,
    show_time_labels: c.show_time_labels ?? true,
  };
}
