import {
  el,
  ensureEditorComponents,
  form,
  emitConfig,
  sameConfig,
  language,
  t,
} from "@ikio/card-ui";
import { fields, normalize } from "./config.js";
// Deliberately omit the shared optional name/theme forms for this card.
class Editor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(config) {
    const next = normalize(config);
    if (sameConfig(this.config, next)) return;
    this.config = next;
    this.render();
  }
  set hass(value) {
    const changed = language(this._hass) !== language(value);
    this._hass = value;
    this.setAttribute("lang", language(value));
    if (changed) this.render();
    for (const node of this.shadowRoot.querySelectorAll("ha-form"))
      node.hass = value;
  }
  connectedCallback() {
    ensureEditorComponents()
      .then(() => {
        if (!this.isConnected) return;
        this.ready = true;
        this.render();
      })
      .catch((error) => {
        if (this.isConnected)
          this.shadowRoot.replaceChildren(
            el("p", t(this._hass, error.message)),
          );
      });
  }
  render() {
    if (!this.ready || !this.config) return;
    this.shadowRoot.replaceChildren(
      form(
        this._hass,
        structuredClone(this.config),
        fields.map(({ label, ...field }) => field),
        Object.fromEntries(fields.map((field) => [field.name, field.label])),
        (value) => {
          this.config = normalize({ ...this.config, entity: value.entity });
          emitConfig(this, structuredClone(this.config));
        },
      ),
    );
  }
}
if (!customElements.get("ikio-vacuum-card-editor"))
  customElements.define("ikio-vacuum-card-editor", Editor);
