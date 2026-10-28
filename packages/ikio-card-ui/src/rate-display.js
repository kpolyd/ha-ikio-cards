import { numeric, valueText } from "./controls.js";
// Compare throughput on one byte-per-second scale, retaining byte/bit semantics.
export function rateFactor(unit) {
  const text = String(unit || "")
    .replaceAll(" ", "")
    .replace(/^bytes\/s$/, "B/s")
    .replace(/^bits\/s$/, "bit/s");
  const match = /^([kKMGT]?i?)(B|b|bit)(?:\/s|ps)$/.exec(text);
  if (!match) return null;
  const prefix = match[1];
  const power = { "": 0, k: 1, K: 1, M: 2, G: 3, T: 4 }[
    prefix.replace("i", "")
  ];
  if (power === undefined) return null;
  return (
    (prefix.includes("i") ? 1024 : 1000) ** power / (match[2] === "B" ? 1 : 8)
  );
}

// Format at the presentation boundary only. History and plot geometry remain
// full-precision bytes/s; scale labels within the source bit/byte and SI/IEC
// family, preserving HA display precision and locale.
export function rateDisplay(hass, row, bytesPerSecond) {
  const original = hass?.states?.[row.entity];
  if (bytesPerSecond === undefined && numeric(original) === null)
    return valueText(hass, row.entity);
  let unit = row.unit || original?.attributes?.unit_of_measurement || "";
  const factor = rateFactor(unit);
  let raw =
    bytesPerSecond === undefined
      ? original.state
      : String(bytesPerSecond / factor);
  if (factor !== null && Number.isFinite(Number(raw)) && Number(raw) >= 0) {
    unit = unit
      .replaceAll(" ", "")
      .replace(/^bytes\/s$/, "B/s")
      .replace(/^bits\/s$/, "bit/s");
    const binary = /[kKMGT]i/.test(unit);
    const bytes = /B(?:\/s|ps)$/.test(unit);
    const base = binary ? 1024 : 1000;
    const value =
      bytesPerSecond === undefined ? Number(raw) * factor : bytesPerSecond;
    const magnitude = value * (bytes ? 1 : 8);
    let power = 0;
    while (power < 4 && magnitude / base ** power >= base) power++;
    raw = String(magnitude / base ** power);
    unit =
      [
        "",
        binary ? "Ki" : "k",
        binary ? "Mi" : "M",
        binary ? "Gi" : "G",
        binary ? "Ti" : "T",
      ][power] + (bytes ? "B/s" : "bit/s");
  }
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
  // Non-rate readings keep source trailing zeros; scaled rates default to a
  // compact two decimals when HA has no configured precision.
  const [mantissa, exponent = "0"] = String(raw).toLowerCase().split("e");
  const digits = Math.min(
    100,
    Math.max(0, (mantissa.split(".")[1] || "").length - Number(exponent)),
  );
  const formatted = new Intl.NumberFormat(language, {
    minimumFractionDigits: explicit ? precision : factor === null ? digits : 0,
    maximumFractionDigits: explicit
      ? precision
      : factor === null
        ? digits
        : (row.precision ?? 2),
    ...(locale?.number_format === "none" ? { useGrouping: false } : {}),
  }).format(Number(raw));
  return `${formatted} ${unit}`.trim();
}
