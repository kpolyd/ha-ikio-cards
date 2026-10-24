import { HistoryCard } from "@ikio/graph";
import { group, title, reading, row, valueText, note } from "@ikio/card-ui";
import { validate } from "./config.js";
export class Card extends HistoryCard {
  validate = validate;
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
        this.config.name || "History",
        rows.length === 1 ? rows[0].entity : null,
      ),
      rows.length === 1
        ? reading(
            "",
            valueText(this.hass, rows[0].entity),
            rows[0].entity,
            "ae-hero",
          )
        : null,
      this.historyView(rows),
    );
    if (this.config.show_legend !== false) {
      const legend = row(
        ...rows.map((r, i) =>
          reading(
            `${i + 1}. ${r.name || this.label(r.entity)}`,
            valueText(this.hass, r.entity),
            r.entity,
          ),
        ),
      );
      result.append(legend);
    }
    return result;
  }
}
