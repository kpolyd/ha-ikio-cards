import { defineEditor, baseFields } from "@ikio/card-ui/schema-editor";
import { form } from "../../../packages/ikio-card-ui/src/editor.js";
import { el, t } from "@ikio/card-ui";
import { fields, lists, sections, defaults, gaugeDefaults } from "./config.js";
const Base = defineEditor("ikio-router-base-editor", fields, lists);
class Editor extends Base {
  change(config) {
    const changed = config.connection_type !== this.config.connection_type;
    super.change(config);
    if (changed) this.render();
  }
  render() {
    super.render();
    if (!this.ready || !this.config) return;
    const original = this.shadowRoot.querySelector("ha-form");
    if (!original) return;
    const groups = [
      { label: "General", fields: baseFields },
      ...sections,
    ].filter((s) => !s.cellular || this.config.connection_type === "cellular");
    const values = { ...defaults };
    for (const [metric, d] of Object.entries(gaugeDefaults))
      for (const [key, v] of Object.entries(d)) values[metric + "_" + key] = v;
    for (const section of groups) {
      const wrap = el("section");
      wrap.append(
        el("h3", t(this._hass, section.label)),
        form(
          this._hass,
          { ...values, ...this.config },
          section.fields.map(({ label, ...f }) => f),
          Object.fromEntries(section.fields.map((f) => [f.name, f.label])),
          (value) => this.change({ ...this.config, ...value }),
        ),
      );
      original.before(wrap);
    }
    original.remove();
    const appearance = [...this.shadowRoot.children].find(
      (n) => n.tagName === "HA-FORM",
    );
    if (appearance?.schema?.some((f) => f.name === "theme"))
      appearance.data = { theme: "dark", ...this.config.appearance };
  }
}
customElements.define("ikio-router-card-editor", Editor);
