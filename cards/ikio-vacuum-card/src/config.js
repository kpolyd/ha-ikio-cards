import { entity, validateConfig } from "@ikio/card-ui/schema-editor";
export const fields = [entity("entity", "Vacuum", "vacuum", true)];
export function normalize(config) {
  if (!config || typeof config !== "object") return config;
  const result = structuredClone(config);
  for (const key of [
    "name",
    "appearance",
    "battery_entity",
    "status_entity",
    "maintenance",
    "missions",
  ])
    delete result[key];
  return result;
}
export function validate(config) {
  if (Array.isArray(config))
    throw Error("Choose entities using the visual editor.");
  validateConfig(config, fields);
}
