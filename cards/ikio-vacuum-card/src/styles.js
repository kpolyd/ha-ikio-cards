export const vacuumStyles = `
.vacuum-card{gap:4px}
.vacuum-card .vacuum-header{display:flex;align-items:center;gap:7px;min-height:44px;margin:0}
.vacuum-card .vacuum-robot{position:relative;display:flex;align-items:center;justify-content:center;width:34px;height:36px;flex:none;color:var(--ae-muted)}
.vacuum-card .vacuum-disc{--mdc-icon-size:28px;display:flex;width:28px;height:28px;align-items:center;justify-content:center}
.vacuum-card .vacuum-spark{--mdc-icon-size:12px;position:absolute;right:-1px;top:0;display:none;width:12px;height:12px}
.vacuum-card .vacuum-heading{position:relative;display:flex;flex-direction:column;justify-content:center;min-height:44px;min-width:0;flex:1}
.vacuum-card .vacuum-name{font-size:16px;font-weight:500;line-height:1.3;min-height:0;min-width:0;background:transparent;border:0;padding:0;overflow-wrap:anywhere;text-align:start;color:var(--ae-text)}
.vacuum-card .vacuum-name:after{content:'';position:absolute;inset:0}
.vacuum-card .vacuum-state{font-size:11px;line-height:1.35;color:var(--ae-muted);margin-top:2px;overflow-wrap:anywhere}
.vacuum-card[data-state=cleaning] .vacuum-state,.vacuum-card[data-state=cleaning] .vacuum-robot{color:var(--ae-temperature)}
.vacuum-card[data-state=returning] .vacuum-state{color:var(--ae-warning)}
.vacuum-card[data-state=error] .vacuum-state{color:var(--ae-error)}
.vacuum-card .vacuum-battery{display:flex;align-items:center;gap:4px;color:var(--ae-muted);font-size:12px;white-space:nowrap}
.vacuum-card .vacuum-battery ha-icon{--mdc-icon-size:15px}
.vacuum-card .vacuum-controls{display:flex;align-items:center;gap:6px;min-width:0}
.vacuum-card .vacuum-controls>.ae-button{display:flex;align-items:center;justify-content:center;gap:5px;min-height:44px;border:0;border-radius:8px}
.vacuum-card .vacuum-controls>.vacuum-primary{flex:1;min-width:0;color:var(--ae-accent);font-weight:500;white-space:normal;overflow-wrap:anywhere}
.vacuum-card .vacuum-primary ha-icon{--mdc-icon-size:17px}
.vacuum-card .vacuum-controls>.vacuum-dock{flex:none;width:44px;padding:4px;background:transparent;color:var(--ae-muted)}
.vacuum-card .vacuum-dock ha-icon{--mdc-icon-size:18px}
.vacuum-card .vacuum-suction{display:flex;flex-direction:column;justify-content:center;gap:0;margin-inline-start:auto;padding:2px 6px;border-radius:8px;background:var(--ae-well);min-height:44px;min-width:94px;max-width:114px}
.vacuum-card .vacuum-suction>.sr{position:static;clip-path:none;width:auto;height:auto;overflow:visible;padding-inline-start:3px;font-size:11px;line-height:1.35;color:var(--ae-muted)}
.vacuum-card .vacuum-suction select{font-size:13px;line-height:1.35;min-height:24px;min-width:0;width:100%;border:0;padding:0 2px;border-radius:0;background:transparent}
.vacuum-card .vacuum-suction option{background:var(--ae-surface);color:var(--ae-text)}
.vacuum-card .vacuum-suction select:disabled{opacity:.5}
.vacuum-card .vacuum-suction select:focus-visible{outline:2px solid var(--ae-accent);outline-offset:2px}
.vacuum-card .vacuum-alert{color:var(--ae-error);margin-top:2px}
:host([vacuum-motion]) .vacuum-disc{animation:ikio-vacuum-sweep 3.6s ease-in-out infinite}
:host([vacuum-motion]) .vacuum-spark{display:block;animation:ikio-vacuum-spark 3.6s ease-in-out infinite}
@keyframes ikio-vacuum-sweep{0%,100%{transform:translate(-2px,1px) rotate(-12deg)}25%{transform:translate(1px,-2px) rotate(10deg)}50%{transform:translate(2px,1px) rotate(12deg)}75%{transform:translate(-1px,2px) rotate(-8deg)}}
@keyframes ikio-vacuum-spark{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:.95;transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.vacuum-card .vacuum-disc,.vacuum-card .vacuum-spark{animation:none!important;transform:none!important}}
`;
