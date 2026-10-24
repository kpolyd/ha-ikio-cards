import { HistoryCard } from "@ikio/graph";
import {
  group,
  title,
  row,
  reading,
  valueText,
  el,
  note,
  formatNumber,
  button,
} from "@ikio/card-ui";
import { validate } from "./config.js";
import { untracked, cycleTotal, forecastStatus } from "./adapter.js";
export class Card extends HistoryCard {
  validate = validate;
  constructor() {
    super();
    this.shadowRoot.prepend(
      el(
        "style",
        `
    .ae-energy{gap:3px}.ae-energy header{margin-bottom:0}.ae-energy .ae-title{min-height:44px}.ae-energy-heading{display:grid;grid-template-columns:minmax(0,1fr) max-content;align-items:center}.ae-energy-heading .ae-hero{text-align:right}
    .ae-energy-summary{display:grid;gap:2px}.ae-energy-summary .ae-reading{min-height:44px;padding:2px 4px;gap:1px}
    .ae-energy-summary .ae-hero{padding-top:0;padding-bottom:0}.ae-energy-summary .ae-hero .ae-value{font-size:24px}
    .ae-energy-summary .ae-row{display:grid;gap:4px}.ae-energy-summary .ae-note{margin:0 4px}
    .ae-energy-summary .ae-note:empty{display:none}
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
    return this.config?.power_entity ? [this.config.power_entity] : [];
  }
  render() {
    const c = this.config;
    if (!c.power_entity)
      return note(
        "Choose total power and optional billing-cycle entities in the visual editor.",
      );
    const heading = el("div", undefined, "ae-energy-heading");
    heading.append(
      title(this, c.name || "Home energy", c.power_entity),
      reading(
        "Current power",
        valueText(this.hass, c.power_entity),
        c.power_entity,
        "ae-hero",
      ),
    );
    const summary = el("div", undefined, "ae-energy-summary");
    summary.append(heading);
    const result = group(summary);
    result.classList.add("ae-energy");
    const dates =
      c.billing_period_label ||
      (c.cycle_start_entity
        ? `${valueText(this.hass, c.cycle_start_entity)} – ${valueText(this.hass, c.cycle_end_entity)}`
        : "");
    if (dates) summary.append(note(dates));
    if (c.day_entity || c.night_entity) {
      const total = c.total_energy_entity
        ? valueText(this.hass, c.total_energy_entity)
        : `${formatNumber(this.hass, cycleTotal(this.state(c.day_entity), this.state(c.night_entity), c.same_cycle))} kWh`;
      summary.append(
        row(
          reading("Day", valueText(this.hass, c.day_entity), c.day_entity),
          reading(
            "Night",
            valueText(this.hass, c.night_entity),
            c.night_entity,
          ),
          reading("Total", total, c.total_energy_entity),
        ),
      );
      if (!c.same_cycle && !c.total_energy_entity)
        summary.append(
          note(
            "Confirm matching day/night billing periods in the editor to calculate their total.",
          ),
        );
    }
    if (c.accrued_bill_entity || c.forecast_bill_entity)
      summary.append(
        row(
          c.accrued_bill_entity
            ? reading(
                "Estimated bill",
                valueText(this.hass, c.accrued_bill_entity),
                c.accrued_bill_entity,
              )
            : null,
          c.forecast_bill_entity
            ? reading(
                "Forecast",
                forecastStatus(c, this.hass?.states || {}) ||
                  valueText(this.hass, c.forecast_bill_entity),
                c.forecast_bill_entity,
              )
            : null,
        ),
      );
    for (const totals of summary.querySelectorAll(".ae-row"))
      totals.style.gridTemplateColumns = `repeat(${totals.children.length},minmax(0,1fr))`;
    result.append(
      this.historyView([{ entity: c.power_entity }], { axisLabels: true }),
    );
    const circuits = (c.circuits || []).filter((r) => r.power_entity),
      grid = el("div", undefined, "ae-grid");
    grid.append(
      ...circuits.map((r) =>
        reading(
          r.name || this.label(r.power_entity),
          valueText(this.hass, r.power_entity),
          r.power_entity,
        ),
      ),
    );
    result.append(grid);
    if (c.untracked_entity)
      result.append(
        reading(
          "Untracked",
          valueText(this.hass, c.untracked_entity),
          c.untracked_entity,
          "ae-separator",
        ),
      );
    else if (c.show_untracked) {
      if (!c.non_overlapping)
        result.append(
          note(
            "Confirm non-overlapping circuits in the editor before calculating untracked power.",
          ),
        );
      else {
        const calc = untracked(
          this.state(c.power_entity),
          circuits.map((r) => this.state(r.power_entity)),
        );
        const b = button(
          `Untracked · ${formatNumber(this.hass, calc.value)} W`,
          () =>
            this.dialog("Untracked power", [
              note("Total power minus the configured device power sensors."),
              ...circuits.map((r) =>
                note(
                  `${r.name || this.label(r.power_entity)}: ${valueText(this.hass, r.power_entity)}`,
                ),
              ),
              note(calc.reason || "Only the selected circuits are subtracted."),
            ]),
        );
        b.classList.add("ae-separator");
        result.append(b);
        if (calc.reason) result.append(note(calc.reason, "ae-warn"));
      }
    }
    return result;
  }
}
