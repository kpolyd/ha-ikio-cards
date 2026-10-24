import { available, numeric } from "@ikio/card-ui";
export function aggregate(states, active = "on", secure = "off") {
  if (!states.length) return "Not configured";
  if (states.some((s) => available(s) && s.state === active)) return "Open";
  if (states.some((s) => !available(s) || s.state !== secure)) return "Unknown";
  return "Closed";
}
// HA lock entities use locked/unlocked; lock binary sensors use off/on.
// Keep legacy "unlocked" configs working with binary sensors too.
export function lockState(state, mode = "auto") {
  if (!state) return "Unavailable";
  const raw = String(state.state ?? "")
    .trim()
    .toLowerCase();
  if (raw === "unavailable") return "Unavailable";
  if (raw === "locked") return "Locked";
  if (raw === "unlocked") return "Unlocked";
  const nativeLock = state.entity_id?.startsWith("lock.");
  if (nativeLock && raw === "open") return "Unlocked";
  if (nativeLock && (raw === "unlocking" || raw === "opening"))
    return "Unlocking";
  if (nativeLock && raw === "locking") return "Locking";
  if (nativeLock && raw === "jammed") return "Jammed";
  if (raw === "on" || raw === "off")
    return raw === (mode === "off" ? "off" : "on") ? "Unlocked" : "Locked";
  return "Unknown";
}
export function locksSummary(states, mode = "auto") {
  if (!states.length) return "Not configured";
  const mapped = states.map((state) => lockState(state, mode));
  for (const status of [
    "Unlocked",
    "Jammed",
    "Unavailable",
    "Unknown",
    "Unlocking",
    "Locking",
  ])
    if (mapped.includes(status)) return status;
  return "Locked";
}
export function mapUrl(state) {
  const lat = state?.attributes?.latitude,
    lon = state?.attributes?.longitude;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;
}
export function fuelPercent(state, capacity) {
  const value = numeric(state);
  if (value === null) return null;
  if (state.attributes?.unit_of_measurement === "%")
    return value >= 0 && value <= 100 ? value : null;
  const unit = state.attributes?.unit_of_measurement;
  if (
    !["L", "l", "gal", "mL"].includes(unit) ||
    !Number.isFinite(capacity) ||
    capacity <= 0
  )
    return null;
  const percent = (value / capacity) * 100;
  return percent >= 0 && percent <= 100 ? percent : null;
}
