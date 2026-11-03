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
  { ...number("points_per_hour", "Points per hour", 1, 60), default: 12 },
  { ...bool("static_colour", "Use static colour"), default: false },
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
  for (const key of ["show_extrema", "show_time_labels", "static_colour"])
    if (c[key] !== undefined && typeof c[key] !== "boolean")
      throw Error("Display options must be toggles");
  if (c.points_per_hour !== undefined && !Number.isInteger(c.points_per_hour))
    throw Error("Points per hour must be a whole number");
  return {
    ...c,
    hours: c.hours ?? 6,
    points_per_hour: c.points_per_hour ?? 12,
    static_colour: c.static_colour ?? false,
    graph_height: c.graph_height ?? 32,
    show_extrema: c.show_extrema ?? true,
    show_time_labels: c.show_time_labels ?? true,
  };
}
