export default `
/* Card layout and toolbar. Label appearance is in labels.css. */
:host {
  display: block;
  color: var(--ae-text);
  font:
    14px/1.45 system-ui,
    -apple-system,
    sans-serif;
  --sun-day: #ffc681;
  --sun-night: #c7bcff;
}
:host([appearance="light"]) {
  --sun-day: #805500;
  --sun-night: #5f468a;
}
:host([appearance="ha"]) {
  --sun-day: color-mix(in srgb, var(--ae-text) 55%, #e49c3d);
  --sun-night: color-mix(in srgb, var(--ae-text) 55%, #9986e6);
}
* {
  box-sizing: border-box;
}
button,
select {
  font: inherit;
}
button {
  cursor: pointer;
}
button:focus-visible,
select:focus-visible {
  outline: 3px solid var(--ae-accent);
  outline-offset: 2px;
}
.shell {
  height: min(740px, 82vh);
  min-height: 480px;
  background: var(--ae-surface);
  border: 1px solid var(--ae-border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}
.view {
  position: relative;
  flex: 1;
  min-width: 0;
  background: var(--ae-surface);
  overflow: hidden;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
.tools {
  --control-size: 26px;
  --control-target: var(--control-size);
  position: absolute;
  left: 18px;
  right: 18px;
  top: 17px;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 3;
  pointer-events: none;
}
.view-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.view-control {
  position: relative;
  display: inline-flex;
  flex: none;
}
.view-control:first-child {
  flex: 0 1 auto;
  min-width: var(--control-target);
  max-width: 12rem;
}
.view-control::before {
  content: "";
  position: absolute;
  box-sizing: border-box;
  inset: calc((100% - var(--control-size)) / 2) 0;
  border: 1px solid var(--ae-border);
  border-radius: 6px;
  background: var(--ae-well);
}
.view-control:has(> button)::before {
  inset-inline: calc((100% - var(--control-size)) / 2);
}
.view-control:has(> .active)::before {
  background: var(--ae-active);
  border-color: var(--ae-accent);
}
.view-control > :is(button, select) {
  position: relative;
  min-height: var(--control-target);
  padding: 0 5px;
  border: 0;
  background: transparent;
  font-size: 11px;
  pointer-events: auto;
}
.view-control > select {
  min-width: 0;
  width: 100%;
  text-overflow: ellipsis;
}
.view-control > button {
  display: grid;
  place-items: center;
  width: var(--control-target);
  padding: 0;
}
.view-control ha-icon {
  --mdc-icon-size: 15px;
  width: 15px;
  height: 15px;
}
.view-control option {
  background: var(--ae-well);
  color: var(--ae-text);
}
button,
select {
  border: 1px solid var(--ae-border);
  border-radius: 9px;
  background: var(--ae-well);
  color: var(--ae-text);
  padding: 8px 11px;
  font-size: 12px;
}
.sun-graph {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  min-height: var(--control-size);
  padding: 0 5px;
  border: 1px solid var(--ae-border);
  border-radius: 6px;
  background: var(--ae-well);
  color: var(--sun-day);
}
.sun-graph[data-night] {
  color: var(--sun-night);
}
.sun-graph[hidden],
.sun-curve[hidden] {
  display: none;
}
.sun-reading {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 54px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.sun-reading ha-icon {
  --mdc-icon-size: 12px;
  flex: none;
}
.sun-curve {
  width: 78px;
  height: 24px;
}
.sun-curve path {
  fill: none;
  stroke-width: 1.65;
  stroke-linecap: round;
}
.sun-horizon,
.sunset-line {
  stroke: var(--ae-muted);
}
.sun-horizon {
  opacity: 0.55;
}
.sunset-line {
  stroke-dasharray: 2 2;
}
.day-arc {
  stroke: var(--sun-day);
}
.night-arc {
  stroke: var(--sun-night);
}
.sun-marker {
  fill: currentColor;
  stroke: var(--ae-well);
  stroke-width: 1.75;
}
.toast {
  position: absolute;
  bottom: 58px;
  left: 20px;
  background: #25483f;
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 12px;
  max-width: 90%;
}
.error {
  padding: 30px;
  color: #9b3a2c;
}
@media (max-width: 750px) {
  .shell {
    height: 74vh;
    min-height: 440px;
  }
  .body {
    flex-direction: column;
  }
  .view {
    min-height: 0;
  }
  .tools {
    left: 10px;
    right: 10px;
    top: 10px;
  }
}
@container (max-width: 420px) {
  .tools {
    left: 10px;
    right: 10px;
    top: 10px;
  }
  .sun-curve {
    width: 66px;
    height: 22px;
  }
}
@container (max-width: 360px) {
  .sun-graph {
    padding-inline: 3px;
  }
  .sun-curve {
    width: 59px;
  }
  .sun-graph:has(.sun-curve:not([hidden])) .sun-reading {
    display: none;
  }
}
@media (pointer: coarse) {
  .tools {
    --control-target: 44px;
  }
}

.configuration-status {
  min-height: 120px;
  padding: 16px;
  border: 1px solid var(--ae-border);
  border-radius: 12px;
  background: var(--ae-surface);
  color: var(--ae-text);
  font-size: 13px;
}
.configuration-status[hidden],
.configuration-status [hidden] {
  display: none !important;
}
`;
