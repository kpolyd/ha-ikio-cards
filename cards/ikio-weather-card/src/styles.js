export const css = `
ha-card{padding:6px 10px 8px;--weather-high:var(--ae-temperature);--weather-low:var(--ae-humidity);--weather-rain:var(--ae-accent)}
:host([appearance=ha]) ha-card{--weather-high:var(--primary-color,#03a9f4);--weather-low:var(--secondary-text-color);--weather-rain:var(--primary-color,#03a9f4)}
.weather-top{display:flex;align-items:center;gap:6px;min-height:44px}
.weather-name{flex:1;min-width:60px;text-align:start;overflow-wrap:anywhere;font-size:14px;font-weight:500;background:none;padding:0}
.weather-top button{min-height:44px;min-width:44px}
.weather-period{min-width:0;max-width:100px;min-height:44px;font:12px var(--ha-font-family,system-ui,sans-serif);color:var(--ae-text);background:var(--ae-well);border:0;border-radius:6px;margin-inline-start:auto;padding:0 4px}
.weather-tabs{display:flex;gap:2px;margin-inline-start:auto;flex-wrap:wrap;justify-content:end}
.weather-tabs button{font-size:12px;background:none;padding:0 6px;border-radius:6px;color:var(--ae-muted)}
.weather-tabs button[aria-pressed=true]{color:var(--ae-text);background:var(--ae-well)}
.weather-legend{display:flex;gap:6px;font-size:11px;color:var(--ae-muted);flex-wrap:wrap}
.weather-legend span{display:flex;align-items:center;gap:3px}
.weather-swatch{display:inline-block;width:10px;border-top:2px solid var(--weather-high)}
.weather-swatch.low{border-color:var(--weather-low);border-top-style:dashed}
.weather-current{display:flex;align-items:center;gap:7px;min-height:44px;padding-bottom:7px}
.weather-current>ha-icon{--mdc-icon-size:24px;color:var(--weather-rain);flex:none}
.weather-main{min-width:0}.weather-temperature{font-size:24px;line-height:1.1;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.weather-condition{font-size:11px;color:var(--ae-muted);margin-top:1px;overflow-wrap:anywhere}
.weather-readings{display:flex;flex-wrap:wrap;justify-content:end;gap:3px 10px;max-width:52%;margin-inline-start:auto;font-size:11px;font-variant-numeric:tabular-nums}
.weather-reading{display:flex;align-items:center;gap:3px;overflow-wrap:anywhere}.weather-reading ha-icon{--mdc-icon-size:13px;color:var(--ae-muted)}
.weather-feels{flex-basis:100%;text-align:end;color:var(--ae-muted)}
.weather-forecast{border-top:1px solid var(--ae-border);padding-top:3px}
.weather-columns{display:grid;grid-template-columns:repeat(var(--weather-slots),minmax(0,1fr));text-align:center}
.weather-day{min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:2px 0;font-size:11px;color:var(--ae-muted);overflow-wrap:anywhere}
.weather-day ha-icon{--mdc-icon-size:16px;color:var(--weather-rain)}
.weather-plot{display:block;width:100%;height:84px;overflow:hidden}
.weather-plot text{font:11px var(--ha-font-family,system-ui,sans-serif);fill:var(--ae-text);font-variant-numeric:tabular-nums;paint-order:stroke;stroke:var(--ae-surface);stroke-width:3px;stroke-linejoin:round}
.weather-precipitation,.weather-values,.weather-wind{font-size:11px;gap:0;font-variant-numeric:tabular-nums}
.weather-precipitation>div,.weather-values>div,.weather-wind>div{min-width:0;overflow-wrap:anywhere;display:flex;align-items:center;flex-direction:column;gap:2px}
.weather-probability,.weather-wind{color:var(--ae-muted)}.weather-wind{margin-top:4px}
.weather-message{font-size:12px;color:var(--ae-muted);margin:6px 0;overflow-wrap:anywhere}
.weather-retry{background:var(--ae-well);border-radius:6px;min-height:44px;padding:0 8px;font-size:12px}
[hidden]{display:none!important}
@container(max-width:310px){.weather-top{gap:4px}.weather-legend{flex-direction:column}.weather-tabs button{padding:0 4px}.weather-legend{gap:4px}.weather-swatch{width:7px}.weather-readings{gap:3px 6px}}
`;
