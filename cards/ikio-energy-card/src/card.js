import {
  HistoryCard,
  graph,
  normalizeHistory,
  windowPoints,
} from "@ikio/graph";
import {
  group,
  reading,
  valueText,
  el,
  note,
  formatNumber,
  unitValue,
} from "@ikio/card-ui";
import { validate } from "./config.js";
import {
  untracked,
  untrackedHistory,
  cycleTotal,
  forecastStatus,
  powerText,
  powerNumber,
  energyText,
} from "./adapter.js";
export class Card extends HistoryCard {
  validate = validate;
  constructor() {
    super();
    this.shadowRoot.prepend(
      el(
        "style",
        `
      .ae-energy{gap:4px}.ae-energy-header{display:flex;align-items:center;gap:8px;justify-content:space-between}
      .ae-energy-header h2{min-width:0;margin:0;font-size:14px;font-weight:600;overflow-wrap:anywhere}.ae-energy-header .ae-note{text-align:right;max-width:55%}
      .ae-energy-summary{display:grid;gap:10px;align-items:start;min-width:0}
      .ae-energy-summary>*{min-width:0}.ae-energy-summary .ae-reading{padding:2px 0;min-height:44px}
      .ae-energy-summary .ae-hero{justify-content:flex-start;gap:6px}
      .ae-energy-summary .ae-hero .ae-value{font-size:32px;font-weight:500;display:flex;align-items:baseline;gap:4px;flex-wrap:wrap;min-width:0}
      .ae-energy-summary .ae-hero .ae-value span{min-width:0;overflow-wrap:anywhere}
      .ae-energy-summary .ae-hero small{font-size:14px;color:var(--ae-muted)}
      .ae-energy-tariffs,.ae-energy-bills{border-inline-start:1px solid var(--ae-border);padding-inline-start:9px;color:var(--ae-muted)}
      .ae-energy-summary .ae-energy-secondary .ae-value{font-size:13px;font-weight:400;color:var(--ae-muted)}
      .ae-energy-tariffs>.ae-note{margin:0 0 3px}
      .ae-energy .ae-energy-tariffs .ae-reading{width:100%;min-height:24px;flex-direction:row;align-items:center;justify-content:space-between;gap:4px}
      .ae-energy-tariffs .ae-value{min-width:0;text-align:right}
      .ae-energy-bills{display:grid;gap:5px}
      .ae-energy .ae-grid .ae-device-reading{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:10px;align-content:center;align-items:center}
      .ae-device-reading>.ae-label{grid-column:1/-1}
      .ae-device-sparkline{height:18px;min-width:0;overflow:hidden;pointer-events:none}
      .ae-device-sparkline .ae-graph{height:18px;width:100%}
      @container(max-width:350px){.ae-energy-summary{gap:7px}.ae-energy-tariffs,.ae-energy-bills{padding-inline-start:6px}.ae-energy-summary .ae-hero .ae-value{font-size:28px}}
    `,
      ),
    );
  }
  static getStubConfig() {
    return {
      schema_version: 1,
      hours: 6,
      expected_min: 0,
      expected_max: 3500,
      circuits: [],
      show_untracked: false,
      same_cycle: false,
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-energy-card-editor");
  }
  historyEntities() {
    const c = this.config;
    return [
      ...new Set(
        [
          c?.power_entity,
          ...(c?.circuits || []).map((r) => r.power_entity),
          c?.untracked_entity,
        ].filter(Boolean),
      ),
    ];
  }
  deviceReading(name, value, entity, points, start, end) {
    const item = reading(name, value, entity, "ae-device-reading");
    const slot = el("div", undefined, "ae-device-sparkline");
    slot.setAttribute("aria-hidden", "true");
    if (!this.historyError)
      slot.append(
        graph([{ name, points }], {
          start,
          end,
          unit: "W",
          hass: this.hass,
          sparkline: true,
          min: this.config.expected_min ?? 0,
          max: this.config.expected_max ?? 3500,
        }),
      );
    item.append(slot);
    return item;
  }
  render() {
    const c = this.config;
    if (!c.power_entity)
      return note(
        "Choose total power and optional billing-cycle entities in the visual editor.",
      );
    const header = el("div", undefined, "ae-energy-header");
    header.append(el("h2", c.name || "Home energy"));
    const dates =
      c.billing_period_label ||
      (c.cycle_start_entity
        ? `${valueText(this.hass, c.cycle_start_entity)} – ${valueText(this.hass, c.cycle_end_entity)}`
        : "");
    if (dates) header.append(note(dates));
    const summary = el("div", undefined, "ae-energy-summary");
    const power = reading(
      "Current power",
      powerText(this.hass, c.power_entity),
      c.power_entity,
      "ae-hero",
    );
    const watts = unitValue(this.state(c.power_entity), "power");
    if (watts !== null)
      power
        .querySelector(".ae-value")
        .replaceChildren(
          el("span", powerNumber(this.hass, watts)),
          el("small", "W"),
        );
    summary.append(power);
    const widths = ["1.05fr"];
    const result = group(header, summary);
    result.classList.add("ae-energy");
    if (c.day_entity || c.night_entity || c.total_energy_entity) {
      const tariffs = el(
        "div",
        undefined,
        "ae-energy-tariffs ae-energy-secondary",
      );
      tariffs.setAttribute("role", "group");
      tariffs.setAttribute(
        "aria-label",
        "Billing-cycle energy in kilowatt-hours",
      );
      tariffs.append(note("Energy · kWh"));
      const total = c.total_energy_entity
        ? energyText(this.hass, c.total_energy_entity)
        : formatNumber(
            this.hass,
            cycleTotal(
              this.state(c.day_entity),
              this.state(c.night_entity),
              c.same_cycle,
            ),
          );
      if (c.day_entity)
        tariffs.append(
          reading("Day", energyText(this.hass, c.day_entity), c.day_entity),
        );
      if (c.night_entity)
        tariffs.append(
          reading(
            "Night",
            energyText(this.hass, c.night_entity),
            c.night_entity,
          ),
        );
      tariffs.append(reading("Total", total, c.total_energy_entity));
      summary.append(tariffs);
      widths.push("1.1fr");
      if (!c.same_cycle && !c.total_energy_entity)
        result.append(
          note(
            "Confirm matching day/night billing periods in the editor to calculate their total.",
          ),
        );
    }
    if (c.accrued_bill_entity || c.forecast_bill_entity) {
      const bills = el("div", undefined, "ae-energy-bills ae-energy-secondary");
      if (c.accrued_bill_entity)
        bills.append(
          reading(
            "Estimated bill",
            valueText(this.hass, c.accrued_bill_entity),
            c.accrued_bill_entity,
          ),
        );
      if (c.forecast_bill_entity)
        bills.append(
          reading(
            "Forecast",
            forecastStatus(c, this.hass?.states || {}) ||
              valueText(this.hass, c.forecast_bill_entity),
            c.forecast_bill_entity,
          ),
        );
      summary.append(bills);
      widths.push("1fr");
    }
    summary.style.gridTemplateColumns = widths.join(" ");
    result.append(
      this.historyView([{ entity: c.power_entity }], {
        axisLabels: true,
        axisGuides: true,
        formatAxis: (value, unit) => {
          const watts = unitValue(
            { state: String(value), attributes: { unit_of_measurement: unit } },
            "power",
          );
          return watts === null
            ? `${formatNumber(this.hass, value, 0)} ${unit}`.trim()
            : `${powerNumber(this.hass, watts)} W`;
        },
      }),
    );
    const circuits = (c.circuits || []).filter((r) => r.power_entity);
    const grid = el("div", undefined, "ae-grid");
    const end = Date.now(),
      start = end - (c.hours || 6) * 3600000;
    const history = (entity) => normalizeHistory(this.history?.[entity], "W");
    for (const r of circuits)
      grid.append(
        this.deviceReading(
          r.name || this.label(r.power_entity),
          powerText(this.hass, r.power_entity),
          r.power_entity,
          history(r.power_entity),
          start,
          end,
        ),
      );
    if (c.untracked_entity)
      grid.append(
        this.deviceReading(
          "Untracked",
          powerText(this.hass, c.untracked_entity),
          c.untracked_entity,
          history(c.untracked_entity),
          start,
          end,
        ),
      );
    else if (c.show_untracked) {
      const calc = c.non_overlapping
        ? untracked(
            this.state(c.power_entity),
            circuits.map((r) => this.state(r.power_entity)),
          )
        : {
            value: null,
            reason:
              "Confirm non-overlapping circuits in the editor before calculating untracked power.",
          };
      const item = this.deviceReading(
        "Untracked",
        `${formatNumber(this.hass, calc.value, 0)} W`,
        undefined,
        c.non_overlapping
          ? untrackedHistory(
              [c.power_entity, ...circuits.map((r) => r.power_entity)].map(
                (entity) => windowPoints(history(entity), start, end),
              ),
            )
          : [],
        start,
        end,
      );
      item.title = "Total power minus the configured device power sensors.";
      grid.append(item);
      if (calc.reason) result.append(note(calc.reason, "ae-warn"));
    }
    result.append(grid);
    return result;
  }
}
