import { catalogs } from "./translations/index.js";
export function language(hass) {
  const selected =
    typeof hass === "string"
      ? hass
      : hass?.locale?.language || hass?.language || "en";
  return String(selected).replaceAll("_", "-").toLowerCase();
}
export function t(hass, key, params = {}) {
  if (typeof key !== "string") return key;
  const locale = language(hass),
    base = locale.split("-")[0];
  const own = (code) =>
    Object.hasOwn(catalogs[code] || {}, key) ? catalogs[code][key] : undefined;
  const resolved = [locale, base, "en"].find((code) => own(code));
  let value = (resolved && own(resolved)) || key;
  if (typeof value === "object") {
    let plural = "other";
    try {
      plural = new Intl.PluralRules(resolved || "en").select(
        Number(params.count),
      );
    } catch {
      /* English fallback for malformed locale. */
    }
    value = value[plural] || value.other || key;
  }
  return String(value).replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
export function stateLabel(hass, state) {
  const labels = {
    on: "On",
    off: "Off",
    unknown: "Unknown",
    unavailable: "Unavailable",
    cooling: "Cooling",
    heating: "Heating",
    idle: "Idle",
    drying: "Drying",
    fan: "Fan",
    heat: "Heat",
    cool: "Cool",
    auto: "Auto",
    dry: "Dry",
    fan_only: "Fan",
    heat_cool: "Heat / cool",
    disarmed: "Disarmed",
    armed_home: "Armed home",
    armed_away: "Armed away",
    armed_night: "Armed night",
    armed_vacation: "Armed vacation",
    armed_custom_bypass: "Armed custom bypass",
    arming: "Arming",
    pending: "Entry delay",
    triggered: "Triggered",
    locked: "Locked",
    unlocked: "Unlocked",
    open: "Open",
    closed: "Closed",
    playing: "Playing",
    paused: "Paused",
    docked: "Docked",
    cleaning: "Cleaning",
    returning: "Returning to dock",
    stopped: "Stopped",
    night: "Night",
    vacation: "Vacation",
    custom_bypass: "Custom bypass",
    home: "Home",
    not_home: "Away",
  };
  return labels[state] ? t(hass, labels[state]) : state;
}

// Schema validation uses fixed English messages internally; translate at the UI boundary.
export function translateError(hass, message) {
  const patterns = [
    [
      /^(.*): choose a compatible entity$/,
      "{label}: choose a compatible entity",
    ],
    [
      /^(.*): value outside permitted range$/,
      "{label}: value outside permitted range",
    ],
    [/^(.*) must be a list$/, "{label} must be a list"],
    [/^Show (.*) must be a toggle$/, "Show {label} must be a toggle"],
  ];
  if (Object.hasOwn(catalogs.en, message)) return t(hass, message);
  for (const [pattern, key] of patterns) {
    const match = pattern.exec(message);
    if (match) return t(hass, key, { label: t(hass, match[1]) });
  }
  return message;
}
