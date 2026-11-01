import {
  entity,
  text,
  number,
  bool,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
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
  { ...bool("show_legend", "Show readings"), default: true },
];
export const lists = [
  {
    name: "entities",
    label: "Graph entities",
    fields: [
      entity("entity", "Numeric entity", "sensor", true),
      text("name", "Display name"),
      number(
        "expected_min",
        "Expected minimum (optional override)",
        -1e9,
        1e9,
        0.01,
      ),
      number(
        "expected_max",
        "Expected maximum (optional override)",
        -1e9,
        1e9,
        0.01,
      ),
    ],
  },
];
export function normalizeConfig(config) {
  const c = structuredClone(config);
  const clean = (value) => {
    const result = { ...value };
    for (const key of ["expected_min", "expected_max"])
      if (result[key] === "" || result[key] === null) delete result[key];
    return result;
  };
  const result = clean(c);
  if (Array.isArray(result.entities))
    result.entities = result.entities.map(clean);
  validate(result);
  return result;
}
export function validate(c) {
  validateConfig(c, fields, lists);
  if (
    Number.isFinite(c.expected_min) &&
    Number.isFinite(c.expected_max) &&
    c.expected_min >= c.expected_max
  )
    throw Error("Expected minimum must be less than maximum");
  for (const row of c.entities || []) {
    const min = row.expected_min ?? c.expected_min,
      max = row.expected_max ?? c.expected_max;
    if (Number.isFinite(min) && Number.isFinite(max) && min >= max)
      throw Error("Series expected minimum must be less than maximum");
  }
}
export const editorOptions = {
  sections: [
    { fields: [fields[0], fields[3]] },
    { label: "Colour range (optional)", fields: [fields[1], fields[2]] },
  ],
};
