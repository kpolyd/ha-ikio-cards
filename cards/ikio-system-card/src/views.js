import { reading, el, formatNumber } from "@ikio/card-ui";
import { downsample, windowPoints } from "@ikio/graph";
import { rateHistory } from "./adapter.js";
const svgNode = (tag, attrs = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attrs))
    node.setAttribute(name, String(value));
  return node;
};
export const systemStyles = `
.ikio-system{--system-ring-size:clamp(48px,16cqw,76px)}
.ikio-system>header{grid-template-columns:18px minmax(0,1fr) auto}
.ikio-system .system-header-meta{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:0 8px;max-width:190px;font-size:11px;color:var(--ae-muted)}
.ikio-system .system-header-meta button{min-height:44px;min-width:44px;background:none;border:0;padding:0;display:flex;align-items:center;gap:4px;color:inherit;font:inherit}
.ikio-system .system-header-meta ha-icon{--mdc-icon-size:14px}
.ikio-system .system-status{display:flex;gap:5px;align-items:center;overflow-wrap:anywhere}
.ikio-system .system-online-dot,.ikio-system .system-offline-dot{width:6px;height:6px;border-radius:50%;flex:none}
.ikio-system .system-online-dot{background:var(--ae-temperature)}
.ikio-system .system-offline-dot{background:var(--ae-error)}
.ikio-system .ikio-resources{grid-template-columns:repeat(auto-fit,minmax(68px,1fr));gap:8px}
.ikio-system .ikio-resource{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;text-align:center}
.ikio-system .ikio-resources .ikio-resource>.system-ring-reading{display:flex;flex-direction:column;align-items:center;gap:4px;padding:0;min-height:0;width:100%}
.ikio-system .system-ring{width:var(--system-ring-size);height:var(--system-ring-size);display:grid;place-items:center;position:relative;flex:none;color:var(--ae-temperature)}
.ikio-system .system-ring.warning{color:var(--ae-warning)}
.ikio-system .system-ring.critical{color:var(--ae-error)}
.ikio-system .system-ring.unknown{color:var(--ae-muted)}
.ikio-system .system-ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.ikio-system .system-ring-reading>.ae-label{font-size:12px}
.ikio-system .system-ring-track{fill:none;stroke:var(--ae-border);stroke-width:4}
.ikio-system .system-ring-arc{fill:none;stroke:currentColor;stroke-width:4;stroke-linecap:round}
.ikio-system .system-ring-value{font-size:14px;font-weight:500;font-variant-numeric:tabular-nums;color:var(--ae-text)}
.ikio-system .ikio-resource>.ae-note{margin:0;font-size:11px;overflow-wrap:anywhere}
.ikio-system .system-network{display:grid;gap:0}
.ikio-system .system-network-legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px}
.ikio-system .system-network-legend .ae-reading{display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:6px;padding:0}
.ikio-system .system-network-legend .ae-label{font-size:11px}
.ikio-system .system-network-legend .ae-value{font-size:12px}
.ikio-system .system-network-key{width:14px;border-top:2px solid var(--ae-accent);flex:none}
.ikio-system .system-network-key.upload{border-top:2px dashed var(--ae-temperature)}
.ikio-system .system-network-plot{display:block;width:100%;height:32px;overflow:visible}
.ikio-system .system-network-times{display:flex;justify-content:space-between;color:var(--ae-muted);font-size:11px}
.ikio-system .system-footer>summary{font-size:13px;font-weight:500;color:var(--ae-text)}
.ikio-system .system-footer>summary:after,.ikio-system .system-footer[open]>summary:after{content:none}
.ikio-system .system-footer>summary>ha-icon{--mdc-icon-size:18px;flex:none}
.ikio-system .system-footer[open]>summary>ha-icon{transform:rotate(180deg)}
.ikio-system .system-error-note{color:var(--ae-error)}
.ikio-system .system-extra-details{border-top:1px solid var(--ae-border);padding-top:6px}
@container(max-width:310px){.ikio-system .system-header-meta{max-width:145px;gap:0 6px}.ikio-system>header>.ae-title,.ikio-system>header>h2{font-size:15px}}
`;
export function ringReading(label, percent, entity, level, hass) {
  const result = reading(label, "", entity, "system-ring-reading");
  const name = result.querySelector(".ae-label");
  const text = percent === null ? "—" : `${formatNumber(hass, percent, 1)}%`;
  result.setAttribute(
    "aria-label",
    `${label}: ${percent === null ? "unavailable" : text}${level ? `, ${level}` : ""}`,
  );
  result.replaceChildren();
  const ring = el(
    "span",
    undefined,
    `system-ring ${percent === null ? "unknown" : level}`,
  );
  const svg = svgNode("svg", { viewBox: "0 0 52 52", "aria-hidden": "true" });
  svg.append(
    svgNode("circle", { cx: 26, cy: 26, r: 23, class: "system-ring-track" }),
  );
  if (percent !== null && percent > 0)
    svg.append(
      svgNode("circle", {
        cx: 26,
        cy: 26,
        r: 23,
        pathLength: 100,
        class: "system-ring-arc",
        "stroke-dasharray": `${Math.min(100, Math.max(0, percent))} 100`,
      }),
    );
  ring.append(svg, el("span", text, "system-ring-value"));
  result.append(ring, name);
  return result;
}
export function networkPlot(rows, history, now, hass) {
  const start = now - 1800000;
  const series = rows.map((row) => ({
    ...row,
    points: windowPoints(
      rateHistory(history?.[row.entity], row.unit),
      start,
      now,
    ),
  }));
  const values = series.flatMap((row) =>
    row.points.filter((p) => p.value !== null).map((p) => p.value),
  );
  if (!values.length) return null;
  const high = values.reduce((max, value) => Math.max(max, value), 1);
  const svg = svgNode("svg", {
    viewBox: "0 0 300 32",
    preserveAspectRatio: "none",
    class: "system-network-plot",
    role: "img",
    "aria-label": `Download and upload history, last 30 minutes. Shared scale 0 to ${formatNumber(hass, high)} bytes per second.`,
  });
  for (const row of series) {
    let d = "",
      known = false;
    for (const point of downsample(row.points, 180)) {
      if (point.value === null) {
        known = false;
        continue;
      }
      const x = Math.max(
        0,
        Math.min(300, ((point.time - start) / 1800000) * 300),
      );
      const y = 30 - (point.value / high) * 28;
      d += `${known ? "L" : "M"}${x},${y} `;
      known = true;
    }
    if (!d) continue;
    svg.append(
      svgNode("path", {
        d,
        fill: "none",
        stroke:
          row.key === "network_tx"
            ? "var(--ae-temperature)"
            : "var(--ae-accent)",
        "stroke-width": 1,
        "vector-effect": "non-scaling-stroke",
        ...(row.key === "network_tx" ? { "stroke-dasharray": "4 3" } : {}),
      }),
    );
  }
  return svg;
}
