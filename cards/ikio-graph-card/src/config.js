import {
  entity,
  text,
  number,
  bool,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
  number("hours", "History hours", 1, 168),
  number("expected_min", "Expected minimum", -1e9, 1e9, 0.01),
  number("expected_max", "Expected maximum", -1e9, 1e9, 0.01),
  bool("show_legend", "Show current-value legend"),
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
export function validate(c) {
  validateConfig(c, fields, lists);
  if ((c.expected_min ?? 0) >= (c.expected_max ?? 3500))
    throw Error("Expected minimum must be less than maximum");
  for (const row of c.entities || [])
    if (
      (row.expected_min ?? c.expected_min ?? 0) >=
      (row.expected_max ?? c.expected_max ?? 3500)
    )
      throw Error("Series expected minimum must be less than maximum");
}
