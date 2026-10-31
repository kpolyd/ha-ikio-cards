import { t } from "@ikio/card-ui";
import {
  ControlCard,
  el,
  numeric,
  unitValue,
  note,
  formatNumber,
  available,
} from "@ikio/card-ui";
import { darkGraphStops as stops, graphPalette } from "./palette.js";
export {
  darkGraphStops as stops,
  lightGraphStops,
  graphPalette,
} from "./palette.js";
export function colour(value, min = 0, max = 3500, colourStops = stops) {
  if (!Number.isFinite(value))
    throw Error("Colour requires a finite numeric value");
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max)
    throw Error("Expected minimum must be less than maximum");
  const v = Math.max(0, Math.min(3500, ((value - min) / (max - min)) * 3500));
  for (let i = 1; i < colourStops.length; i++) {
    const [a, c1] = colourStops[i - 1],
      [b, c2] = colourStops[i];
    if (v <= b) {
      const t = (v - a) / (b - a);
      return (
        "#" +
        [1, 3, 5]
          .map((j) =>
            Math.round(
              parseInt(c1.slice(j, j + 2), 16) * (1 - t) +
                parseInt(c2.slice(j, j + 2), 16) * t,
            )
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")
      );
    }
  }
  return colourStops.at(-1)[1];
}
const normalized = new WeakMap();
export function normalizeHistory(data, unit) {
  if (data && normalized.get(data)?.has(unit))
    return normalized.get(data).get(unit);
  let previousAttributes = {};
  const result = (data || [])
    .map((item) => {
      previousAttributes = item.a || item.attributes || previousAttributes;
      const time = Number.isFinite(item.lu)
        ? item.lu * 1000
        : Date.parse(item.last_updated || item.last_changed);
      const raw = item.s ?? item.state;
      let value =
        raw !== undefined &&
        String(raw).trim() !== "" &&
        Number.isFinite(Number(raw))
          ? Number(raw)
          : null;
      const source = previousAttributes.unit_of_measurement;
      if (value !== null && source && source !== unit) {
        const pseudo = {
          state: String(value),
          attributes: { unit_of_measurement: source },
        };
        const watts = unitValue(pseudo, "power");
        const factor = { W: 1, kW: 1000, MW: 1e6 }[unit];
        value = watts !== null && factor ? watts / factor : null;
      }
      return { time, value };
    })
    .filter((p) => Number.isFinite(p.time))
    .sort((a, b) => a.time - b.time);
  if (data) {
    if (!normalized.has(data)) normalized.set(data, new Map());
    normalized.get(data).set(unit, result);
  }
  return result;
}
export function downsample(points, limit = 240) {
  if (points.length <= limit) return points;
  const buckets = Math.max(1, Math.floor((limit - 2) / 3)),
    out = [points[0]];
  for (let i = 0; i < buckets; i++) {
    const chunk = points.slice(
      1 + Math.floor((i * (points.length - 2)) / buckets),
      1 + Math.floor(((i + 1) * (points.length - 2)) / buckets),
    );
    if (!chunk.length) continue;
    const valid = chunk.filter((p) => p.value !== null);
    const selected = [];
    if (valid.length) {
      selected.push(
        valid.reduce((a, b) => (a.value < b.value ? a : b)),
        valid.reduce((a, b) => (a.value > b.value ? a : b)),
      );
    }
    const gap = chunk.find((p) => p.value === null);
    if (gap) selected.push(gap);
    out.push(...[...new Set(selected)].sort((a, b) => a.time - b.time));
  }
  out.push(points.at(-1));
  return out;
}
const caches = new WeakMap();
const stamp = (item) =>
  Number.isFinite(item.lu)
    ? item.lu * 1000
    : Date.parse(item.last_updated || item.last_changed);
