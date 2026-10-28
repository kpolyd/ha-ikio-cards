import { rateDisplay } from "./rate-display.js";
import { t, el } from "@ikio/card-ui";
import { downsample, windowPoints } from "@ikio/graph";
import { rateHistory } from "./adapter.js";
const svgNode = (tag, attrs = {}) => {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};
export const networkStyles = `.ikio-router .system-network{display:grid;gap:0}
.ikio-router .system-network-legend{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px 12px}
.ikio-router .system-network-legend .ae-reading{display:flex;flex-direction:row;align-items:center;justify-content:flex-start;flex-wrap:wrap;min-width:0;gap:4px 6px;padding:0}
.ikio-router .system-network-legend .ae-label{font-size:11px;white-space:nowrap}
.ikio-router .system-network-legend .ae-value{font-size:12px}
.ikio-router .system-network-key{width:14px;border-top:2px solid var(--ae-network-download);flex:none}
.ikio-router .system-network-key.upload{border-top:2px dashed var(--ae-network-upload)}
.ikio-router .system-network-plot{display:block;width:100%;height:var(--router-plot-height,132px);overflow:visible}
.ikio-router .system-network-chart{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:6px;padding-block:4px}
.ikio-router .system-network-axis{display:grid;position:relative;height:var(--router-plot-height,132px);font-size:11px;line-height:1;color:var(--ae-muted);font-variant-numeric:tabular-nums}
.ikio-router .system-network-axis span{position:absolute;inset-inline-start:0;white-space:nowrap;transform:translateY(-50%)}
.ikio-router .system-network-times{grid-column:2;display:flex;justify-content:space-between;color:var(--ae-muted);font-size:11px}
`;
export function networkPlot(
  rows,
  history,
  now,
  hass,
  minutes = 30,
  height = 132,
) {
  const start = now - minutes * 60000;
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
  const y = (value) => 7 + ((yMax - value) / (yMax - yMin)) * (height - 14);
  // One shared axis needs one display unit. Prefer the configured download
  // sensor, falling back to upload; each live reading keeps its own settings.
  const reference = rows.find((row) => row.key === "network_rx") || rows[0];
  const rateLabel = (value) => rateDisplay(hass, reference, value);
  const svg = svgNode("svg", {
    viewBox: `0 0 300 ${height}`,
    preserveAspectRatio: "none",
    class: "system-network-plot",
    role: "img",
    "aria-label": t(
      hass,
      "Download and upload history, last {minutes} minutes. Visible minimum {low}, maximum {high}. Shared scale {min} to {max}.",
      {
        minutes,
        low: rateLabel(low),
        high: rateLabel(high),
        min: rateLabel(yMin),
        max: rateLabel(yMax),
      },
    ),
  });
  const ticks = constant
    ? [{ value: high, kind: "constant" }]
    : [
        { value: high, kind: "max" },
        { value: (low + high) / 2, kind: "mid" },
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
        Math.min(300, ((point.time - start) / (minutes * 60000)) * 300),
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
    label.style.top = `${(y(tick.value) / height) * 100}%`;
    axis.append(label);
  }
  chart.append(axis, svg);
  chart.style.setProperty("--router-plot-height", `${height}px`);
  return chart;
}
export function miniGauge(fill, known) {
  const svg = svgNode("svg", {
    viewBox: "0 0 80 45",
    "aria-hidden": "true",
    class: "router-gauge",
  });
  svg.append(
    svgNode("path", {
      d: "M8 39 A32 32 0 0 1 72 39",
      class: "router-gauge-track",
    }),
  );
  if (known && fill > 0)
    svg.append(
      svgNode("path", {
        d: "M8 39 A32 32 0 0 1 72 39",
        class: "router-gauge-fill",
        pathLength: 100,
        "stroke-dasharray": `${fill} 100`,
      }),
    );
  return svg;
}
export const routerStyles = `
.ikio-router>header{grid-template-columns:18px minmax(0,1fr) auto}
.ikio-router .router-header-meta{display:flex;gap:6px;align-items:center;color:var(--ae-muted);font-size:11px;max-width:145px;overflow-wrap:anywhere}
.ikio-router button.router-uptime,.ikio-router button.router-signal,.ikio-router button.router-cell-title{background:none;border:0;padding:0;color:inherit;font:inherit;min-height:44px}
.ikio-router .router-status{width:6px;height:6px;border-radius:50%;background:var(--ae-muted);flex:none}
.ikio-router .router-status.online{background:var(--router-online)}.ikio-router .router-status.offline{background:var(--ae-error)}
.ikio-router .router-chips{display:flex;justify-content:center;flex-wrap:wrap;gap:6px}
.ikio-router .router-chips .ikio-sensor-chip{padding:4px 8px}
.ikio-router .router-path{display:grid;grid-template-columns:minmax(0,1fr) minmax(8px,.25fr) minmax(0,1fr) minmax(8px,.25fr) minmax(0,.8fr);align-items:start;padding-block:12px 8px;gap:0}
.ikio-router .router-node{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;width:100%;border:0;background:none;padding:0;font:inherit;color:var(--ae-text);min-height:44px;overflow-wrap:anywhere}
.ikio-router .router-symbol{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;color:var(--ae-muted);background:var(--ae-well);flex:none}
.ikio-router .router-symbol ha-icon{--mdc-icon-size:23px}
.ikio-router .router-center .router-symbol{width:58px;height:58px;margin-top:-6px;margin-bottom:-6px;border-radius:16px;color:var(--ae-temperature);background:var(--ae-well)}
.ikio-router .router-center .router-symbol ha-icon{--mdc-icon-size:30px}
.ikio-router .router-caption,.ikio-router .router-address{font-size:11px;color:var(--ae-muted);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.ikio-router .router-address{padding:0;border:0;background:none;font-family:inherit;width:100%;min-height:44px;display:flex;align-items:flex-start;justify-content:center;text-align:center}
.ikio-router .router-internet-group .router-node{margin-bottom:8px}
.ikio-router .router-internet.online .router-symbol{color:var(--router-online)}
.ikio-router .router-internet.offline .router-symbol{color:var(--ae-error)}
.ikio-router .router-link{height:46px;position:relative;display:flex;align-items:center;color:var(--ae-muted)}
.ikio-router .router-link:before{content:'';width:100%;height:1px;background:currentColor;opacity:.5}
.ikio-router .router-link:after{content:'';position:absolute;left:50%;width:5px;height:5px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px var(--ae-surface)}
.ikio-router .router-link.online{color:var(--router-online)}.ikio-router .router-link.offline{color:var(--ae-error)}
.ikio-router .router-cellular{background:var(--ae-well);padding:4px 12px 10px;border-radius:12px}
.ikio-router .router-cell-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;color:var(--ae-muted)}
.ikio-router .router-cell-title{display:flex;align-items:center;gap:6px;color:var(--ae-text);font-size:12px;min-height:32px}
.ikio-router .router-cell-title ha-icon{--mdc-icon-size:16px;color:var(--ae-temperature)}
.ikio-router .router-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:8px}
.ikio-router .router-metric{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;min-width:0;padding:0;border:0;background:none;font:inherit;color:var(--ae-temperature);min-height:44px}
.ikio-router .router-metric.warning{color:var(--ae-warning)}.ikio-router .router-metric.critical{color:var(--ae-error)}.ikio-router .router-metric.unknown{color:var(--ae-muted)}
.ikio-router .router-metric .ae-label{font-size:11px;color:var(--ae-muted)}
.ikio-router .router-gauge{display:block;width:66px;height:37px;margin:0 auto;overflow:visible}
.ikio-router .router-gauge-track{fill:none;stroke:var(--ae-border);stroke-width:5;stroke-linecap:round}
.ikio-router .router-gauge-fill{fill:none;stroke:currentColor;stroke-width:5;stroke-linecap:round}
.ikio-router .router-gauge-value{font-size:13px;font-weight:500;color:var(--ae-text);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.ikio-router .system-network{margin-top:6px}
.ikio-router .system-network-plot{overflow:hidden}
`;
