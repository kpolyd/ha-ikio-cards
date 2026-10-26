import { unitValue, available, formatNumber, valueText } from "@ikio/card-ui";
export function untracked(total, circuits) {
  const values = [
    unitValue(total, "power"),
    ...circuits.map((s) => unitValue(s, "power")),
  ];
  if (values.some((v) => v === null))
    return {
      value: null,
      reason:
        "One or more power readings are unavailable or have incompatible units.",
    };
  const value = values[0] - values.slice(1).reduce((a, b) => a + b, 0);
  return {
    value: value < 0 && value >= -1 ? 0 : value,
    reason: value < -1 ? "Measurements do not reconcile" : "",
  };
}
export function cycleTotal(day, night, confirmed) {
  if (!confirmed) return null;
  const a = unitValue(day, "energy"),
    b = unitValue(night, "energy");
  return a === null || b === null ? null : a + b;
}
export function forecastStatus(config, states, now = Date.now()) {
  if (config.forecast_valid_entity) {
    const s = states[config.forecast_valid_entity];
    if (!available(s)) return "Forecast validity unknown";
    if (s.state !== "on") return "Gathering enough data";
  }
  if (config.forecast_minimum_hours !== undefined) {
    const start = Date.parse(states[config.cycle_start_entity]?.state);
    if (!Number.isFinite(start) || start > now)
      return "Forecast validity unknown";
    if (now - start < config.forecast_minimum_hours * 3600000)
      return "Gathering enough data";
  }
  return null;
}

// Round only presentation; calculations and plotted history retain raw precision.
export function powerNumber(hass, value) {
  return formatNumber(hass, Math.abs(value) < 0.5 ? 0 : value, 0);
}
export function powerText(hass, entity) {
  const value = unitValue(hass?.states?.[entity], "power");
  return value === null
    ? valueText(hass, entity)
    : `${powerNumber(hass, value)} W`;
}
export function energyText(hass, entity) {
  const state = hass?.states?.[entity];
  const value = unitValue(state, "energy");
  if (value !== null) return formatNumber(hass, value);
  return available(state) ? "Incompatible unit" : valueText(hass, entity);
}

// Merge asynchronous sensor changes, carrying the latest known reading forward.
// Missing inputs produce gaps rather than fabricated zero consumption.
export function untrackedHistory(series) {
  const events = series
    .flatMap((points, index) => points.map((point) => ({ ...point, index })))
    .sort((a, b) => a.time - b.time);
  const values = series.map(() => null);
  const result = [];
  for (let i = 0; i < events.length; ) {
    const time = events[i].time;
    while (i < events.length && events[i].time === time) {
      values[events[i].index] = events[i].value;
      i++;
    }
    let value = values.some((v) => v === null)
      ? null
      : values[0] - values.slice(1).reduce((sum, v) => sum + v, 0);
    if (value < 0 && value >= -1) value = 0;
    result.push({ time, value });
  }
  return result;
}
