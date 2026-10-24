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
