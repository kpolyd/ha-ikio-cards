import { text, validateConfig } from "@ikio/card-ui/schema-editor";
export const fields = [
  { ...text("home_model", "Home model file URL"), required: true },
  { ...text("entity_inventory", "Entity inventory file URL"), required: true },
  { ...text("device_bindings", "Device bindings file URL"), required: true },
];
export function normalizeConfig(config) {
  validateConfig(config, []);
  const next = structuredClone(config);
  for (const { name } of fields) {
    if (config[name] !== undefined && typeof config[name] !== "string")
      throw Error("Home 3D configuration inputs must be file URLs");
    if (next[name]) next[name] = next[name].trim();
  }
  next.appearance = { theme: "dark", ...config.appearance };
  return next;
}
export function configurationUrl(value, base) {
  const url = new URL(value, base);
  const origin = new URL(base);
  if (
    url.origin !== origin.origin ||
    url.username ||
    url.password ||
    url.hash ||
    ![
      "http:",
      "https:",
      ...(origin.protocol === "file:" ? ["file:"] : []),
    ].includes(url.protocol)
  ) {
    throw Error("Use configuration files from the same Home Assistant origin");
  }
  return url.href;
}

export const editorOptions = {
  helper:
    "Provide all three JSON configuration file URLs. Home geometry and entity mappings remain in these files.",
};
