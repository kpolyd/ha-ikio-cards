import {
  showNameField,
  entity,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("entity", "Entity", ["sensor", "person", "switch", "light"], true),
  showNameField,
  { name: "icon", label: "Icon (optional)", selector: { icon: {} } },
];
export function validate(config) {
  validateConfig(config, fields);
  if (config.show_name !== undefined && typeof config.show_name !== "boolean")
    throw Error("Show name must be a toggle");
  for (const key of ["name", "icon"])
    if (config[key] !== undefined && typeof config[key] !== "string")
      throw Error(
        key === "name" ? "Card name must be text" : "Icon must be text",
      );
}
export function normalizeConfig(config) {
  validate(config);
  return {
    ...structuredClone(config),
    schema_version: 1,
    show_name: config.show_name ?? true,
    appearance: { theme: "dark", ...config.appearance },
  };
}
