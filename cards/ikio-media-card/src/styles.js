export const mediaStyles = `
.media-card.ikio-refined{gap:4px}
.media-card>header{min-height:44px}
.media-card>header:has(.media-power-group){grid-template-columns:18px minmax(0,1fr) auto auto}
.media-card>header>ha-state-icon{--mdc-icon-size:18px;color:var(--ae-muted)}
.media-card .media-power{border:0;background:transparent;padding:4px}
.media-card .media-power ha-icon{--mdc-icon-size:18px}
.media-card .media-now{position:relative;isolation:isolate;overflow:hidden;border-radius:0;background:transparent;padding:6px 8px 8px;min-width:0}
.media-card .media-artwork{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 46%;z-index:-2;pointer-events:none;opacity:.72;mask-image:linear-gradient(to right,transparent,#000 22px,#000 calc(100% - 22px),transparent),linear-gradient(to bottom,transparent,#000 20px,#000 calc(100% - 20px),transparent);mask-composite:intersect}
.media-card .media-now.has-art:after{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,color-mix(in srgb,var(--ae-surface) 64%,transparent),color-mix(in srgb,var(--ae-surface) 42%,transparent) 55%,color-mix(in srgb,var(--ae-surface) 54%,transparent));pointer-events:none}
.media-card .media-info{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;min-height:44px}
.media-card .media-copy{min-width:0}
.media-card .media-track{font-size:14px;line-height:1.35;font-weight:500;overflow-wrap:anywhere}
.media-card .media-artist{font-size:11px;line-height:1.35;color:var(--media-muted,var(--ae-muted));margin-top:2px;overflow-wrap:anywhere}
.media-card .media-transport{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;max-width:132px;gap:0}
.media-card .media-transport>.ae-button{width:44px;min-width:44px;border:0;background:transparent;color:inherit;padding:4px}
.media-card .media-transport>.media-primary{background:var(--ae-surface);color:var(--ae-accent);border-radius:8px}
.media-card .has-art .media-transport>.media-primary{background:color-mix(in srgb,var(--ae-well) 85%,transparent);color:var(--ae-accent)}
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
.media-card .media-power-group{display:flex;align-items:center;gap:0;min-width:0}
.media-card .media-power-group>.media-power-reading{flex-direction:row;align-items:center;gap:3px;padding:0 2px;min-width:44px;min-height:44px}
.media-card .media-power-group>.media-power{flex:none;width:44px}
.media-card .media-power-reading .ae-value{font-size:12px;font-weight:400;color:var(--ae-muted)}
.media-card .media-power-reading .ae-label{display:flex;font-size:11px;align-items:center;gap:3px}
.media-card .media-power-reading ha-icon{--mdc-icon-size:14px}
.media-card [hidden]{display:none!important}
@container(max-width:300px){.media-card .media-controls select{max-width:108px}.media-card .media-info{gap:2px}.media-card .media-transport{max-width:132px}}
`;
