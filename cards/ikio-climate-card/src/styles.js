export const climateStyles = `
.climate-card{--climate-heat:#f08072;--climate-color:var(--ae-muted);gap:6px}
:host([appearance=light]) .climate-card{--climate-heat:#a44335}
:host([appearance=ha]) .climate-card{--climate-heat:var(--state-climate-heat-color,var(--error-color))}
.climate-card[data-mode=cool]{--climate-color:var(--ae-accent)}
.climate-card[data-mode=heat]{--climate-color:var(--climate-heat)}
.climate-card[data-mode=auto],.climate-card[data-mode=heat_cool]{--climate-color:var(--ae-temperature,#a4e4b8)}
.climate-card[data-mode=dry]{--climate-color:var(--ae-humidity,#adcfff)}
.climate-card[data-mode=fan_only]{--climate-color:var(--ae-temperature,#a4e4b8)}

.climate-card>header>ha-state-icon{--mdc-icon-size:23px;color:var(--climate-color)}
.climate-card>header .summary{color:var(--climate-color);text-transform:capitalize}
.climate-card.ikio-refined>header{grid-template-columns:23px minmax(0,1fr) auto;gap:7px}
.climate-card.ikio-refined>header>.ae-title{font-size:15px;font-weight:600}
.climate-card .climate-dial-row{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:8px;max-width:340px;width:100%;margin:3px auto;padding:0 10px}
.climate-card .climate-dial-row>.ae-button{width:44px;height:44px;min-width:44px;padding:0;border:1px solid var(--ae-border);border-radius:50%;background:var(--ae-well)}
.climate-card .climate-dial{position:relative;min-width:0;text-align:center}
.climate-card .dial-caption{display:block;text-align:center;border:0;background:none;color:inherit;padding:0;min-width:0;width:100%}
.climate-card .dial-caption>.ae-label{font-size:11px;color:var(--ae-muted)}
.climate-card .dial-value{display:block;color:var(--climate-color);font-size:43px;line-height:1.17;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:-1.7px}
.climate-card .dial-unit{font-size:19px;font-weight:400;letter-spacing:0;margin-inline-start:2px}
.climate-card .dial-input{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;left:50%;bottom:0}
.climate-card .climate-dial:focus-within{outline:2px solid var(--climate-color);outline-offset:2px;border-radius:8px}
.climate-card .dial-disabled .dial-value{color:var(--ae-muted)}
.climate-card .climate-readings{display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:5px;padding:0 0 7px;border-bottom:1px solid var(--ae-border)}
.climate-card .climate-readings>.ae-reading{flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:44px;padding:0;background:none}
.climate-card .climate-readings .ae-label{font-size:11px;display:flex;align-items:center;gap:3px}
.climate-card .climate-readings ha-icon{--mdc-icon-size:13px}
.climate-card .climate-readings .ae-value{font-size:13px;font-weight:500}
.climate-card .climate-modes-section{padding:0}
.climate-card .climate-modes{display:flex;flex-wrap:wrap;gap:3px}
.climate-card .climate-modes>.ae-button{flex:1 1 43px;min-width:44px;min-height:46px;border:0;background:none;border-radius:7px;color:var(--ae-muted);font-size:10px;padding:4px 1px;display:flex;flex-direction:column;overflow-wrap:anywhere;align-items:center;justify-content:center;gap:3px}
.climate-card .climate-modes ha-icon{--mdc-icon-size:18px}
.climate-card .climate-modes>.ae-button[aria-pressed=true]{background:color-mix(in srgb,var(--climate-color) 15%,var(--ae-well));color:var(--climate-color)}
.climate-card .climate-quick-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;border-top:1px solid var(--ae-border);padding-top:7px}
.climate-card .climate-quick-settings>.ae-select{display:flex;align-items:center;gap:5px;min-width:0;min-height:44px;border:1px solid var(--ae-border);border-radius:7px;background:var(--ae-well);padding-inline-start:7px}
.climate-card .climate-quick-settings>.ae-select>.sr{font-size:11px;position:static;width:auto;height:auto;clip-path:none;overflow:visible}
.climate-card .climate-quick-settings ha-icon{--mdc-icon-size:15px;flex:none;color:var(--ae-muted)}
.climate-card .climate-quick-settings select{min-width:0;width:0;flex:1;min-height:44px;border:0;background:transparent;padding:0 3px;font-size:12px;color:var(--ae-text)}
.climate-card .climate-quick-settings>.ae-range,.climate-card .climate-quick-settings>.ae-note{grid-column:1/-1}
.climate-card .climate-quick-settings>.ae-select:only-child{grid-column:1/-1}
.climate-card .ikio-disclosure-body{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 8px}
.climate-card .ikio-disclosure-body>.ae-select{grid-template-columns:1fr;gap:2px}
.climate-card .ikio-disclosure-body select{min-height:44px;font-size:13px;border:0;padding:4px 6px;border-radius:6px;background:var(--ae-well)}
.climate-card .ikio-disclosure-body>.ae-range,.climate-card .ikio-disclosure-body>.ae-note{grid-column:1/-1}
.climate-card.ikio-refined .ikio-disclosure>summary:after,.climate-card.ikio-refined .ikio-disclosure[open]>summary:after{content:none}
.climate-card .settings-chevron{--mdc-icon-size:15px}
.climate-card .ikio-disclosure[open] .settings-chevron{transform:rotate(180deg)}
@container(max-width:330px){.climate-card .climate-dial-row{padding-inline:0;gap:4px}.climate-card .dial-value{font-size:38px}.climate-card .climate-quick-settings>.ae-select{padding-inline-start:5px;gap:3px}.climate-card .climate-quick-settings>.ae-select>ha-icon{display:none}}

.climate-card .climate-dual-targets{display:grid;grid-template-columns:44px minmax(0,1fr) minmax(0,1fr) 44px;gap:6px;align-items:center;margin:3px 0}
.climate-card .climate-dual-targets .climate-dial-row{display:contents}
.climate-card .climate-dual-targets .climate-dial-row>.ae-button{display:none;grid-row:1}
.climate-card .climate-dual-targets .dial-selected>.ae-button{display:block}
.climate-card .climate-dual-targets .ae-button:first-child{grid-column:1}
.climate-card .climate-dual-targets .ae-button:last-child{grid-column:4}
.climate-card .climate-dual-targets .climate-dial-row:first-child>.climate-dial{grid-column:2;grid-row:1}
.climate-card .climate-dual-targets .climate-dial-row:last-child>.climate-dial{grid-column:3;grid-row:1}
.climate-card .climate-dual-targets .dial-value{font-size:28px;letter-spacing:-.7px}
.climate-card .climate-dual-targets .dial-unit{font-size:13px}
.climate-card .climate-dual-targets .dial-selected .dial-value{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:5px}
.climate-card .climate-dual-targets .dial-caption{min-height:60px}
`;
