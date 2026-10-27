import { el, button, valueText } from "./controls.js";
import { details, entityName } from "./card.js";

// Opt-in styles: other card layouts do not inherit chip geometry.
export const chipStyles = `
.ikio-sensor-chip.ae-button{display:inline-flex;align-items:center;gap:7px;min-height:44px;min-width:44px;max-width:100%;padding:5px 10px;border:0;border-radius:8px;background:var(--ae-well);color:var(--ae-text);text-align:left;font:inherit}
.ikio-sensor-chip ha-state-icon{--mdc-icon-size:17px;flex:none;color:var(--ae-accent)}
.ikio-chip-text{display:grid;gap:0;min-width:0}
.ikio-chip-name{font-size:11px;font-weight:400;color:var(--ae-muted);overflow-wrap:anywhere}
.ikio-chip-value{font-size:13px;font-weight:500;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
`;
export function sensorChip(card, config, key = config.entity) {
  const name =
    config.name?.trim() ||
    entityName(card.hass, card.state(config.entity)) ||
    config.entity;
  const value = valueText(card.hass, config.entity);
  const chip = button("", () => details(card, config.entity), {
    entity: config.entity,
    key,
  });
  chip.classList.add("ikio-sensor-chip");
  chip.setAttribute("aria-label", `${name}: ${value}`);
  const icon = el("ha-state-icon");
  icon.dataset.chipEntity = config.entity;
  icon.setAttribute("aria-hidden", "true");
  const text = el("span", undefined, "ikio-chip-text");
  text.append(
    el("span", name, "ikio-chip-name"),
    el("span", value, "ikio-chip-value"),
  );
  chip.replaceChildren(icon, text);
  return chip;
}
export function updateChipIcons(card) {
  for (const icon of card.content.querySelectorAll(
    "ha-state-icon[data-chip-entity]",
  )) {
    icon.hass = card.hass;
    icon.stateObj = card.state(icon.dataset.chipEntity);
  }
}
