export function normalizeConfig(config) {
  if (!config || typeof config !== "object")
    throw new Error("Ikio Lights needs a configuration.");
  if (config.schema_version && config.schema_version !== 1)
    throw new Error("Unsupported Ikio Lights configuration version.");
  if (config.lights !== undefined && !Array.isArray(config.lights))
    throw new Error("Lights must be a list.");
  const lights = (config.lights || []).map((row) =>
    typeof row === "string" ? { entity: row } : { ...row },
  );
  if (
    config.group_by_location !== undefined &&
    typeof config.group_by_location !== "boolean"
  )
    throw new Error("Group by location must be a toggle");
  const ids = new Set();
  for (const row of lights) {
    if (!/^(light|switch)\.[\w]+$/.test(row.entity || ""))
      throw new Error("Choose a light or switch entity for every row.");
    if (ids.has(row.entity))
      throw new Error("Each light can only appear once.");
    ids.add(row.entity);
    if (row.location !== undefined && typeof row.location !== "string")
      throw new Error("Location must be a text label");
    if (row.control_mode && !["auto", "power-only"].includes(row.control_mode))
      throw new Error("Unsupported light control mode.");
  }
  const appearance = { theme: "dark", ...config.appearance };
  if (!["dark", "light", "ha"].includes(appearance.theme))
    throw new Error("Choose Dark, Light or Home Assistant theme.");
  return {
    ...config,
    schema_version: 1,
    group_by_location: config.group_by_location ?? false,
    lights,
    appearance,
  };
}

export const fields = [
  {
    name: "group_by_location",
    label: "Group by location",
    selector: { boolean: {} },
    default: false,
  },
];
export const lists = [
  {
    name: "lights",
    label: "Lights",
    item: "light or switch",
    fields: [
      {
        name: "entity",
        label: "Light or switch",
        required: true,
        selector: { entity: { filter: { domain: ["light", "switch"] } } },
      },
      { name: "name", label: "Name (optional)", selector: { text: {} } },
      { name: "icon", label: "Icon (optional)", selector: { icon: {} } },
      {
        name: "location",
        label: "Location (optional override)",
        selector: { text: {} },
      },
    ],
  },
];
export const editorOptions = {
  defaults: { group_by_location: false },
  helper:
    "Tap to toggle. Hold for native Home Assistant details, including brightness and colour. Location comes from the entity or device area; an optional location label overrides it.",
};
export function normalizeEditor(config) {
  return {
    ...config,
    lights: (config.lights || []).map((row) =>
      typeof row === "string" ? { entity: row } : row,
    ),
  };
}
