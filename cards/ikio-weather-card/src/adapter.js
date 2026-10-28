import { language, t } from "@ikio/card-ui/i18n";
import { formatNumber } from "@ikio/card-ui";
export const finite = (v) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export function supportedTypes(state) {
  const features = Number(state?.attributes?.supported_features) || 0;
  return [
    ["daily", 1],
    ["hourly", 2],
    ["twice_daily", 4],
  ]
    .filter(([, flag]) => features & flag)
    .map(([type]) => type);
}
export function forecastRows(forecast, type, hass, now = Date.now()) {
  if (!Array.isArray(forecast)) return [];
  const zone = hass?.config?.time_zone || "UTC";
  const day = (date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  const seen = new Set();
  return forecast
    .filter((row) => {
      if (!row || typeof row.datetime !== "string") return false;
      const stamp = Date.parse(row.datetime);
      if (!Number.isFinite(stamp) || seen.has(stamp)) return false;
      if (
        type === "daily"
          ? day(stamp) < day(now)
          : stamp + (type === "hourly" ? 3600000 : 43200000) <= now
      )
        return false;
      seen.add(stamp);
      return true;
    })
    .sort((a, b) => Date.parse(a.datetime) - Date.parse(b.datetime));
}
export function slotLabel(hass, entry, type) {
  const options = { timeZone: hass?.config?.time_zone || "UTC" };
  if (type === "hourly") {
    options.hour = "2-digit";
    options.minute = "2-digit";
    const format = hass?.locale?.time_format;
    if (format === "12") options.hour12 = true;
    if (format === "24") options.hour12 = false;
  } else {
    options.weekday = "short";
  }
  return new Intl.DateTimeFormat(language(hass), options).format(
    new Date(entry.datetime),
  );
}
export function metric(
  hass,
  state,
  attr,
  value = state?.attributes?.[attr],
  unit = "",
) {
  if (finite(value) === null) return "—";
  if (hass?.formatEntityAttributeValue) {
    const formatted = hass.formatEntityAttributeValue(state, attr, value);
    if (typeof formatted === "string" && formatted.trim()) return formatted;
  }
  return `${formatNumber(hass, value, attr === "precipitation" ? 2 : 1)}${unit ? ` ${unit}` : ""}`;
}
const conditions = {
  "clear-night": ["mdi:weather-night", "Clear night"],
  cloudy: ["mdi:weather-cloudy", "Cloudy"],
  exceptional: ["mdi:alert-circle-outline", "Exceptional"],
  fog: ["mdi:weather-fog", "Fog"],
  hail: ["mdi:weather-hail", "Hail"],
  lightning: ["mdi:weather-lightning", "Lightning"],
  "lightning-rainy": ["mdi:weather-lightning-rainy", "Thunderstorms"],
  partlycloudy: ["mdi:weather-partly-cloudy", "Partly cloudy"],
  pouring: ["mdi:weather-pouring", "Pouring"],
  rainy: ["mdi:weather-rainy", "Rainy"],
  snowy: ["mdi:weather-snowy", "Snowy"],
  "snowy-rainy": ["mdi:weather-snowy-rainy", "Snow and rain"],
  sunny: ["mdi:weather-sunny", "Sunny"],
  windy: ["mdi:weather-windy", "Windy"],
  "windy-variant": ["mdi:weather-windy-variant", "Wind and clouds"],
};
export function condition(hass, value) {
  const [icon, label] = conditions[value] || [
    "mdi:help-circle-outline",
    "Unknown",
  ];
  return {
    icon,
    label:
      hass?.localize?.(`component.weather.entity_component._.state.${value}`) ||
      t(hass, label),
  };
}
export function windDirection(bearing) {
  if (finite(bearing) !== null)
    return ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"][
      Math.round((((bearing % 360) + 360) % 360) / 45) % 8
    ];
  if (typeof bearing === "string" && /^[NESW]{1,3}$/i.test(bearing))
    return bearing.toUpperCase();
  return "";
}
