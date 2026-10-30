import { entity, validateConfig } from "@ikio/card-ui/schema-editor";
export const domains = [
  "light",
  "switch",
  "input_boolean",
  "sensor",
  "person",
  "binary_sensor",
  "button",
  "input_button",
];
export const fields = [
  entity("entity", "Entity", domains, true),
  { name: "icon", label: "Icon (optional)", selector: { icon: {} } },
];
export function normalizeConfig(c) {
  validateConfig(c, fields);
  for (const key of ["name", "icon"])
    if (c[key] !== undefined && typeof c[key] !== "string")
      throw Error("Card name must be text");
  return {
    ...structuredClone(c),
    schema_version: 1,
    appearance: { theme: "dark", ...c.appearance },
  };
}
