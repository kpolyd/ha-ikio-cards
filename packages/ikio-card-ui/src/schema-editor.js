import { t, language } from "./i18n.js";
import { element } from "./card.js";
import {
  ensureEditorComponents,
  form,
  emitConfig,
  sameConfig,
} from "./editor.js";
export const entity = (name, label, domain, required = false) => ({
  name,
  label,
  required,
  selector: {
    entity: { filter: { domain: Array.isArray(domain) ? domain : [domain] } },
  },
});
export const number = (name, label, min, max, step = 1) => ({
  name,
  label,
  selector: { number: { min, max, step, mode: "box" } },
});
export const text = (name, label) => ({ name, label, selector: { text: {} } });
export const bool = (name, label) => ({
  name,
  label,
  selector: { boolean: {} },
});
export const choice = (name, label, options, multiple = false) => ({
  name,
  label,
  selector: {
    select: {
      options: options.map((o) =>
        typeof o === "string" ? { value: o, label: o } : o,
      ),
      multiple,
      mode: "dropdown",
    },
  },
});
export const baseFields = [text("name", "Card name (optional)")];
export function validateConfig(config, fields, lists = []) {
  if (!config || typeof config !== "object")
    throw Error("Choose entities using the visual editor.");
  if (config.schema_version && config.schema_version !== 1)
    throw Error("Unsupported configuration version");
  if (
    config.appearance?.theme &&
    !["dark", "light", "ha"].includes(config.appearance.theme)
  )
    throw Error("Unsupported appearance");
  function check(data, definitions) {
    for (const f of definitions) {
      const v = data[f.name];
      if (v === undefined || v === "") continue;
      const domains = f.selector?.entity?.filter?.domain;
      if (
        domains &&
        (!/^[a-z_]+\.[\w]+$/.test(v) || !domains.includes(v.split(".")[0]))
      )
        throw Error(`${f.label}: choose a compatible entity`);
      const n = f.selector?.number;
      if (
        n &&
        (typeof v !== "number" || !Number.isFinite(v) || v < n.min || v > n.max)
      )
        throw Error(`${f.label}: value outside permitted range`);
    }
  }
  check(config, fields);
  for (const l of lists) {
    if (config[l.name] !== undefined && !Array.isArray(config[l.name]))
      throw Error(`${l.label} must be a list`);
    for (const row of config[l.name] || []) check(row, l.fields);
  }
}
export function defineEditor(
  tag,
  fields,
  lists = [],
  normalizeConfig = (c) => c,
) {
  class Editor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }
    setConfig(config) {
      config = normalizeConfig(config);
      if (sameConfig(this.config, config)) return;
      this.config = structuredClone(config);
      this.render();
    }
    set hass(hass) {
      const changed = this._language !== language(hass);
      this._hass = hass;
      this._language = language(hass);
      this.setAttribute("lang", language(hass));
      if (changed) this.render();
      for (const f of this.shadowRoot.querySelectorAll("ha-form"))
        f.hass = hass;
    }
    connectedCallback() {
      ensureEditorComponents()
        .then(() => {
          this.ready = true;
          if (this.isConnected) this.render();
        })
        .catch((e) =>
          this.shadowRoot.replaceChildren(
            element("p", t(this._hass, e.message)),
          ),
        );
    }
    change(config) {
      this.config = config;
      emitConfig(this, structuredClone(config));
    }
    render() {
      if (!this.ready || !this.config) return;
      this.shadowRoot.replaceChildren(
        element(
          "style",
          ":host{display:block}section{border:1px solid var(--divider-color);border-radius:8px;margin:12px 0;padding:12px}button{min-height:44px;min-width:44px;margin:4px;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:8px}p{font-size:13px;color:var(--secondary-text-color)}",
        ),
      );
      const all = [...baseFields, ...fields];
      const schema = all.map(({ label, ...f }) => f);
      const labels = Object.fromEntries(all.map((f) => [f.name, f.label]));
      this.shadowRoot.append(
        form(this._hass, this.config, schema, labels, (value) =>
          this.change({ ...this.config, ...value }),
        ),
      );
      for (const list of lists) {
        const section = element("section");
        section.append(element("h3", t(this._hass, list.label)));
        if (list.helper)
          section.append(element("p", t(this._hass, list.helper)));
        (this.config[list.name] || []).forEach((data, index) => {
          const sub = element("section");
          sub.append(
            form(
              this._hass,
              data,
              list.fields.map(({ label, ...f }) => f),
              Object.fromEntries(list.fields.map((f) => [f.name, f.label])),
              (value) => {
                const rows = [...this.config[list.name]];
                rows[index] = { ...rows[index], ...value };
                this.change({ ...this.config, [list.name]: rows });
              },
            ),
          );
          for (const [label, delta] of [
            ["Up", -1],
            ["Down", 1],
            ["Remove", 0],
          ]) {
            const b = element("button", t(this._hass, label));
            b.type = "button";
            b.disabled =
              delta &&
              (index + delta < 0 ||
                index + delta >= this.config[list.name].length);
            b.onclick = () => {
              const rows = [...this.config[list.name]];
              if (delta)
                [rows[index], rows[index + delta]] = [
                  rows[index + delta],
                  rows[index],
                ];
              else rows.splice(index, 1);
              this.change({ ...this.config, [list.name]: rows });
              this.render();
            };
            sub.append(b);
          }
          section.append(sub);
        });
        const add = element(
          "button",
          t(this._hass, "Add {item}", {
            item: t(this._hass, list.item || "item"),
          }),
        );
        add.type = "button";
        add.onclick = () => {
          this.change({
            ...this.config,
            [list.name]: [...(this.config[list.name] || []), {}],
          });
          this.render();
        };
        section.append(add);
        this.shadowRoot.append(section);
      }
      this.shadowRoot.append(
        form(
          this._hass,
          { theme: "dark", ...this.config.appearance },
          [
            choice("theme", "Appearance", [
              { value: "dark", label: "Ikio dark" },
              { value: "light", label: "Ikio light" },
              { value: "ha", label: "Follow Home Assistant" },
            ]),
          ],
          { theme: "Appearance" },
          (value) =>
            this.change({
              ...this.config,
              appearance: { ...this.config.appearance, ...value },
            }),
        ),
      );
      this.shadowRoot.append(
        element(
          "p",
          t(
            this._hass,
            "Hold entity controls for native Home Assistant details. Optional fields may be left empty. All settings are available in this editor.",
          ),
        ),
      );
    }
  }
  if (!customElements.get(tag)) customElements.define(tag, Editor);
  return Editor;
}
