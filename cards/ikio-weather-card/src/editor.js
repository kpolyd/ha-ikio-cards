import { defineEditor, baseFields } from "@ikio/card-ui/schema-editor";
import { form } from "../../../packages/ikio-card-ui/src/editor.js";
import { element, t } from "@ikio/card-ui";
import { fields, sections, normalizeConfig } from "./config.js";
const Base = defineEditor(
  "ikio-weather-base-editor",
  fields,
  [],
  normalizeConfig,
);
class Editor extends Base {
  render() {
    super.render();
    if (!this.ready || !this.config) return;
    const original = this.shadowRoot.querySelector("ha-form");
    if (!original) return;
    for (const section of [
      { label: "General", fields: baseFields },
      ...sections,
    ]) {
      const wrap = element("section");
      wrap.append(
        element("h3", t(this._hass, section.label)),
        form(
          this._hass,
          this.config,
          section.fields.map(({ label, ...field }) => field),
          Object.fromEntries(section.fields.map((f) => [f.name, f.label])),
          (value) => this.change({ ...this.config, ...value }),
        ),
      );
      original.before(wrap);
    }
    original.remove();
  }
}
customElements.define("ikio-weather-card-editor", Editor);
