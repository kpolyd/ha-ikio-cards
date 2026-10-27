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
.ikio-server-monitor{--system-ring-size:clamp(48px,16cqw,76px)}
.ikio-server-monitor>header{grid-template-columns:18px minmax(0,1fr) auto}
.ikio-server-monitor .system-header-meta{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:0 8px;max-width:190px;font-size:11px;color:var(--ae-muted)}
.ikio-server-monitor .system-header-meta button{min-height:44px;min-width:44px;background:none;border:0;padding:0;display:flex;align-items:center;gap:4px;color:inherit;font:inherit}
.ikio-server-monitor .system-header-meta ha-icon{--mdc-icon-size:14px}
.ikio-server-monitor .system-status{display:flex;gap:5px;align-items:center;overflow-wrap:anywhere}
.ikio-server-monitor .system-online-dot,.ikio-server-monitor .system-offline-dot{width:6px;height:6px;border-radius:50%;flex:none}
.ikio-server-monitor .system-online-dot{background:var(--ae-temperature)}
.ikio-server-monitor .system-offline-dot{background:var(--ae-error)}
.ikio-server-monitor .ikio-resources{grid-template-columns:repeat(auto-fit,minmax(68px,1fr));gap:8px}
.ikio-server-monitor .ikio-resource{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;text-align:center}
.ikio-server-monitor .ikio-resources .ikio-resource>.system-ring-reading{display:flex;flex-direction:column;align-items:center;gap:4px;padding:0;min-height:0;width:100%}
.ikio-server-monitor .system-ring{width:var(--system-ring-size);height:var(--system-ring-size);display:grid;place-items:center;position:relative;flex:none;color:var(--ae-temperature)}
.ikio-server-monitor .system-ring.warning{color:var(--ae-warning)}
.ikio-server-monitor .system-ring.critical{color:var(--ae-error)}
.ikio-server-monitor .system-ring.unknown{color:var(--ae-muted)}
.ikio-server-monitor .system-ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.ikio-server-monitor .system-ring-reading>.ae-label{font-size:12px}
.ikio-server-monitor .system-ring-track{fill:none;stroke:var(--ae-border);stroke-width:4}
.ikio-server-monitor .system-ring-arc{fill:none;stroke:currentColor;stroke-width:4;stroke-linecap:round}
.ikio-server-monitor .system-ring-value{font-size:14px;font-weight:500;font-variant-numeric:tabular-nums;color:var(--ae-text)}
.ikio-server-monitor .ikio-resource>.ae-note{margin:0;font-size:11px;overflow-wrap:anywhere}
.ikio-server-monitor .system-network{display:grid;gap:0}
.ikio-server-monitor .system-network-legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px}
.ikio-server-monitor .system-network-legend .ae-reading{display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:6px;padding:0}
.ikio-server-monitor .system-network-legend .ae-label{font-size:11px}
.ikio-server-monitor .system-network-legend .ae-value{font-size:12px}
.ikio-server-monitor .system-network-key{width:14px;border-top:2px solid var(--ae-network-download);flex:none}
.ikio-server-monitor .system-network-key.upload{border-top:2px dashed var(--ae-network-upload)}
.ikio-server-monitor .system-network-plot{display:block;width:100%;height:32px;overflow:visible}
.ikio-server-monitor .system-network-chart{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:6px;padding-block:4px}
.ikio-server-monitor .system-network-axis{display:grid;position:relative;height:32px;font-size:11px;line-height:1;color:var(--ae-muted);font-variant-numeric:tabular-nums}
.ikio-server-monitor .system-network-axis span{position:absolute;inset-inline-start:0;white-space:nowrap;transform:translateY(-50%)}
.ikio-server-monitor .system-network-times{display:flex;justify-content:space-between;color:var(--ae-muted);font-size:11px}
.ikio-server-monitor .system-footer>summary{font-size:13px;font-weight:500;color:var(--ae-text)}
.ikio-server-monitor .system-footer>summary:after,.ikio-server-monitor .system-footer[open]>summary:after{content:none}
.ikio-server-monitor .system-footer>summary>ha-icon{--mdc-icon-size:18px;flex:none}
.ikio-server-monitor .system-footer[open]>summary>ha-icon{transform:rotate(180deg)}
.ikio-server-monitor .system-error-note{color:var(--ae-error)}
.ikio-server-monitor .system-service-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;align-items:start}
.ikio-server-monitor .system-service{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;min-height:52px;padding:0 0 0 8px;border-radius:8px;background:var(--ae-well);min-width:0}
.ikio-server-monitor .system-service-identity{display:flex;align-items:center;gap:6px;min-height:44px;min-width:0;padding:0;border:0;border-radius:0;background:transparent;color:var(--ae-text);font:inherit;text-align:left}
.ikio-server-monitor .system-service-caption{display:grid;gap:0;min-width:0;padding-block:4px}
.ikio-server-monitor .system-service-name{font-size:12px;font-weight:500;overflow-wrap:anywhere}
.ikio-server-monitor .system-service-state{font-size:11px;color:var(--ae-muted);overflow-wrap:anywhere}
.ikio-server-monitor .system-service-dot{width:6px;height:6px;flex:none;border-radius:50%;background:var(--ae-muted)}
.ikio-server-monitor .system-service.running .system-service-dot{background:var(--ae-temperature)}
.ikio-server-monitor .system-service.stopped .system-service-dot{background:var(--ae-error)}
.ikio-server-monitor .system-service.stopped .system-service-state{color:var(--ae-error)}
.ikio-server-monitor .system-service-controls{display:flex;align-items:center}
.ikio-server-monitor .system-service-controls .ae-button{width:44px;min-width:44px;min-height:44px;padding:0;display:grid;place-items:center;background:transparent;border:0;color:var(--ae-muted)}
.ikio-server-monitor .system-service-controls ha-icon{--mdc-icon-size:17px}
.ikio-server-monitor .system-service.multiple-controls .system-service-identity{grid-column:1/-1}
.ikio-server-monitor .system-service.multiple-controls .system-service-controls{grid-column:1/-1;justify-content:flex-end}
@container(min-width:480px){.ikio-server-monitor .system-service-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.ikio-server-monitor .system-extra-readings{display:flex;flex-wrap:wrap;gap:6px;margin-block:2px 4px}
@container(max-width:310px){.ikio-server-monitor .system-header-meta{max-width:145px;gap:0 6px}.ikio-server-monitor>header>.ae-title,.ikio-server-monitor>header>h2{font-size:15px}}
`;
export function ringReading(label, percent, entity, level, hass, digits = 1) {
  const result = reading(label, "", entity, "system-ring-reading");
  const name = result.querySelector(".ae-label");
  const text =
    percent === null ? "—" : `${formatNumber(hass, percent, digits)}%`;
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
  const low = values.reduce((min, value) => Math.min(min, value), Infinity);
  const high = values.reduce((max, value) => Math.max(max, value), 0);
  const constant = low === high;
  const yMin = constant ? 0 : low;
  const yMax = high || 1;
  const y = (value) => 2 + ((yMax - value) / (yMax - yMin)) * 28;
  const rateLabel = (value) => {
    const power =
      value > 0
        ? Math.min(4, Math.max(0, Math.floor(Math.log10(value) / 3)))
        : 0;
    return `${formatNumber(hass, value / 1000 ** power, 1)} ${["B/s", "kB/s", "MB/s", "GB/s", "TB/s"][power]}`;
  };
  const svg = svgNode("svg", {
    viewBox: "0 0 300 32",
    preserveAspectRatio: "none",
    class: "system-network-plot",
    role: "img",
    "aria-label": `Download and upload history, last 30 minutes. Visible minimum ${rateLabel(low)}, maximum ${rateLabel(high)}. Shared scale ${rateLabel(yMin)} to ${rateLabel(yMax)}.`,
  });
  const ticks = constant
    ? [{ value: high, kind: "constant" }]
    : [
        { value: high, kind: "max" },
        { value: low, kind: "min" },
      ];
  for (const tick of ticks)
    svg.append(
      svgNode("line", {
        x1: 0,
        x2: 300,
        y1: y(tick.value),
        y2: y(tick.value),
        stroke: "var(--ae-text)",
        "stroke-opacity": 0.07,
        "stroke-width": 1,
        "stroke-dasharray": "3 4",
        "vector-effect": "non-scaling-stroke",
        "data-guide": tick.kind,
        "aria-hidden": "true",
      }),
    );
  for (const row of series) {
    let d = "",
      known = false;
    // Close each known interval at the first unknown timestamp before
    // downsampling. A single recorded state represents the whole interval.
    const segments = [];
    let segment = [];
    for (const point of row.points) {
      if (point.value === null) {
        if (segment.length) {
          segment.push({ ...segment.at(-1), time: point.time });
          segments.push(segment);
          segment = [];
        }
      } else segment.push(point);
    }
    if (segment.length) segments.push(segment);
    const budget = Math.max(4, Math.floor(180 / (segments.length || 1)));
    const points = segments.flatMap((part) => [
      { value: null },
      ...downsample(part, budget),
    ]);
    for (const point of points) {
      if (point.value === null) {
        known = false;
        continue;
      }
      const x = Math.max(
        0,
        Math.min(300, ((point.time - start) / 1800000) * 300),
      );
      d += `${known ? "L" : "M"}${x},${y(point.value)} `;
      known = true;
    }
    if (!d) continue;
    svg.append(
      svgNode("path", {
        d,
        fill: "none",
        stroke:
          row.key === "network_tx"
            ? "var(--ae-network-upload)"
            : "var(--ae-network-download)",
        "stroke-width": 1,
        "vector-effect": "non-scaling-stroke",
        ...(row.key === "network_tx" ? { "stroke-dasharray": "4 3" } : {}),
      }),
    );
  }
  const chart = el("div", undefined, "system-network-chart");
  const axis = el("div", undefined, "system-network-axis");
  for (const tick of ticks) {
    // Reserve the measured width of both labels without duplicating them for AT.
    const sizing = el("span", rateLabel(tick.value));
    sizing.style.cssText =
      "grid-area:1/1;position:static;visibility:hidden;transform:none";
    sizing.setAttribute("aria-hidden", "true");
    axis.append(sizing);
    const label = el("span", rateLabel(tick.value));
    label.dataset.extremum = tick.kind;
    label.style.top = `${(y(tick.value) / 32) * 100}%`;
    axis.append(label);
  }
  chart.append(axis, svg);
  return chart;
}
