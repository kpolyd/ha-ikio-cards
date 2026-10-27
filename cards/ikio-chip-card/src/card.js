import {
  ControlCard,
  el,
  note,
  chipStyles,
  sensorChip,
  updateChipIcons,
} from "@ikio/card-ui";
import { validate } from "./config.js";
export class Card extends ControlCard {
  validate = validate;
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
    return { schema_version: 1 };
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
      return note("Choose a sensor in the visual editor.");
    const content = el("div", undefined, "chip-only");
    content.append(sensorChip(this, this.config));
    return content;
  }
}
