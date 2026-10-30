import { number, validateConfig } from "@ikio/card-ui/schema-editor";
export const fields = [
  number("low_threshold", "Low battery threshold (%)", 0, 100),
  number("collapse_threshold", "Collapse batteries above (%)", 0, 100),
  {
    name: "ignored_devices",
    label: "Ignored devices",
    selector: { device: { multiple: true } },
  },
];
export function normalizeConfig(config) {
  validateConfig(config, fields);
  if (config.name !== undefined && typeof config.name !== "string")
    throw Error("Card name must be text");
  if (
    config.ignored_devices !== undefined &&
    (!Array.isArray(config.ignored_devices) ||
      config.ignored_devices.some((id) => typeof id !== "string" || !id.trim()))
  )
    throw Error("Ignored devices must be a list of device IDs");
  return {
    ...structuredClone(config),
    schema_version: 1,
    low_threshold: config.low_threshold ?? 25,
    collapse_threshold: config.collapse_threshold ?? 80,
    ignored_devices: [...new Set(config.ignored_devices || [])],
    appearance: { theme: "dark", ...config.appearance },
  };
}
