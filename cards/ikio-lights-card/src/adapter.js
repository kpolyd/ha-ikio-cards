import { t } from "@ikio/card-ui/i18n";
import { available } from "@ikio/card-ui";
// Display only reported, supported values. HA supplies normalized rgb_color
// for colour modes (including HS/XY/RGBW); missing colour stays neutral.
export function lightAppearance(state, row = {}) {
  const result = { brightness: null, colour: null };
  if (
    !available(state) ||
    state.state !== "on" ||
    row.control_mode === "power-only" ||
    (row.entity || state.entity_id || "").startsWith("switch.")
  )
    return result;
  const a = state.attributes || {},
    modes = Array.isArray(a.supported_color_modes)
      ? a.supported_color_modes
      : [];
  const supported = [
    "brightness",
    "white",
    "color_temp",
    "hs",
    "xy",
    "rgb",
    "rgbw",
    "rgbww",
  ];
  if (!modes.some((mode) => supported.includes(mode))) return result;
  if (Number.isFinite(a.brightness) && a.brightness >= 0 && a.brightness <= 255)
    result.brightness = (a.brightness / 255) * 100;
  const mode = a.color_mode || (modes.length === 1 ? modes[0] : undefined);
  if (mode === "color_temp" && modes.includes("color_temp")) {
    const kelvin =
      a.color_temp_kelvin ??
      (Number.isFinite(a.color_temp) && a.color_temp > 0
        ? 1000000 / a.color_temp
        : null);
    if (Number.isFinite(kelvin) && kelvin >= 1000 && kelvin <= 40000) {
      const t = kelvin / 100;
      const rgb = [
        t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592,
        t <= 66
          ? 99.4708025861 * Math.log(t) - 161.1195681661
          : 288.1221695283 * (t - 60) ** -0.0755148492,
        t >= 66
          ? 255
          : t <= 19
            ? 0
            : 138.5177312231 * Math.log(t - 10) - 305.0447927307,
      ];
      result.colour = `rgb(${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(", ")})`;
    }
  } else if (
    ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(mode) &&
    modes.includes(mode)
  ) {
    if (
      Array.isArray(a.rgb_color) &&
      a.rgb_color.length === 3 &&
      a.rgb_color.every((v) => Number.isFinite(v) && v >= 0 && v <= 255)
    )
      result.colour = `rgb(${a.rgb_color.map(Math.round).join(", ")})`;
  } else if (mode === "white" && modes.includes("white"))
    result.colour = "rgb(255, 255, 255)";
  return result;
}
export function lightState(state, row, format) {
  return {
    available: available(state),
    on: state?.state === "on",
    status: !state
      ? "Entity not found"
      : !available(state)
        ? format?.(state) || state.state
        : state.state === "on"
          ? "On"
          : "Off",
  };
}
// An entity-specific area overrides its device area, following HA's area assignment.
export function deviceLocation(
  hass,
  entity,
  override,
  fallback = "No area assigned",
) {
  if (typeof override === "string" && override.trim()) return override.trim();
  const entry = hass?.entities?.[entity];
  const areaId = entry?.area_id || hass?.devices?.[entry?.device_id]?.area_id;
  return hass?.areas?.[areaId]?.name || t(hass, fallback);
}

// Preserve first-occurrence area order and configured light order within each area.
export function groupLights(lights, hass) {
  const groups = new Map();
  for (const light of lights) {
    const location = deviceLocation(
      hass,
      light.entity,
      light.location,
      "Unassigned",
    );
    if (!groups.has(location)) groups.set(location, { location, lights: [] });
    groups.get(location).lights.push(light);
  }
  const rows = [];
  let used = 3;
  for (const group of groups.values()) {
    group.columns = Math.min(3, group.lights.length);
    if (used + group.columns > 3) {
      rows.push([]);
      used = 0;
    }
    rows.at(-1).push(group);
    used += group.columns;
  }
  return rows;
}
