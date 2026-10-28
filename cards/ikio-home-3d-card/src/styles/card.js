export default `
/* Card layout and toolbar. Label appearance is in labels.css. */
:host {
  display: block;
  color: var(--ae-text);
  font:
    14px/1.45 system-ui,
    -apple-system,
    sans-serif;
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
  position: absolute;
  left: 18px;
  top: 17px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  max-width: calc(100% - 36px);
  z-index: 3;
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
.active {
  background: var(--ae-active) !important;
  color: var(--ae-text) !important;
  border-color: var(--ae-accent) !important;
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
    top: 10px;
    gap: 4px;
    max-width: calc(100% - 20px);
  }
  .tools button,
  .tools select {
    padding: 7px;
    font-size: 11px;
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
.tools button,
.tools select {
  min-height: 44px;
}
`;
