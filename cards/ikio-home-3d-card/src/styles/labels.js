export default `
/* Badge colours follow the same appearance tokens as the card. */
:host {
  --label-background: var(--ae-well);
  --label-border: var(--ae-border);
  --label-font-size: 11px;
  --label-small-font-size: 8.8px;
  --label-gap: 5px;
  --climate-row-gap: 1px;
  --label-padding: 3px 5px;
  --label-radius: 7px;
  --label-shadow: 0 2px 6px #203d3c18;
  --temperature-color: var(--ae-temperature);
  --humidity-color: var(--ae-humidity);
  --power-color: var(--ae-power);
  --fridge-color: var(--ae-fridge);
  --status-color: var(--ae-text);
  --title-color: var(--ae-muted);
  --device-off-color: var(--ae-muted);
  --device-on-color: var(--ae-accent);
  --status-active-color: var(--ae-temperature);
  --device-icon-size: 17.6px;
  --device-box-size: 20.8px;
  --device-dot-size: 4.8px;
  --stack-gap: 3px;
  --marker-color: var(--ae-muted);
  --marker-open-color: var(--ae-warning);
  --marker-background: var(--ae-well);
  --marker-active-background: var(--ae-active);
}
.sensor-badges {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.sensor-badge {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  gap: var(--label-gap);
  align-items: center;
  white-space: nowrap;
  background: var(--label-background);
  border: 1px solid var(--label-border);
  border-radius: var(--label-radius);
  padding: var(--label-padding);
  font-size: var(--label-font-size);
  font-weight: 650;
  box-shadow: var(--label-shadow);
}
.sensor-badge[hidden],
.device-badge-stack[hidden] {
  display: none;
}
.sensor-badge button {
  pointer-events: auto;
  background: transparent;
  border: 0;
  border-radius: 3px;
  padding: 0;
  font: inherit;
  line-height: inherit;
  touch-action: pan-y;
}
.sensor-badge button:hover {
  background: #ffffff18;
}
.sensor-badge button.badge-name {
  font-size: 10px;
  font-weight: 500;
  color: var(--title-color);
}
.badge-temp {
  color: var(--temperature-color);
}
.badge-humidity {
  color: var(--humidity-color);
}
.badge-power {
  color: var(--power-color);
}
.badge-alarm {
  color: var(--status-color);
}
/* Home status states. */
.sensor-badge[data-alarm-state^="armed"] .badge-alarm {
  color: var(--status-active-color);
}
.sensor-badge[data-alarm-state="arming"] .badge-alarm,
.sensor-badge[data-alarm-state="pending"] .badge-alarm {
  color: var(--power-color);
}
.sensor-badge[data-alarm-state="triggered"] {
  background: rgba(112, 26, 34, 0.9);
  border-color: #fa8b94;
}
.sensor-badge[data-alarm-state="triggered"] .badge-alarm {
  color: #fff0f1;
}
/* Device status and optional power stack. */
.device-badge {
  padding: 4px;
  border-radius: 7px;
}
.badge-device {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--device-box-size);
  height: var(--device-box-size);
  color: var(--device-off-color);
}
.badge-device svg {
  width: var(--device-icon-size);
  height: var(--device-icon-size);
}
.device-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: var(--device-dot-size);
  height: var(--device-dot-size);
  border-radius: 50%;
  background: currentColor;
}
.device-badge[data-device-state="on"] .badge-device {
  color: var(--device-on-color);
}
.device-badge[data-device-state="unavailable"] .badge-device {
  opacity: 0.45;
}
.device-badge[data-device-state="unavailable"] .device-dot {
  background: transparent;
  border: 1px solid currentColor;
}
.device-badge-stack {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--stack-gap);
}
.device-badge-stack .sensor-badge {
  position: static;
  transform: none;
}
/* Small appliance readings share size and padding. */
.fridge-badge,
.device-power-badge {
  font-size: var(--label-small-font-size);
  padding: 2px 4px;
}
.sensor-badge .badge-fridge {
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--fridge-color);
}
.badge-fridge svg {
  width: 1.2em;
  height: 1.2em;
  flex: none;
}
/* Quiet binary markers; only active states are highlighted. */
.sensor-marker {
  padding: 2px;
  border-radius: 50%;
  background: var(--marker-background);
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow: none;
}
.sensor-marker .badge-marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--marker-color);
}
.sensor-marker[data-marker-state="active"] {
  background: var(--marker-active-background);
  border-color: currentColor;
}
.sensor-marker[data-marker-kind="motion"][data-marker-state="active"],
.sensor-marker[data-marker-kind="motion"][data-marker-state="active"]
  .badge-marker {
  color: var(--status-active-color);
}
.sensor-marker[data-marker-kind="contact"][data-marker-state="active"],
.sensor-marker[data-marker-kind="contact"][data-marker-state="active"]
  .badge-marker {
  color: var(--marker-open-color);
}
.sensor-marker[data-marker-state="unavailable"] {
  opacity: 0.5;
}
.sensor-marker[data-marker-state="unavailable"] .badge-marker {
  border: 1px dashed var(--marker-color);
  border-radius: 50%;
}
@media (max-width: 750px) {
  :host {
    --label-font-size: 10px;
    --label-small-font-size: 8px;
    --label-gap: 4px;
    --label-padding: 3px 4px;
  }
}

/* Optional two-row climate variant; shared state and click behavior. */
.climate-badge[data-layout="stacked"] {
  flex-direction: column;
  align-items: center;
  gap: var(--climate-row-gap);
}

.sensor-badge ha-icon{--mdc-icon-size:14px;flex:none;vertical-align:-2px}
.badge-temp,.badge-humidity,.badge-power,.badge-alarm{display:inline-flex;align-items:center;gap:3px}
`;
