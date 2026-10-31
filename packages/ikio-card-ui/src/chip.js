import { el, button, valueText, stateText } from "./controls.js";
import { details, entityName } from "./card.js";

// One renderer and geometry for standalone cards, badges and embedded readings.
export const chipStyles = `
.ikio-sensor-chip.ae-button{display:inline-flex;align-items:center;gap:0;min-height:44px;min-width:44px;max-width:100%;padding:0;border:0;border-radius:7px;background:transparent;color:var(--ae-text);text-align:left;font:inherit}
.ikio-chip-surface{display:inline-flex;align-items:center;gap:5px;min-height:28px;max-width:100%;padding:4px 7px;border:1px solid var(--ae-border);border-radius:7px;background:var(--ae-well)}
.ikio-sensor-chip.with-name .ikio-chip-surface{min-height:34px;padding:3px 7px}
.ikio-sensor-chip ha-state-icon{--mdc-icon-size:16px;flex:none;color:var(--ikio-chip-color,var(--ae-accent))}
.ikio-chip-text{display:grid;gap:0;min-width:0}
.ikio-chip-name{font-size:11px;line-height:12px;font-weight:400;color:var(--ae-muted);overflow-wrap:anywhere}
.ikio-chip-value{font-size:12px;line-height:14px;font-weight:500;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.ikio-chip-name[hidden]{display:none}
`;
// Keep status semantics shared by cards, badges and embedded chips. Numeric
// sensors have no implicit thresholds; their normal reading stays neutral.
function chipColor(state, entity) {
  const value = state?.state;
  if (!value || ["unknown", "unavailable"].includes(value)) return "muted";
  const domain = entity?.split(".")[0];
  const deviceClass = state.attributes?.device_class;
  if (domain === "binary_sensor") {
    if (!["on", "off"].includes(value)) return "muted";
    if (deviceClass === "connectivity")
      return value === "on" ? "temperature" : "error";
    if (
      [
        "battery",
        "carbon_monoxide",
        "gas",
        "moisture",
        "problem",
        "safety",
        "smoke",
        "tamper",
      ].includes(deviceClass)
    )
      return value === "on" ? "error" : "temperature";
    if (
      ["door", "garage_door", "lock", "opening", "window"].includes(deviceClass)
    )
      return value === "on" ? "warning" : "temperature";
    return value === "on" ? "accent" : "muted";
  }
  if (domain === "person" || domain === "device_tracker")
    return value === "home" ? "temperature" : "muted";
  if (domain === "lock") {
    if (value === "locked") return "temperature";
    if (value === "jammed") return "error";
    return "warning";
  }
  if (domain === "cover") return value === "closed" ? "temperature" : "warning";
  if (domain === "alarm_control_panel") {
    if (value === "triggered") return "error";
    if (["pending", "arming", "disarming"].includes(value)) return "warning";
    return value.startsWith("armed_") ? "temperature" : "muted";
  }
  if (["error", "problem", "jammed"].includes(value)) return "error";
  if (["off", "idle", "standby", "paused", "docked"].includes(value))
    return "muted";
  if (value === "heat") return "warning";
  if (value === "cool" || value === "dry") return "humidity";
  return "accent";
}
export function sensorChip(card, config, key = config.entity) {
  const name =
    config.name?.trim() ||
    entityName(card.hass, card.state(config.entity)) ||
    config.entity;
  const value = config.entity?.startsWith("person.")
    ? stateText(card.hass, config.entity)
    : valueText(card.hass, config.entity);
  const chip = button("", () => details(card, config.entity), {
    entity: config.entity,
    key,
  });
  chip.classList.add("ikio-sensor-chip", "ikio-chip-compact");
  chip.classList.toggle("with-name", config.show_name !== false);
  chip.setAttribute("aria-label", `${name}: ${value}`);
  const icon = el("ha-state-icon");
  icon.dataset.chipEntity = config.entity;
  if (config.icon?.trim()) icon.dataset.chipIcon = config.icon.trim();
  icon.setAttribute("aria-hidden", "true");
  const text = el("span", undefined, "ikio-chip-text"),
    nameNode = el("span", name, "ikio-chip-name");
  nameNode.hidden = config.show_name === false;
  text.append(nameNode, el("span", value, "ikio-chip-value"));
  const surface = el("span", undefined, "ikio-chip-surface");
  surface.append(icon, text);
  chip.replaceChildren(surface);
  return chip;
}
export function updateChipIcons(card) {
  for (const icon of card.content.querySelectorAll(
    "ha-state-icon[data-chip-entity]",
  )) {
    icon.hass = card.hass;
    icon.stateObj = card.state(icon.dataset.chipEntity);
    icon.style.setProperty(
      "--ikio-chip-color",
      `var(--ae-${chipColor(icon.stateObj, icon.dataset.chipEntity)})`,
    );
    icon.icon = icon.dataset.chipIcon || undefined;
  }
}
