import { el, button, valueText } from "./controls.js";
import { details, entityName } from "./card.js";

// One renderer and geometry for standalone cards, badges and embedded readings.
export const chipStyles = `
.ikio-sensor-chip.ae-button{display:inline-flex;align-items:center;gap:0;min-height:44px;min-width:44px;max-width:100%;padding:0;border:0;border-radius:7px;background:transparent;color:var(--ae-text);text-align:left;font:inherit}
.ikio-chip-surface{display:inline-flex;align-items:center;gap:5px;min-height:28px;max-width:100%;padding:4px 7px;border:1px solid var(--ae-border);border-radius:7px;background:var(--ae-well)}
.ikio-sensor-chip.with-name .ikio-chip-surface{min-height:34px;padding:3px 7px}
.ikio-sensor-chip ha-state-icon{--mdc-icon-size:14px;flex:none;color:var(--ae-accent)}
.ikio-chip-text{display:grid;gap:0;min-width:0}
.ikio-chip-name{font-size:11px;line-height:12px;font-weight:400;color:var(--ae-muted);overflow-wrap:anywhere}
.ikio-chip-value{font-size:12px;line-height:14px;font-weight:500;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.ikio-chip-name[hidden]{display:none}
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
  chip.classList.add("ikio-sensor-chip", "ikio-chip-compact");
  chip.classList.toggle("with-name", config.show_name === true);
  chip.setAttribute("aria-label", `${name}: ${value}`);
  const icon = el("ha-state-icon");
  icon.dataset.chipEntity = config.entity;
  if (config.icon?.trim()) icon.dataset.chipIcon = config.icon.trim();
  icon.setAttribute("aria-hidden", "true");
  const text = el("span", undefined, "ikio-chip-text"),
    nameNode = el("span", name, "ikio-chip-name");
  nameNode.hidden = config.show_name !== true;
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
    icon.icon = icon.dataset.chipIcon || undefined;
  }
}
