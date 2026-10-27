export const dehumidifierStyles = `
.dehumidifier-card{--dehumidifier-color:var(--ae-humidity);gap:6px}
.dehumidifier-card[data-mode=off]{--dehumidifier-color:var(--ae-muted)}
.dehumidifier-card>header>ha-state-icon{--mdc-icon-size:18px;color:var(--ae-muted)}
.dehumidifier-card>header .summary{color:var(--dehumidifier-color);text-transform:capitalize}
.dehumidifier-card .dehumidifier-dial-row{display:flex;align-items:flex-end;justify-content:center;gap:8px;max-width:304px;width:100%;margin:4px auto}
.dehumidifier-card .dehumidifier-dial-row>.ae-button{flex:0 0 44px;margin-bottom:4px;padding:4px;border:0}
.dehumidifier-card .dehumidifier-dial{position:relative;max-width:200px;min-width:0;flex:1}
.dehumidifier-card .dehumidifier-arc{display:block;width:100%;height:auto;touch-action:none;user-select:none}
.dehumidifier-card .dial-track,.dehumidifier-card .dial-fill{fill:none;stroke-width:12;stroke-linecap:round}
.dehumidifier-card .dial-track{stroke:var(--ae-well)}
.dehumidifier-card .dial-fill{stroke:var(--dehumidifier-color)}
.dehumidifier-card .dial-handle{fill:var(--dehumidifier-color)}
.dehumidifier-card .dial-caption{position:absolute;left:0;right:0;bottom:6px;text-align:center;pointer-events:none}
.dehumidifier-card .dial-value{display:block;color:var(--dehumidifier-color);font-size:36px;line-height:1.2;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:-1px}
.dehumidifier-card .dial-unit{font-size:20px;letter-spacing:0}
.dehumidifier-card .dial-input{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;left:50%;bottom:0}
.dehumidifier-card .dehumidifier-dial:focus-within{outline:2px solid var(--dehumidifier-color);outline-offset:2px;border-radius:8px}
.dehumidifier-card .dial-disabled .dehumidifier-arc{opacity:.4}
.dehumidifier-card .dehumidifier-readings{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2px 12px;padding:2px 6px;border-radius:8px;background:var(--ae-well)}
.dehumidifier-card .dehumidifier-readings>.ae-reading{flex-direction:row;align-items:center;gap:4px;min-height:36px}
.dehumidifier-card .dehumidifier-readings>button.ae-reading{min-height:44px}
.dehumidifier-card .dehumidifier-readings .ae-label{font-size:11px;display:flex;align-items:center;gap:3px}
.dehumidifier-card .dehumidifier-readings ha-icon{--mdc-icon-size:14px}
.dehumidifier-card .dehumidifier-readings .ae-value{font-size:12px}
.dehumidifier-card .dehumidifier-modes-section{border-top:1px solid var(--ae-border);padding-top:6px}
.dehumidifier-card .dehumidifier-modes-section>.ae-label{display:block;margin-bottom:4px;font-size:11px}
.dehumidifier-card .dehumidifier-modes{display:flex;flex-wrap:wrap;gap:3px;background:var(--ae-well);padding:4px;border-radius:10px}
.dehumidifier-card .dehumidifier-modes>.ae-button{flex:1 1 54px;min-width:44px;border:0;background:transparent;color:var(--ae-muted);font-size:12px;padding:4px;display:flex;flex-wrap:wrap;overflow-wrap:anywhere;align-items:center;justify-content:center;gap:4px}
.dehumidifier-card .dehumidifier-modes ha-icon{--mdc-icon-size:16px}
.dehumidifier-card .dehumidifier-modes>.ae-button[aria-pressed=true]{background:var(--dehumidifier-color);color:var(--ae-surface)}
.dehumidifier-card .ikio-disclosure-body{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 8px}
.dehumidifier-card .ikio-disclosure-body>.ae-select{grid-template-columns:1fr;gap:2px}
.dehumidifier-card .ikio-disclosure-body select{font-size:13px;border:0;padding:4px 6px;border-radius:6px}
.dehumidifier-card .ikio-disclosure-body>.ae-range,.dehumidifier-card .ikio-disclosure-body>.ae-note{grid-column:1/-1}
@container(max-width:300px){.dehumidifier-card .dehumidifier-modes>.ae-button{flex-direction:column}.dehumidifier-card .dial-value{font-size:34px}.dehumidifier-card .dial-unit{font-size:16px}.dehumidifier-card .dehumidifier-dial-row{gap:4px}.dehumidifier-card .dial-caption .ae-label{font-size:11px}}

.dehumidifier-card.ikio-refined .ikio-disclosure>summary:after,.dehumidifier-card.ikio-refined .ikio-disclosure[open]>summary:after{content:none}
.dehumidifier-card .settings-chevron{--mdc-icon-size:18px}
.dehumidifier-card .ikio-disclosure[open] .settings-chevron{transform:rotate(180deg)}
.dehumidifier-card .tank-alert{display:flex;align-items:center;gap:6px}
.dehumidifier-card .tank-alert ha-icon{--mdc-icon-size:18px;flex:none}
`;
