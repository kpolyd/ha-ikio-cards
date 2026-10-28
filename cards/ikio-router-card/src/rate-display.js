import { numeric, valueText } from "@ikio/card-ui";
import { rateFactor } from "./adapter.js";

// Format at the presentation boundary only. History and plot geometry remain
// full-precision bytes/s; HA owns each sensor's display precision and locale.
export function rateDisplay(hass, row, bytesPerSecond) {
  const original = hass?.states?.[row.entity];
  if (bytesPerSecond === undefined && numeric(original) === null)
    return valueText(hass, row.entity);
  const unit = row.unit || original?.attributes?.unit_of_measurement || "";
  const factor = rateFactor(unit);
  const raw =
    bytesPerSecond === undefined
      ? original.state
      : String(bytesPerSecond / factor);
  const state = {
    ...original,
    entity_id: row.entity,
    state: raw,
    attributes: { ...original?.attributes, unit_of_measurement: unit },
  };
  if (typeof hass?.formatEntityState === "function")
    return hass.formatEntityState(state);

  // Standalone previews/tests do not have HA's formatter. Mirror its registry
  // precision and number-format preferences without importing HA internals.
  const precision = hass?.entities?.[row.entity]?.display_precision;
  const explicit =
    Number.isInteger(precision) && precision >= 0 && precision <= 100;
  const locale = hass?.locale;
  const locales = {
    comma_decimal: "en-US",
    decimal_comma: "de",
    space_comma: "fr",
    quote_decimal: "de-CH",
    none: "en-US",
  };
  const language =
    locale?.number_format === "system"
      ? undefined
      : locales[locale?.number_format] ||
        locale?.language ||
        hass?.language ||
        "en";
  // Preserve source trailing zeros when HA has no configured precision.
  const [mantissa, exponent = "0"] = String(raw).toLowerCase().split("e");
  const digits = Math.min(
    100,
    Math.max(0, (mantissa.split(".")[1] || "").length - Number(exponent)),
  );
  const formatted = new Intl.NumberFormat(language, {
    minimumFractionDigits: explicit ? precision : digits,
    maximumFractionDigits: explicit ? precision : digits,
    ...(locale?.number_format === "none" ? { useGrouping: false } : {}),
  }).format(Number(raw));
  return `${formatted} ${unit}`.trim();
}
