import { available } from "@ikio/card-ui";
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
  return hass?.areas?.[areaId]?.name || fallback;
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
