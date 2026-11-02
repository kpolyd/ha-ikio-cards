import { HistoryCard, normalizeHistory, windowPoints } from "@ikio/graph";
import { t } from "@ikio/card-ui/i18n";
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
    this.content.classList.add("mini-graph-content");
    this.shadowRoot.append(
      el(
        "style",
        `
:host{display:block;min-width:0}ha-card{padding:6px 8px;min-height:100px;height:100%;box-sizing:border-box;display:flex;flex-direction:column}.mini-graph-content{flex:1;min-height:0;display:flex;min-width:0}
.mini-graph{flex:1;display:flex;flex-direction:column;gap:1px;min-width:0}.mini-graph header{margin:0;min-width:0}.mini-graph header .ae-title{min-height:16px;padding:0;text-align:left}.mini-graph header .ae-title,.mini-graph header h2{font-size:11px;font-weight:500;line-height:16px;margin:0;overflow-wrap:anywhere}
.mini-readings{display:flex;justify-content:space-between;align-items:baseline;gap:8px;min-width:0}.mini-readings .ae-reading{display:block;min-height:24px;min-width:0;padding:0;flex:1;max-width:100%}.mini-readings .ae-label{display:none}.mini-readings .ae-value{font-size:14px;font-weight:500;line-height:24px;overflow-wrap:anywhere}.mini-secondary{text-align:right}.mini-secondary .ae-value{font-size:12px!important;font-weight:400!important;color:var(--ae-muted)}.mini-secondary ha-state-icon{--mdc-icon-size:11px;display:inline-flex;margin-right:4px;vertical-align:middle}
.mini-chart{height:calc(var(--mini-plot-height) + 12px);flex:1;min-width:0;min-height:var(--mini-plot-height)}.mini-chart .ae-axis-chart{position:relative;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(var(--mini-plot-height),1fr) 12px!important;column-gap:0!important;height:100%;min-height:0}.mini-chart .ae-graph{position:absolute;inset:0 0 auto 0;grid-column:1;height:calc(100% - 12px)!important;width:100%;min-height:0}.mini-chart .ae-y-axis{position:absolute;inset:0 0 12px 0;z-index:1;pointer-events:none;display:block!important}.mini-chart .ae-y-axis span{position:absolute!important;left:2.22%;background:var(--ae-surface);border-radius:2px;padding:0 2px;font-size:8px;line-height:10px;white-space:nowrap}.mini-chart [data-extremum=mid]{display:none}.mini-chart .ae-time-axis{grid-row:2;grid-column:1!important;font-size:8px!important;line-height:12px!important}.mini-chart .ae-graph path:not(.ae-area-fill){stroke-width:.8;vector-effect:non-scaling-stroke}.mini-chart .ae-area-fill{fill-opacity:.06}
.mini-chart.no-extrema .ae-y-axis{display:none!important}.mini-chart.no-times .ae-axis-chart{grid-template-rows:minmax(var(--mini-plot-height),1fr)!important}.mini-chart.no-times .ae-y-axis{bottom:0}.mini-chart.no-times .ae-graph{height:100%!important}
`,
      ),
    );
  }
  setConfig(config) {
    super.setConfig(normalizeConfig(config));
  }
  static getStubConfig() {
    return { primary_entity: "", hours: 6 };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-mini-graph-card-editor");
  }
  getCardSize() {
    return 1;
  }
  getGridOptions() {
    return { columns: 6, rows: 2, min_columns: 3, min_rows: 2 };
  }
  historyEntities() {
    return [this.config?.primary_entity].filter(Boolean);
  }
  render() {
    const c = this.config || {},
      id = c.primary_entity;
    if (!id)
      return note(
        t(this.hass, "Choose a primary numeric entity in the visual editor."),
      );
    const header = title(this, c.name || this.label(id), id);
    const values = el("div", undefined, "mini-readings");
    const primary = reading(
      this.label(id),
      valueText(this.hass, id),
      id,
      "mini-primary",
    );
    primary.setAttribute(
      "aria-label",
      `${this.label(id)}: ${valueText(this.hass, id)}`,
    );
    values.append(primary);
    if (c.secondary_entity) {
      const secondary = reading(
        this.label(c.secondary_entity),
        valueText(this.hass, c.secondary_entity),
        c.secondary_entity,
        "mini-secondary",
      );
      secondary.setAttribute(
        "aria-label",
        `${this.label(c.secondary_entity)}: ${valueText(this.hass, c.secondary_entity)}`,
      );
      const icon = el("ha-state-icon");
      icon.hass = this.hass;
      icon.stateObj = this.state(c.secondary_entity);
      secondary.querySelector(".ae-value").prepend(icon);
      values.append(secondary);
    }
    const unit = this.state(id)?.attributes?.unit_of_measurement || "";
    const points = windowPoints(
      normalizeHistory(this.history?.[id], unit),
      Date.now() - c.hours * 3600000,
      Date.now(),
    );
    const numbers = points
      .filter((p) => Number.isFinite(p.value))
      .map((p) => p.value);
    const low = numbers.length ? Math.min(...numbers) : 0,
      high = numbers.length ? Math.max(...numbers) : 1;
    let min = c.expected_min ?? low,
      max = c.expected_max ?? high;
    if (min >= max) {
      if (Number.isFinite(c.expected_min)) max = min + 1;
      else min = max - 1;
    }
    const plot = this.historyView(
      [{ entity: id, expected_min: min, expected_max: max }],
      {
        min,
        max,
        axisLabels: true,
        axisGuides: true,
        areaFill: true,
        timeLabels: c.show_time_labels,
        timeLabelCount: 3,
        formatAxis: (value, unit) =>
          `${formatNumber(this.hass, value, 1)}${unit ? " " + unit : ""}`,
      },
    );
    plot.classList.add("mini-chart");
    plot.classList.toggle("no-extrema", !c.show_extrema);
    plot.classList.toggle("no-times", !c.show_time_labels);
    const result = group(header, values, plot);
    result.classList.add("mini-graph");
    result.style.setProperty("--mini-plot-height", `${c.graph_height}px`);
    return result;
  }
}
