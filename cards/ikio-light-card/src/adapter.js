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
export function deviceLocation(hass, entity, override) {
  if (typeof override === "string" && override.trim()) return override.trim();
  const entry = hass?.entities?.[entity];
  const areaId = entry?.area_id || hass?.devices?.[entry?.device_id]?.area_id;
  return hass?.areas?.[areaId]?.name || "No area assigned";
}
