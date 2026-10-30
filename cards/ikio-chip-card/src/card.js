import { t } from "@ikio/card-ui/i18n";
import {
  ControlCard,
  el,
  note,
  chipStyles,
  sensorChip,
  updateChipIcons,
} from "@ikio/card-ui";
import { normalizeConfig } from "./config.js";
export class Card extends ControlCard {
  setConfig(config) {
    super.setConfig(normalizeConfig(config));
  }
  constructor() {
    super();
    this.shadowRoot.append(
      el(
        "style",
        chipStyles +
          `ha-card{padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}.chip-only{display:flex;align-items:flex-start}`,
      ),
    );
  }
  static getStubConfig() {
    return { schema_version: 1, show_name: true };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-chip-card-editor");
  }
  getCardSize() {
    return 1;
  }
  getGridOptions() {
    return { columns: 3, rows: 1, min_columns: 2, min_rows: 1 };
  }
  afterRender() {
    updateChipIcons(this);
  }
  render() {
    if (!this.config.entity)
      return note(t(this.hass, "Choose an entity in the visual editor."));
    const content = el("div", undefined, "chip-only");
    content.append(sensorChip(this, this.config));
    return content;
  }
}
