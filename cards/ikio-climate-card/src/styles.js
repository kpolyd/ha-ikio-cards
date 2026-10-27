export const climateStyles = `
.climate-card{--climate-heat:#f08072;--climate-color:var(--ae-muted);gap:6px}
:host([appearance=light]) .climate-card{--climate-heat:#a44335}
:host([appearance=ha]) .climate-card{--climate-heat:var(--state-climate-heat-color,var(--error-color))}
.climate-card[data-mode=cool]{--climate-color:var(--ae-accent)}
.climate-card[data-mode=heat]{--climate-color:var(--climate-heat)}
.climate-card[data-mode=auto],.climate-card[data-mode=heat_cool]{--climate-color:var(--ae-temperature,#a4e4b8)}
.climate-card[data-mode=dry]{--climate-color:var(--ae-humidity,#adcfff)}
.climate-card[data-mode=fan_only]{--climate-color:var(--ae-temperature,#a4e4b8)}
.climate-card>header>ha-state-icon{--mdc-icon-size:18px;color:var(--ae-muted)}
.climate-card>header .summary{color:var(--climate-color);text-transform:capitalize}
.climate-card .climate-dial-row{display:flex;align-items:flex-end;justify-content:center;gap:8px;max-width:304px;width:100%;margin:4px auto}
.climate-card .climate-dial-row>.ae-button{flex:0 0 44px;margin-bottom:4px;padding:4px;border:0}
.climate-card .climate-dial{position:relative;max-width:200px;min-width:0;flex:1}
.climate-card .climate-arc{display:block;width:100%;height:auto;touch-action:none;user-select:none}
.climate-card .dial-track,.climate-card .dial-fill{fill:none;stroke-width:12;stroke-linecap:round}
.climate-card .dial-track{stroke:var(--ae-well)}
.climate-card .dial-fill{stroke:var(--climate-color)}
.climate-card .dial-handle{fill:var(--climate-color)}
.climate-card .dial-caption{position:absolute;left:0;right:0;bottom:6px;text-align:center;pointer-events:none}
.climate-card .dial-value{display:block;color:var(--climate-color);font-size:40px;line-height:1.2;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:-1px}
.climate-card .dial-unit{font-size:20px;letter-spacing:0}
.climate-card .dial-input{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;left:50%;bottom:0}
.climate-card .climate-dial:focus-within{outline:2px solid var(--climate-color);outline-offset:2px;border-radius:8px}
.climate-card .dial-disabled .climate-arc{opacity:.4}
.climate-card .climate-readings{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2px 12px;padding:2px 6px;border-radius:8px;background:var(--ae-well)}
.climate-card .climate-readings>.ae-reading{flex-direction:row;align-items:center;gap:4px;min-height:36px}
.climate-card .climate-readings>button.ae-reading{min-height:44px}
.climate-card .climate-readings .ae-label{font-size:11px;display:flex;align-items:center;gap:3px}
.climate-card .climate-readings ha-icon{--mdc-icon-size:14px}
.climate-card .climate-readings .ae-value{font-size:12px}
.climate-card .climate-modes-section{border-top:1px solid var(--ae-border);padding-top:6px}
.climate-card .climate-modes-section>.ae-label{display:block;margin-bottom:4px;font-size:11px}
.climate-card .climate-modes{display:flex;flex-wrap:wrap;gap:3px;background:var(--ae-well);padding:4px;border-radius:10px}
.climate-card .climate-modes>.ae-button{flex:1 1 54px;min-width:44px;border:0;background:transparent;color:var(--ae-muted);font-size:12px;padding:4px;display:flex;flex-wrap:wrap;overflow-wrap:anywhere;align-items:center;justify-content:center;gap:4px}
.climate-card .climate-modes ha-icon{--mdc-icon-size:16px}
.climate-card .climate-modes>.ae-button[aria-pressed=true]{background:var(--climate-color);color:var(--ae-surface)}
.climate-card .ikio-disclosure-body{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 8px}
.climate-card .ikio-disclosure-body>.ae-select{grid-template-columns:1fr;gap:2px}
.climate-card .ikio-disclosure-body select{font-size:13px;border:0;padding:4px 6px;border-radius:6px}
.climate-card .ikio-disclosure-body>.ae-range,.climate-card .ikio-disclosure-body>.ae-note{grid-column:1/-1}
@container(max-width:300px){.climate-card .climate-modes>.ae-button{flex-direction:column}.climate-card .dial-value{font-size:34px}.climate-card .dial-unit{font-size:16px}.climate-card .climate-dial-row{gap:4px}.climate-card .dial-caption .ae-label{font-size:11px}}

.climate-card.ikio-refined .ikio-disclosure>summary:after,.climate-card.ikio-refined .ikio-disclosure[open]>summary:after{content:none}
.climate-card .settings-chevron{--mdc-icon-size:18px}
.climate-card .ikio-disclosure[open] .settings-chevron{transform:rotate(180deg)}
`;
