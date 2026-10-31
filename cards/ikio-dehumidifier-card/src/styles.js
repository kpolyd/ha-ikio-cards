export const dehumidifierStyles = `
.dehumidifier-card{--dehumidifier-color:var(--ae-humidity);gap:6px}
.dehumidifier-card[data-mode=off]{--dehumidifier-color:var(--ae-muted)}

.dehumidifier-card>header>ha-state-icon{--mdc-icon-size:23px;color:var(--dehumidifier-color)}
.dehumidifier-card>header .summary{color:var(--dehumidifier-color);text-transform:capitalize}
.dehumidifier-card.ikio-refined>header{grid-template-columns:23px minmax(0,1fr) auto;gap:7px}
.dehumidifier-card.ikio-refined>header>.ae-title{font-size:15px;font-weight:600}
.dehumidifier-card .dehumidifier-dial-row{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:8px;max-width:340px;width:100%;margin:3px auto;padding:0 10px}
.dehumidifier-card .dehumidifier-dial-row>.ae-button{width:44px;height:44px;min-width:44px;padding:0;border:1px solid var(--ae-border);border-radius:50%;background:var(--ae-well)}
.dehumidifier-card .dehumidifier-dial{position:relative;min-width:0;text-align:center}
.dehumidifier-card .dial-caption{display:block;text-align:center;border:0;background:none;color:inherit;padding:0;min-width:0;width:100%}
.dehumidifier-card .dial-caption>.ae-label{font-size:11px;color:var(--ae-muted)}
.dehumidifier-card .dial-value{display:block;color:var(--dehumidifier-color);font-size:43px;line-height:1.17;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:-1.7px}
.dehumidifier-card .dial-unit{font-size:19px;font-weight:400;letter-spacing:0;margin-inline-start:2px}
.dehumidifier-card .dial-input{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;left:50%;bottom:0}
.dehumidifier-card .dehumidifier-dial:focus-within{outline:2px solid var(--dehumidifier-color);outline-offset:2px;border-radius:8px}
.dehumidifier-card .dial-disabled .dial-value{color:var(--ae-muted)}
.dehumidifier-card .dehumidifier-readings{display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:5px;padding:0 0 7px;border-bottom:1px solid var(--ae-border)}
.dehumidifier-card .dehumidifier-readings>.ae-reading{flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:44px;padding:0;background:none}
.dehumidifier-card .dehumidifier-readings .ae-label{font-size:11px;display:flex;align-items:center;gap:3px}
.dehumidifier-card .dehumidifier-readings ha-icon{--mdc-icon-size:13px}
.dehumidifier-card .dehumidifier-readings .ae-value{font-size:13px;font-weight:500}
.dehumidifier-card .dehumidifier-modes-section{padding:0}
.dehumidifier-card .dehumidifier-modes{display:flex;flex-wrap:wrap;gap:3px}
.dehumidifier-card .dehumidifier-modes>.ae-button{flex:1 1 43px;min-width:44px;min-height:46px;border:0;background:none;border-radius:7px;color:var(--ae-muted);font-size:10px;padding:4px 1px;display:flex;flex-direction:column;overflow-wrap:anywhere;align-items:center;justify-content:center;gap:3px}
.dehumidifier-card .dehumidifier-modes ha-icon{--mdc-icon-size:18px}
.dehumidifier-card .dehumidifier-modes>.ae-button[aria-pressed=true]{background:color-mix(in srgb,var(--dehumidifier-color) 15%,var(--ae-well));color:var(--dehumidifier-color)}
.dehumidifier-card .dehumidifier-quick-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;border-top:1px solid var(--ae-border);padding-top:7px}
.dehumidifier-card .dehumidifier-quick-settings>.ae-select{display:flex;align-items:center;gap:5px;min-width:0;min-height:44px;border:1px solid var(--ae-border);border-radius:7px;background:var(--ae-well);padding-inline-start:7px}
.dehumidifier-card .dehumidifier-quick-settings>.ae-select>.sr{font-size:11px;position:static;width:auto;height:auto;clip-path:none;overflow:visible}
.dehumidifier-card .dehumidifier-quick-settings ha-icon{--mdc-icon-size:15px;flex:none;color:var(--ae-muted)}
.dehumidifier-card .dehumidifier-quick-settings select{min-width:0;width:0;flex:1;min-height:44px;border:0;background:transparent;padding:0 3px;font-size:12px;color:var(--ae-text)}
.dehumidifier-card .dehumidifier-quick-settings>.ae-range,.dehumidifier-card .dehumidifier-quick-settings>.ae-note{grid-column:1/-1}
.dehumidifier-card .dehumidifier-quick-settings>.ae-select:only-child{grid-column:1/-1}
.dehumidifier-card .ikio-disclosure-body{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 8px}
.dehumidifier-card .ikio-disclosure-body>.ae-select{grid-template-columns:1fr;gap:2px}
.dehumidifier-card .ikio-disclosure-body select{min-height:44px;font-size:13px;border:0;padding:4px 6px;border-radius:6px;background:var(--ae-well)}
.dehumidifier-card .ikio-disclosure-body>.ae-range,.dehumidifier-card .ikio-disclosure-body>.ae-note{grid-column:1/-1}
.dehumidifier-card.ikio-refined .ikio-disclosure>summary:after,.dehumidifier-card.ikio-refined .ikio-disclosure[open]>summary:after{content:none}
.dehumidifier-card .settings-chevron{--mdc-icon-size:15px}
.dehumidifier-card .ikio-disclosure[open] .settings-chevron{transform:rotate(180deg)}
@container(max-width:330px){.dehumidifier-card .dehumidifier-dial-row{padding-inline:0;gap:4px}.dehumidifier-card .dial-value{font-size:38px}.dehumidifier-card .dehumidifier-quick-settings>.ae-select{padding-inline-start:5px;gap:3px}.dehumidifier-card .dehumidifier-quick-settings>.ae-select>ha-icon{display:none}}

.dehumidifier-card .tank-alert{display:flex;align-items:center;gap:6px}
.dehumidifier-card .tank-alert ha-icon{--mdc-icon-size:18px;flex:none}
.dehumidifier-card .dehumidifier-modes>.ae-button{flex-basis:55px;font-size:11px}
`;
