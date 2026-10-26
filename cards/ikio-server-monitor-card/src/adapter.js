import { numeric, unitValue, formatNumber, valueText } from "@ikio/card-ui";
export function wholeValueText(hass, id) {
  const state = hass?.states?.[id];
  const value = numeric(state);
  return value === null
    ? valueText(hass, id)
    : `${formatNumber(hass, value, 0)} ${state.attributes?.unit_of_measurement || ""}`.trim();
}
function storageCapacity(used, total, remaining) {
  const rawUsed = unitValue(used, "storage");
  const u = rawUsed !== null && rawUsed >= 0 ? rawUsed : null;
  const explicitTotal = unitValue(total, "storage");
  const free = unitValue(remaining, "storage");
  const t =
    explicitTotal !== null && explicitTotal > 0
      ? explicitTotal
      : u !== null && free !== null && free >= 0
        ? u + free
        : null;
  return { used: u, total: t };
}
export function capacityText(hass, used, total, remaining) {
  const capacity = storageCapacity(used, total, remaining);
  const source = [used, total, remaining].find(
    (state) =>
      unitValue({ state: "1", attributes: state?.attributes }, "storage") !==
      null,
  );
  const factor = unitValue(
    { state: "1", attributes: source?.attributes },
    "storage",
  );
  const unit = source?.attributes?.unit_of_measurement;
  const text = (value) =>
    value === null || factor === null
      ? "—"
      : `${formatNumber(hass, value / factor, 0)} ${unit}`;
  return `${text(capacity.used)} / ${text(capacity.total)}`;
}
export function utilization(percent, used, total, remaining) {
  const p = numeric(percent);
  if (p !== null && percent.attributes?.unit_of_measurement === "%") return p;
  const capacity = storageCapacity(used, total, remaining);
  return capacity.used !== null && capacity.total !== null && capacity.total > 0
    ? (capacity.used / capacity.total) * 100
    : null;
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

export function uptimeSeconds(state, mode = "auto", now = Date.now()) {
  if (!state || ["unknown", "unavailable"].includes(state.state)) return null;
  const raw = String(state.state).trim();
  const timestamp = /^\d{4}-\d{2}-\d{2}(?:T| )/.test(raw);
  if (mode === "timestamp" || (mode === "auto" && timestamp)) {
    const start = Date.parse(state.state);
    return Number.isFinite(start) && start <= now ? (now - start) / 1000 : null;
  }
  let value = numeric(state);
  let unit = String(state.attributes?.unit_of_measurement || "")
    .trim()
    .toLowerCase();
  if (value === null && mode === "auto") {
    const words =
      /^(\d+(?:\.\d+)?)\s*(milliseconds?|ms|seconds?|s|minutes?|min|hours?|h|days?|d|weeks?|w)$/i.exec(
        raw,
      );
    if (words) {
      value = Number(words[1]);
      unit = words[2].toLowerCase();
    }
    const clock = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(raw);
    if (clock)
      return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  }
  const factor = {
    ms: 0.001,
    millisecond: 0.001,
    milliseconds: 0.001,
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
  }[unit];
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

export function availabilityLabel(state) {
  if (!state || state.state === "unknown") return "Unknown";
  if (state.state === "unavailable") return "Unavailable";
  const value = String(state.state).trim().toLowerCase();
  if (
    state.attributes?.device_class === "problem" &&
    ["on", "off"].includes(value)
  )
    return value === "off" ? "Online" : "Offline";
  if (
    [
      "on",
      "online",
      "connected",
      "running",
      "up",
      "healthy",
      "ok",
      "ready",
      "true",
      "1",
    ].includes(value)
  )
    return "Online";
  if (
    [
      "off",
      "offline",
      "disconnected",
      "stopped",
      "down",
      "unhealthy",
      "false",
      "0",
    ].includes(value)
  )
    return "Offline";
  return String(state.state) || "Unknown";
}

export const metricThresholds = Object.freeze({ warning: 70, critical: 85 });
export const metricLevel = (value) => threshold(value, metricThresholds);