function expandHistory(items) {
  let attributes = {};
  return (items || []).map((item) => {
    attributes = item.a || item.attributes || attributes;
    return { ...item, a: attributes };
  });
}
export async function fetchHistory(hass, ids, hours, now = Date.now()) {
  const owner = hass.connection || hass;
  let cache = caches.get(owner);
  if (!cache) {
    cache = new Map();
    caches.set(owner, cache);
  }
  ids = [...new Set(ids)].sort();
  const key = JSON.stringify([ids, hours]);
  let entry = cache.get(key);
  if (entry?.pending) return entry.pending;
  if (entry?.data && now >= entry.end && now - entry.end < 60000)
    return entry.data;
  if (!entry) {
    entry = {};
    cache.set(key, entry);
  }
  if (cache.size > 32) cache.delete(cache.keys().next().value);
  const floor = now - hours * 3600000;
  const incremental = entry.data && entry.end > floor && now >= entry.end;
  const start = incremental ? Math.max(floor, entry.end - 60000) : floor;
  let timer;
  const pending = (async () => {
    try {
      const data = await Promise.race([
        new Promise((resolve) =>
          resolve(
            hass.callWS({
              type: "history/history_during_period",
              start_time: new Date(start).toISOString(),
              end_time: new Date(now).toISOString(),
              entity_ids: ids,
              include_start_time_state: true,
              significant_changes_only: false,
              minimal_response: true,
              no_attributes: false,
            }),
          ),
        ),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("History timed out")), 10000);
        }),
      ]);
      const merged = {};
      for (const id of ids) {
        const recent = expandHistory(data[id]);
        const prior = incremental
          ? (entry.data[id] || []).filter((item) => stamp(item) < start)
          : [];
        const items = [...prior, ...recent]
          .filter((item) => Number.isFinite(stamp(item)))
          .sort((a, b) => stamp(a) - stamp(b));
        const first = items.findIndex((item) => stamp(item) >= floor);
        merged[id] =
          first < 0 ? items.slice(-1) : items.slice(Math.max(0, first - 1));
      }
      entry.data = merged;
      entry.end = now;
      return merged;
    } finally {
      clearTimeout(timer);
      entry.pending = undefined;
    }
  })();
  entry.pending = pending;
  return pending;
}
function svgNode(tag, attrs = {}) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
}
export function windowPoints(points, start, end) {
  const inWindow = points.filter(
    (p) =>
      (start === undefined || p.time >= start) &&
      (end === undefined || p.time <= end),
  );
  if (start !== undefined) {
    const before = points.filter((p) => p.time < start).at(-1);
    if (before && (!inWindow.length || inWindow[0].time > start))
      inWindow.unshift({ ...before, time: start });
  }
  if (end !== undefined && inWindow.length && inWindow.at(-1).time < end)
    inWindow.push({ ...inWindow.at(-1), time: end });
  return inWindow;
}
let graphSequence = 0;
export function graph(
  series,
  {
    min = 0,
    max = 3500,
    start,
    end,
    unit = "",
    hass,
    axisLabels = false,
    axisGuides = false,
    formatAxis,
    sparkline = false,
    areaFill = false,
    timeLabels = false,
    colourStops = stops,
    graphId = ++graphSequence,
  } = {},
) {
  series = series.map((s) => ({
    ...s,
    points: windowPoints(s.points, start, end),
  }));
  const data = series
    .flatMap((s) => downsample(s.points))
    .filter((p) => p.value !== null);
  if (!data.length && sparkline) return el("span");
  if (!data.length)
    return note(
      t(hass, "No history available. Live readings remain available."),
    );
  const low = Math.min(...data.map((p) => p.value)),
    high = Math.max(...data.map((p) => p.value));
  const constant = low === high;
  const padding = Math.max(Math.abs(low) * 0.01, 1);
  const yMin = sparkline
      ? low
      : axisLabels
        ? constant
          ? low - padding
          : low
        : Math.min(0, low),
    yMax = sparkline
      ? constant
        ? high + padding
        : high
      : axisLabels && constant
        ? high + padding
        : high === yMin
          ? yMin + 1
          : high;
  const xMin = start ?? Math.min(...data.map((p) => p.time)),
    xMax = end ?? Math.max(...data.map((p) => p.time));
  const timeTicks = Array.from(
    { length: 4 },
    (_, index) => xMin + ((xMax - xMin) * index) / 3,
  );
  const width = 360,
    height = 100,
    x = (t) => 8 + ((t - xMin) / Math.max(1, xMax - xMin)) * 344,
    y = (v) => 8 + ((yMax - v) / (yMax - yMin)) * (axisLabels ? 84 : 72);
  const axisText =
    formatAxis ||
    ((value, unit) => `${formatNumber(hass, value)}${unit ? " " + unit : ""}`);
  const ticks = constant
    ? [{ value: high, kind: "constant" }]
    : [
        { value: high, kind: "max" },
        ...(axisGuides ? [{ value: (high + low) / 2, kind: "mid" }] : []),
        { value: low, kind: "min" },
      ];
  // A rounded midpoint that repeats an endpoint adds clutter without information.
  const visibleTicks = ticks.filter(
    (tick) =>
      tick.kind !== "mid" ||
      (axisText(tick.value, unit) !== axisText(low, unit) &&
        axisText(tick.value, unit) !== axisText(high, unit)),
  );
  const wrap = el("div", undefined, undefined, "history-graph");
  const svg = svgNode("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "ae-graph",
    preserveAspectRatio: axisLabels || sparkline ? "none" : "xMidYMid meet",
    role: "img",
    "aria-label": t(hass, "{series} history, {low} to {high}", {
      series: series.map((s) => s.name).join(", "),
      low: axisText(low, unit),
      high: axisText(high, unit),
    }),
  });
  const defs = svgNode("defs");
  svg.append(defs);
  if (axisLabels && axisGuides) {
    const guides = svgNode("g", {
      "aria-hidden": "true",
      class: "ae-axis-guides",
    });
    for (const tick of visibleTicks)
      guides.append(
        svgNode("line", {
          x1: 8,
          x2: 352,
          y1: y(tick.value),
          y2: y(tick.value),
          stroke: "var(--ae-text)",
          "stroke-opacity": 0.07,
          "stroke-width": 1,
          "stroke-dasharray": "3 4",
          "vector-effect": "non-scaling-stroke",
          "data-guide": tick.kind,
        }),
      );
    if (timeLabels)
      for (const time of timeTicks)
        guides.append(
          svgNode("line", {
            x1: x(time),
            x2: x(time),
            y1: y(yMax),
            y2: y(yMin),
            stroke: "var(--ae-text)",
            "stroke-opacity": 0.07,
            "stroke-width": 1,
            "stroke-dasharray": "3 4",
            "vector-effect": "non-scaling-stroke",
            "data-guide": "time",
          }),
        );
    svg.append(guides);
  }
  series.forEach((s, index) => {
    const rangeMin = s.min ?? min,
      rangeMax = s.max ?? max;
    const id = `ae-gradient-${graphId}-${index}`;
    const gradient = svgNode("linearGradient", {
      id,
      gradientUnits: "userSpaceOnUse",
      x1: 0,
      x2: 0,
      y1: y(rangeMin),
      y2: y(rangeMax),
      spreadMethod: "pad",
      "color-interpolation": "sRGB",
    });
    for (const [position, colour] of colourStops)
      gradient.append(
        svgNode("stop", { offset: position / 3500, "stop-color": colour }),
      );
    defs.append(gradient);
    let d = "",
      previous = false;
    for (const point of downsample(s.points)) {
      if (point.value === null) {
        if (previous && sparkline) d += `H${x(point.time)} `;
        previous = false;
        continue;
      }
      d +=
        previous && sparkline
          ? `H${x(point.time)} V${y(point.value)} `
          : `${previous ? "L" : "M"}${x(point.time)},${y(point.value)} `;
      previous = true;
    }
    if (areaFill) {
      // Close each uninterrupted history segment independently to preserve gaps.
      const baseline = y(yMin);
      const areas = d.match(/M[^M]+/g) || [];
      const areaPath = areas
        .map((segment) => {
          const commands = [...segment.matchAll(/([MLHV])([^MLHVZ]+)/g)];
          const firstX = commands[0]?.[2].split(",")[0].trim();
          const lastX = commands
            .filter(([_, command]) => command !== "V")
            .at(-1)?.[2]
            .split(",")[0]
            .trim();
          if (firstX === undefined || lastX === undefined) return "";
          return `${segment}L${lastX},${baseline} L${firstX},${baseline} Z`;
        })
        .join(" ");
      svg.append(
        svgNode("path", {
          d: areaPath,
          class: "ae-area-fill",
          fill: `url(#${id})`,
          "fill-opacity": sparkline ? 0.08 : 0.16,
          "aria-hidden": "true",
          "pointer-events": "none",
        }),
      );
    }
    const path = svgNode("path", {
      d,
      fill: "none",
      stroke: `url(#${id})`,
      "stroke-width": 2,
      "stroke-linecap": "round",
      ...(sparkline
        ? { "vector-effect": "non-scaling-stroke", "stroke-width": 0.8 }
        : {}),
    });
    if (index) path.setAttribute("stroke-dasharray", index % 2 ? "5 3" : "2 3");
    svg.append(path);
  });
  if (axisLabels) {
    const plot = el("div", undefined, "ae-axis-chart");
    plot.style.cssText =
      "display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:6px;";
    const labels = el("div", undefined, "ae-y-axis");
    labels.style.cssText =
      "display:grid;align-items:start;font-size:12px;color:var(--ae-muted);font-variant-numeric:tabular-nums;";
    for (const tick of visibleTicks) {
      const node = el("span", axisText(tick.value, unit));
      node.dataset.extremum = tick.kind;
      node.style.cssText = `grid-area:1/1;position:relative;top:${y(tick.value)}%;transform:translateY(-50%);white-space:nowrap;`;
      labels.append(node);
    }
    plot.append(labels, svg);
    if (timeLabels) {
      // Reserve the existing graph height for plot + labels, avoiding card growth.
      plot.style.gridTemplateRows = "68px 16px";
      svg.style.height = "68px";
      const times = el("div", undefined, "ae-time-axis");
      times.style.cssText =
        "grid-column:2;position:relative;font-size:10px;color:var(--ae-muted);font-variant-numeric:tabular-nums;line-height:16px;white-space:nowrap";
      const formatter = new Intl.DateTimeFormat(
        hass?.locale?.language || hass?.language,
        {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          ...(hass?.config?.time_zone
            ? { timeZone: hass.config.time_zone }
            : {}),
        },
      );
      for (const [index, time] of timeTicks.entries()) {
        const label = el("span", formatter.format(time));
        label.title = new Date(time).toISOString();
        label.style.cssText = `position:absolute;left:${(x(time) / width) * 100}%;transform:translateX(${index === 0 ? 0 : index === timeTicks.length - 1 ? -100 : -50}%)`;
        times.append(label);
      }
      plot.append(times);
    }
    wrap.append(plot);
  } else if (sparkline) {
    wrap.append(svg);
  } else {
    wrap.append(svg);
    wrap.append(
      note(
        `${formatNumber(hass, low)}–${formatNumber(hass, high)} ${unit} · ${new Date(xMin).toLocaleTimeString(hass?.locale?.language, { hour: "2-digit", minute: "2-digit" })}–${new Date(xMax).toLocaleTimeString(hass?.locale?.language, { hour: "2-digit", minute: "2-digit" })}`,
      ),
    );
  }
  return wrap;
}
export class HistoryCard extends ControlCard {
  get graphStops() {
    return graphPalette(this.config?.appearance?.theme, this.hass);
  }
  onConfig() {
    this.history = {};
    this.historyError = "";
    this.historyKey = "";
    this.loading = false;
    this.onVisibility();
  }
  onVisibility() {
    clearInterval(this.refreshTimer);
    if (this.visible && this.isConnected && !this.preview) {
      this.loadHistory();
      this.refreshTimer = setInterval(() => this.loadHistory(true), 60000);
    }
  }
  onDisconnect() {
    clearInterval(this.refreshTimer);
    this.historyKey = "";
    this.historyRequest = (this.historyRequest || 0) + 1;
    this.loading = false;
  }
  historyEntities() {
    return [];
  }
  async loadHistory(force = false) {
    const ids = this.historyEntities();
    if (
      !this.hass?.callWS ||
      !ids.length ||
      this.preview ||
      !this.visible ||
      !this.isConnected
    )
      return;
    if (this.historyConnection !== this.hass.connection) {
      this.historyConnection = this.hass.connection;
      this.historyRequest = (this.historyRequest || 0) + 1;
      this.historyKey = "";
      this.loading = false;
    }
    const key = JSON.stringify([ids, this.config.hours || 6]);
    if (!force && key === this.historyKey) return;
    this.historyKey = key;
    if (this.loading) return;
    const revision = this.revision;
    const connection = this.hass.connection;
    const request = (this.historyRequest = (this.historyRequest || 0) + 1);
    const valid = () =>
      revision === this.revision &&
      request === this.historyRequest &&
      connection === this.hass?.connection;
    this.loading = true;
    let timer;
    try {
      const data = await Promise.race([
        fetchHistory(this.hass, ids, this.config.hours || 6),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error("History timed out")), 10000);
        }),
      ]);
      if (!valid()) return;
      this.history = data;
      this.historyError = "";
    } catch {
      if (!valid()) return;
      this.historyError =
        "History could not be loaded. Live readings remain available.";
    } finally {
      clearTimeout(timer);
      if (valid()) {
        this.loading = false;
        this.update();
      }
    }
  }
  afterRender() {
    this.loadHistory();
  }
  historyView(rows, options = {}) {
    if (this.historyError) return note(t(this.hass, this.historyError));
    if (this.loading && !Object.keys(this.history || {}).length)
      return note(t(this.hass, "Loading history…"));
    const units = rows
      .map((r) => this.state(r.entity)?.attributes?.unit_of_measurement)
      .filter(Boolean);
    if (new Set(units).size > 1)
      return note(
        t(this.hass, "Choose entities with the same unit for a shared graph."),
      );
    const unit = units[0] || "";
    const now = Date.now();
    return graph(
      rows.map((r) => ({
        name: r.name || this.label(r.entity),
        min: r.expected_min ?? this.config.expected_min,
        max: r.expected_max ?? this.config.expected_max,
        points: normalizeHistory(this.history?.[r.entity], unit),
      })),
      {
        graphId: (this.graphId ??= ++graphSequence),
        min: this.config.expected_min ?? 0,
        max: this.config.expected_max ?? 3500,
        start: now - (this.config.hours || 6) * 3600000,
        end: now,
        unit,
        hass: this.hass,
        colourStops: this.graphStops,
        ...options,
      },
    );
  }
}
