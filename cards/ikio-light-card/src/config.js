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
  return { ...config, schema_version: 1, lights, appearance };
}
