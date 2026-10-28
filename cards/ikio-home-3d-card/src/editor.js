import {
  ensureEditorComponents,
  form,
  emitConfig,
  sameConfig,
} from "../../../packages/ikio-card-ui/src/editor.js";
import { element, t } from "@ikio/card-ui";
import { choice } from "@ikio/card-ui/schema-editor";
import { language } from "@ikio/card-ui/i18n";
import { fields, normalizeConfig } from "./config.js";
export class Editor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }
  setConfig(value) {
    const next = normalizeConfig(value);
    if (sameConfig(this.config, next)) return;
    this.config = next;
    this.render();
  }
  set hass(value) {
    const changed = language(this._hass) !== language(value);
    this._hass = value;
    if (changed) this.render();
    const control = this.shadowRoot.querySelector("ha-form");
    if (control) control.hass = value;
  }
  connectedCallback() {
    ensureEditorComponents()
      .then(() => {
        this.ready = true;
        if (this.isConnected) this.render();
      })
      .catch(() =>
        this.shadowRoot.replaceChildren(
          element(
            "p",
            t(
              this._hass,
              "Home Assistant editor helpers are unavailable. Reload the dashboard editor.",
            ),
          ),
        ),
      );
  }
  render() {
    if (!this.ready || !this.config) return;
    this.shadowRoot.replaceChildren(
      form(
        this._hass,
        this.config,
        fields.map(({ label, ...field }) => field),
        Object.fromEntries(fields.map((f) => [f.name, f.label])),
        (value) => {
          this.config = { ...this.config, ...value };
          emitConfig(this, structuredClone(this.config));
        },
      ),
      form(
        this._hass,
        this.config.appearance,
        [
          choice("theme", "Appearance", [
            { value: "dark", label: "Ikio dark" },
            { value: "light", label: "Ikio light" },
            { value: "ha", label: "Follow Home Assistant" },
          ]),
        ],
        { theme: "Appearance" },
        (value) => {
          this.config = {
            ...this.config,
            appearance: { ...this.config.appearance, ...value },
          };
          emitConfig(this, structuredClone(this.config));
        },
      ),
      element(
        "p",
        t(
          this._hass,
          "Provide all three JSON configuration file URLs. Home geometry and entity mappings remain in these files.",
        ),
      ),
    );
  }
}
customElements.define("ikio-home-3d-card-editor", Editor);
