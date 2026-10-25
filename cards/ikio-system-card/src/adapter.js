import { numeric, unitValue } from "@ikio/card-ui";
export function utilization(percent, used, total) {
  const p = numeric(percent);
  if (p !== null && percent.attributes?.unit_of_measurement === "%") return p;
  const u = unitValue(used, "storage"),
    t = unitValue(total, "storage");
  return u !== null && t !== null && t > 0 ? (u / t) * 100 : null;
}
export function threshold(value, rule) {
  if (value === null || !rule) return "";
  const matches = (n) =>
    Number.isFinite(n) &&
    (rule.direction === "below" ? value <= n : value >= n);
  return matches(rule.critical)
    ? "critical"
    : matches(rule.warning)
      ? "warning"
      : "";
}

export function uptimeSeconds(state, mode = "duration", now = Date.now()) {
  if (!state || ["unknown", "unavailable"].includes(state.state)) return null;
  if (mode === "timestamp") {
    const start = Date.parse(state.state);
    return Number.isFinite(start) && start <= now ? (now - start) / 1000 : null;
  }
  const value = numeric(state);
  const factor = {
    ms: 0.001,
    s: 1,
    sec: 1,
    second: 1,
    seconds: 1,
    min: 60,
    minute: 60,
    minutes: 60,
    h: 3600,
    hr: 3600,
    hour: 3600,
    hours: 3600,
    d: 86400,
    day: 86400,
    days: 86400,
    w: 604800,
    week: 604800,
    weeks: 604800,
  }[
    String(state.attributes?.unit_of_measurement || "")
      .trim()
      .toLowerCase()
  ];
  return value !== null && value >= 0 && factor !== undefined
    ? value * factor
    : null;
}
export function uptimeLabel(seconds, language = "en") {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const [divisor, unit] =
    seconds >= 86400
      ? [86400, "day"]
      : seconds >= 3600
        ? [3600, "hour"]
        : seconds >= 60
          ? [60, "minute"]
          : [1, "second"];
  const count = Math.floor(seconds / divisor);
  return `Up for ${new Intl.NumberFormat(language).format(count)} ${unit}${count === 1 ? "" : "s"}`;
}

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
export function rateHistory(data, unit) {
  let attributes = { unit_of_measurement: unit };
  return (data || [])
    .map((item) => ({
      item,
      time: Number.isFinite(item.lu)
        ? item.lu * 1000
        : Date.parse(item.last_updated || item.last_changed),
    }))
    .filter((row) => Number.isFinite(row.time))
    .sort((a, b) => a.time - b.time)
    .map(({ item, time }) => {
      attributes = item.a || item.attributes || attributes;
      const factor = rateFactor(attributes.unit_of_measurement);
      const raw = item.s ?? item.state;
      const value =
        raw !== undefined && String(raw).trim() !== "" ? Number(raw) : NaN;
      return {
        time,
        value:
          factor !== null && Number.isFinite(value) && value >= 0
            ? value * factor
            : null,
      };
    });
}
