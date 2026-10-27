export const mediaStyles = `
.media-card.ikio-refined{gap:4px}
.media-card>header{min-height:44px}
.media-card>header:has(.media-power){grid-template-columns:18px minmax(0,1fr) auto 44px}
.media-card>header>ha-state-icon{--mdc-icon-size:18px;color:var(--ae-muted)}
.media-card .media-power{border:0;background:transparent;padding:4px}
.media-card .media-power ha-icon{--mdc-icon-size:18px}
.media-card .media-now{position:relative;isolation:isolate;overflow:hidden;border-radius:8px;background:var(--ae-well);padding:6px 8px 8px;min-width:0}
.media-card .media-artwork{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 46%;z-index:-2;pointer-events:none}
.media-card .media-now.has-art{--media-text:#f3f7f6;--media-muted:#d0dcd9;--media-accent:#b4d9ff;color:var(--media-text)}
.media-card .media-now.has-art:after{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,rgba(9,17,21,.84),rgba(9,17,21,.74) 55%,rgba(9,17,21,.78));pointer-events:none}
.media-card .media-info{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;min-height:44px}
.media-card .media-copy{min-width:0}
.media-card .media-track{font-size:14px;line-height:1.35;font-weight:500;overflow-wrap:anywhere}
.media-card .media-artist{font-size:11px;line-height:1.35;color:var(--media-muted,var(--ae-muted));margin-top:2px;overflow-wrap:anywhere}
.media-card .media-transport{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;max-width:132px;gap:0}
.media-card .media-transport>.ae-button{width:44px;min-width:44px;border:0;background:transparent;color:inherit;padding:4px}
.media-card .media-transport>.media-primary{background:var(--ae-surface);color:var(--ae-accent);border-radius:8px}
.media-card .has-art .media-transport>.media-primary{background:rgba(220,236,242,.16);color:var(--media-text)}
.media-card .media-transport ha-icon{--mdc-icon-size:16px}
.media-card .media-transport>.media-primary ha-icon{--mdc-icon-size:19px}
.media-card .media-timeline{margin-top:2px;min-width:0}
.media-card .media-seek{height:44px;width:100%;margin:0;display:block;accent-color:var(--media-accent,var(--ae-accent));min-width:0}
.media-card .media-times{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--media-muted,var(--ae-muted));font-variant-numeric:tabular-nums;margin-top:-9px;pointer-events:none}
.media-card .media-readonly-progress{display:block;width:100%;height:3px;accent-color:var(--media-accent,var(--ae-accent));margin:14px 0 17px}
.media-card .media-controls{display:flex;justify-content:space-between;align-items:center;gap:2px 8px;flex-wrap:wrap;border-top:1px solid var(--ae-border);padding-top:2px}
.media-card .media-volume{display:flex;align-items:center;gap:0;background:var(--ae-well);border-radius:8px;flex:none}
.media-card .media-volume>.ae-button{border:0;background:transparent;min-height:44px;width:44px;padding:4px;color:var(--ae-muted)}
.media-card .media-volume ha-icon{--mdc-icon-size:16px}
.media-card .media-volume>.media-volume-center{display:flex;flex-direction:column;justify-content:center;align-items:center;width:52px;min-height:44px;gap:1px;line-height:1;margin:0;color:var(--ae-text)}
.media-card .media-volume-center ha-icon{--mdc-icon-size:15px;color:var(--ae-muted)}
.media-card .media-volume-center output{font-size:12px;font-weight:500;line-height:15px;white-space:nowrap}
.media-card .media-volume-center[aria-pressed=true],.media-card .media-volume-center[aria-pressed=true] ha-icon{color:var(--ae-accent)}
.media-card .media-controls>.ae-select{display:flex;align-items:center;gap:4px;margin-inline-start:auto;min-width:0}
.media-card .media-controls select{max-width:148px;font-size:12px;padding:4px 5px;border:0;border-radius:7px}
.media-card .media-controls .sr{font-size:11px;flex:none}
.media-card .media-footer{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:0 8px;border-top:1px solid var(--ae-border)}
.media-card .media-footer>.media-power-reading{min-height:44px;flex-direction:row;align-items:center;gap:3px;padding:0;font-size:12px;align-self:start}
.media-card .media-power-reading .ae-value{font-size:12px;font-weight:400;color:var(--ae-muted)}
.media-card .media-power-reading .ae-label{display:flex;font-size:11px;align-items:center;gap:3px}
.media-card .media-power-reading ha-icon{--mdc-icon-size:14px}
.media-card .media-footer>.ikio-disclosure{grid-column:2;border:0;padding:0}
.media-card .media-footer>.ikio-disclosure:first-child{grid-column:1/-1}
.media-card .media-footer>.ikio-disclosure:only-child>summary{justify-content:flex-end}
.media-card .media-footer>.ikio-disclosure>summary{justify-content:flex-end;gap:6px}
.media-card.ikio-refined .ikio-disclosure>summary:after,.media-card.ikio-refined .ikio-disclosure[open]>summary:after{content:none}
.media-card .media-chevron{--mdc-icon-size:18px;flex:none}
.media-card .ikio-disclosure[open] .media-chevron{transform:rotate(180deg)}
.media-card .media-footer:has(details[open]){grid-template-columns:minmax(0,1fr)}
.media-card .media-footer:has(details[open])>.media-power-reading{grid-column:1;justify-self:start}
.media-card .media-footer>.ikio-disclosure[open]{grid-column:1/-1}
.media-card .ikio-disclosure-body{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.media-card .media-extra{display:flex;align-items:center;gap:5px;font-size:12px;min-width:0;text-align:start;overflow-wrap:anywhere;border:0}
.media-card .media-extra>span{min-width:0;overflow-wrap:anywhere}
.media-card .media-extra ha-state-icon{--mdc-icon-size:16px;flex:none}
.media-card .media-extra[aria-pressed=true] ha-state-icon{color:var(--ae-accent)}
.media-card [hidden]{display:none!important}
@container(max-width:300px){.media-card .media-controls select{max-width:108px}.media-card .media-info{gap:2px}.media-card .media-transport{max-width:132px}}
`;
