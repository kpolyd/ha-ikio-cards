import { installRefinement, refine } from "@ikio/card-ui";
import { HistoryCard } from "@ikio/graph";
import { group, title, reading, row, valueText, note, el } from "@ikio/card-ui";
import { validate } from "./config.js";
export class Card extends HistoryCard {
  validate = validate;
  constructor() {
    super();
    installRefinement(this);
  }
  static getStubConfig() {
    return {
      schema_version: 1,
      entities: [],
      hours: 6,
      expected_min: 0,
      expected_max: 3500,
      show_legend: true,
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-graph-card-editor");
  }
  historyEntities() {
    return (this.config?.entities || []).map((r) => r.entity).filter(Boolean);
  }
  render() {
    const rows = (this.config.entities || []).filter((r) => r.entity);
    if (!rows.length)
      return note("Choose numeric entities in the visual editor.");
    const result = group(
      title(
        this,
        this.config.name || "Graph",
        rows.length === 1 ? rows[0].entity : null,
      ),
      rows.length === 1
        ? reading(
            rows[0].name || this.label(rows[0].entity),
            valueText(this.hass, rows[0].entity),
            rows[0].entity,
            "ae-hero",
          )
        : null,
      this.historyView(rows),
    );
    refine(result, "mdi:chart-line");
    if (this.config.show_legend !== false && rows.length > 1) {
      const legend = el("div", undefined, "ikio-legend");
      rows.forEach((r, i) => {
        const entry = el("div", undefined, "ikio-legend-entry");
        const sample = el(
          "span",
          undefined,
          `ikio-line-sample ${i ? (i % 2 ? "dashed" : "dotted") : ""}`,
        );
        sample.setAttribute("aria-hidden", "true");
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
