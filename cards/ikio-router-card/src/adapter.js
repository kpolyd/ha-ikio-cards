import { available, numeric } from "@ikio/card-ui";
import { gaugeDefaults } from "./config.js";
export {
  rateFactor,
  rateHistory,
  uptimeSeconds,
  uptimeLabel,
  availabilityLabel,
} from "../../ikio-server-monitor-card/src/adapter.js";
export function internetStatus(state, override) {
  if (!available(state)) return "unknown";
  const value = String(state.state).trim().toLowerCase();
  if (override?.trim())
    return value === override.trim().toLowerCase() ? "online" : "offline";
  if (
    state.attributes?.device_class === "problem" &&
    ["on", "off"].includes(value)
  )
    return value === "off" ? "online" : "offline";
  if (
    ["on", "online", "connected", "up", "true", "1", "ok", "healthy"].includes(
      value,
    )
  )
    return "online";
  if (["off", "offline", "disconnected", "down", "false", "0"].includes(value))
    return "offline";
  return "unknown";
}
export function gauge(state, metric, config) {
  const value = numeric(state),
    d = gaugeDefaults[metric];
  const settings = Object.fromEntries(
    Object.entries(d).map(([k, v]) => [k, config[metric + "_" + k] ?? v]),
  );
  // Some router integrations label every radio reading dBm, including
  // RSRQ/SNR ratios. Preserve the reported value/unit rather than hiding it.
  const unit = String(state?.attributes?.unit_of_measurement || "").trim();
  const known =
    value !== null && (!unit || ["db", "dbm"].includes(unit.toLowerCase()));
  return {
    unit: unit || (metric === "rsrp" ? "dBm" : "dB"),
    value: known ? value : null,
    fill: known
      ? Math.max(
          0,
          Math.min(
            100,
            (100 * (value - settings.min)) / (settings.max - settings.min),
          ),
        )
      : 0,
    level: !known
      ? "unknown"
      : value < settings.critical
        ? "critical"
        : value < settings.warning
          ? "warning"
          : "normal",
  };
}
