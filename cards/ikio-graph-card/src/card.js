import { t } from "@ikio/card-ui/i18n";
import { HistoryCard, normalizeHistory, windowPoints } from "@ikio/graph";
import {
  group,
  title,
  reading,
  valueText,
  note,
  el,
  formatNumber,
} from "@ikio/card-ui";
import { normalizeConfig } from "./config.js";
export class Card extends HistoryCard {
  constructor() {
    super();
    this.content.classList.add("graph-content");
    this.shadowRoot.append(
      el(
        "style",
        `
:host{height:100%;min-height:128px}ha-card{height:100%;min-height:128px;padding:8px;display:flex;flex-direction:column}.graph-content{display:flex;flex:1;min-width:0;min-height:0}
.ikio-graph{display:grid;grid-template-rows:auto minmax(40px,1fr);gap:2px;flex:1;min-width:0;min-height:0}.ikio-graph.has-legend{grid-template-rows:auto minmax(40px,1fr) auto}
.ikio-graph>header{display:flex;gap:5px;align-items:center;margin:0;min-width:0}.ikio-graph>header>ha-icon{--mdc-icon-size:16px;color:var(--ae-muted);flex:none}.ikio-graph>header>.ae-title,.ikio-graph>header>h2{font-size:13px;font-weight:500;line-height:1.25;flex:1;min-width:0;overflow-wrap:anywhere}.ikio-graph>header>.ae-title{margin:0}
.ikio-graph .graph-current{padding:0;min-height:44px;flex:none;text-align:right}.graph-current .ae-label{display:none}.graph-current .ae-value{font-size:20px;font-weight:500;white-space:nowrap}
.graph-chart{min-width:0;min-height:0}.ikio-graph .ae-axis-chart{height:100%;min-height:0;grid-template-rows:minmax(0,1fr) 14px!important;column-gap:5px!important}.ikio-graph .ae-graph{height:100%!important;min-height:0;width:100%}.ikio-graph .ae-y-axis{font-size:10px!important;min-height:0}.ikio-graph [data-extremum=mid]{display:none}.ikio-graph .ae-time-axis{font-size:9px!important;line-height:14px!important}.ikio-graph .ae-graph path:not(.ae-area-fill){stroke-width:.8;vector-effect:non-scaling-stroke}.ikio-graph .ae-area-fill{fill-opacity:.06}
.ikio-graph .ikio-legend{display:flex;flex-wrap:wrap;gap:0 10px;border-top:1px solid var(--ae-border);padding-top:1px;margin-top:2px;min-width:0}.ikio-legend-entry{display:flex;align-items:center;gap:4px;min-width:0;max-width:100%}.ikio-line-sample{width:14px;flex:none;border-top:1px solid var(--ae-accent)}.ikio-line-sample.dashed{border-top-style:dashed}.ikio-line-sample.dotted{border-top-style:dotted}.ikio-legend-entry .ae-reading{display:flex;flex-direction:row;align-items:center;gap:5px;min-height:44px;padding:0;min-width:0}.ikio-legend-entry .ae-label{font-size:11px;color:var(--ae-muted)}.ikio-legend-entry .ae-value{font-size:11px;font-weight:500}
`,
      ),
    );
  }
  setConfig(config) {
    super.setConfig(normalizeConfig(config));
  }
  static getStubConfig() {
    return { schema_version: 1, entities: [], hours: 6, show_legend: true };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-graph-card-editor");
  }
  getCardSize() {
    return this.config?.entities?.length > 1 &&
      this.config.show_legend !== false
      ? 3
      : 2;
  }
  getGridOptions() {
    return { columns: 6, rows: 3, min_columns: 3, min_rows: 3 };
  }
  historyEntities() {
    return (this.config?.entities || []).map((r) => r.entity).filter(Boolean);
  }
  colourRange(rows) {
    const now = Date.now(),
      unit = this.state(rows[0]?.entity)?.attributes?.unit_of_measurement || "";
    const values = rows
      .flatMap((r) =>
        windowPoints(
          normalizeHistory(this.history?.[r.entity], unit),
          now - (this.config.hours || 6) * 3600000,
          now,
        ),
      )
      .filter((p) => Number.isFinite(p.value))
      .map((p) => p.value);
    const low = values.length ? Math.min(...values) : 0,
      high = values.length ? Math.max(...values) : 1;
    const pad = Math.max(Math.abs(low) * 0.01, 1);
    let min = this.config.expected_min ?? (low === high ? low - pad : low),
      max = this.config.expected_max ?? (low === high ? high + pad : high);
    if (min >= max) {
      if (Number.isFinite(this.config.expected_min)) max = min + pad;
      else min = max - pad;
    }
    return { min, max };
  }
  render() {
    const rows = (this.config.entities || []).filter((r) => r.entity);
    if (!rows.length)
      return note(
        t(this.hass, "Choose numeric entities in the visual editor."),
      );
    const single = rows.length === 1,
      show = this.config.show_legend !== false;
    const header = title(
      this,
      this.config.name ||
        (single
          ? rows[0].name || this.label(rows[0].entity)
          : t(this.hass, "Graph")),
      single ? rows[0].entity : null,
    );
    const icon = el("ha-icon");
    icon.setAttribute("icon", "mdi:chart-line");
    header.prepend(icon);
    if (single && show) {
      const name = rows[0].name || this.label(rows[0].entity),
        state = this.state(rows[0].entity),
        value =
          (state && this.hass?.formatEntityState?.(state)) ||
          valueText(this.hass, rows[0].entity);
      const current = reading(name, value, rows[0].entity, "graph-current");
      current.setAttribute("aria-label", `${name}: ${value}`);
      header.append(current);
    }
    const range = this.colourRange(rows);
    const plotRows = rows.map((r) => {
      let min = r.expected_min ?? range.min,
        max = r.expected_max ?? range.max;
      const pad = Math.max(Math.abs(min) * 0.01, 1);
      if (min >= max) {
        if (Number.isFinite(r.expected_min)) max = min + pad;
        else min = max - pad;
      }
      return { ...r, expected_min: min, expected_max: max };
    });
    const plot = this.historyView(plotRows, {
      ...range,
      axisLabels: true,
      axisGuides: true,
      timeLabels: true,
      areaFill: true,
      formatAxis: (value, unit) =>
        `${formatNumber(this.hass, value, 1)}${unit ? " " + unit : ""}`,
    });
    plot.classList.add("graph-chart");
    const result = group(header, plot);
    result.classList.add("ikio-graph");
    if (!single && show) {
      result.classList.add("has-legend");
      const legend = el("div", undefined, "ikio-legend");
      rows.forEach((r, i) => {
        const entry = el("div", undefined, "ikio-legend-entry");
        const sample = el(
          "span",
          undefined,
          `ikio-line-sample ${i ? (i % 2 ? "dashed" : "dotted") : ""}`,
        );
        sample.setAttribute("aria-hidden", "true");
        sample.style.borderTopColor = this.graphStops[0][1];
        entry.append(
          sample,
          reading(
            r.name || this.label(r.entity),
            valueText(this.hass, r.entity),
            r.entity,
          ),
        );
        legend.append(entry);
      });
      result.append(legend);
    }
    return result;
  }
}
