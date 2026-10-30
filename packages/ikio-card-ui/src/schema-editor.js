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
/** One declarative editor for every card. Definitions contain no DOM code. */
export function defineEditor(
  tag,
  fields,
  lists = [],
  normalizeConfig = (c) => c,
  options = {},
) {
  class Editor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.expanded = new Set();
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
      const previous = this.config;
      this.config = config;
      emitConfig(this, structuredClone(config));
      if (
        [...(options.sections || []), ...fields].some(
          (s) => s.visible && s.visible(previous) !== s.visible(config),
        )
      )
        this.render();
    }
    section(label, parent = this.shadowRoot) {
      const section = element("section");
      section.append(element("h3", t(this._hass, label)));
      parent.append(section);
      return section;
    }
    disclosure(label, key, parent, open = false) {
      const details = element("details");
      details.open = this.expanded.has(key) || open;
      const summary = element("summary", label);
      details.append(summary);
      details.addEventListener("toggle", () => {
        if (details.isConnected) {
          if (details.open) this.expanded.add(key);
          else this.expanded.delete(key);
        }
      });
      parent.append(details);
      return details;
    }
    controls(parent, definitions, data, changed) {
      // Each field owns only its own key. HA can echo stale snapshots while
      // another form/list is being edited; these must never overwrite siblings.
      for (const field of definitions) {
        if (field.visible && !field.visible(this.config)) continue;
        const { label, helper, visible, ...schema } = field;
        const wrap = element("div", undefined, "field");
        const caption = element("div", undefined, "field-label");
        caption.append(element("span", t(this._hass, label), "field-name"));
        const id = `field-${this._fieldId++}`;
        caption.id = id;
        if (field.required) {
          const marker = element("span", " *", "required");
          marker.setAttribute("aria-hidden", "true");
          caption.append(marker);
        }
        const control = form(
          this._hass,
          { ...data, [field.name]: data[field.name] ?? field.default },
          [schema],
          { [field.name]: label },
          (value) => {
            changed({ [field.name]: value[field.name] });
            error.hidden = !field.required || !empty(value[field.name]);
          },
        );
        // Native HA selectors retain their own visible and accessible labels,
        // keyboard behaviour, entity/icon pickers and required validity.
        control.computeLabel = () => t(this._hass, label);
        control.setAttribute("role", "group");
        control.setAttribute("aria-labelledby", id);
        const error = element(
          "p",
          t(this._hass, "This field is required."),
          "field-error",
        );
        error.id = `${id}-error`;
        error.setAttribute("role", "alert");
        error.hidden = !field.required || !empty(data[field.name]);
        control.setAttribute("aria-describedby", error.id);
        if (field.required) control.setAttribute("aria-required", "true");
        wrap.append(caption, control, error);
        if (helper) wrap.append(element("p", t(this._hass, helper)));
        parent.append(wrap);
      }
    }
    render() {
      if (!this.ready || !this.config) return;
      // Capture disclosure state synchronously, including before queued toggle events.
      for (const node of this.shadowRoot.querySelectorAll(
        "details[data-key]",
      )) {
        if (node.open) this.expanded.add(node.dataset.key);
        else this.expanded.delete(node.dataset.key);
      }
      this._fieldId = 0;
      this.shadowRoot.replaceChildren(
        element(
          "style",
          `
        :host{display:block;color:var(--primary-text-color);--ha-input-required-marker:"";--ha-textarea-required-marker:""}
        section{border:1px solid var(--divider-color,#888);border-radius:10px;margin:10px 0;padding:12px;min-width:0}
        h3{font-size:14px;font-weight:600;margin:0 0 12px}p{font-size:12px;color:var(--secondary-text-color);line-height:1.5;margin:6px 0}
        .field{position:relative;margin:10px 0;min-width:0}.field-label{position:absolute;right:8px;top:0;font-size:13px;z-index:1;pointer-events:none}.field-name{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.required,.field-error{color:var(--error-color,#db4437)}
        .field-error[hidden]{display:none}.legend{margin:0 0 8px}details{border-top:1px solid var(--divider-color,#888);margin-top:8px;padding-top:4px}
        summary{cursor:pointer;min-height:44px;align-content:center;font-size:13px;overflow-wrap:anywhere}
        button{min-height:44px;min-width:44px;margin:4px 4px 0 0;padding:0 12px;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color,#888);border-radius:8px;cursor:pointer}
        button:disabled{opacity:.45;cursor:default}button:focus-visible,summary:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
        .actions{display:flex;flex-wrap:wrap}.field-error{margin-top:4px}ha-form{display:block;min-width:0}
      `,
        ),
      );
      const legend = element("p", undefined, "legend");
      const star = element("span", "* ", "required");
      star.setAttribute("aria-hidden", "true");
      legend.append(
        star,
        document.createTextNode(t(this._hass, "Required field")),
      );
      this.shadowRoot.append(legend);
      const general = this.section("General");
      const generalFields = options.generalFields ?? baseFields;
      this.controls(general, generalFields, this.config, (value) =>
        this.change({ ...this.config, ...value }),
      );
      if (!generalFields.length)
        general.append(
          element("p", t(this._hass, "The name follows the selected entity.")),
        );
      const settings = this.section("Card settings");
      const groups = options.sections || [{ fields }];
      const defaults =
        typeof options.defaults === "function"
          ? options.defaults()
          : options.defaults;
      for (const group of groups) {
        if (group.visible && !group.visible(this.config)) continue;
        const parent = group.label
          ? this.disclosure(
              t(this._hass, group.label),
              `group:${group.label}`,
              settings,
            )
          : settings;
        if (group.label) parent.dataset.key = `group:${group.label}`;
        this.controls(
          parent,
          group.fields,
          { ...defaults, ...this.config },
          (value) => this.change({ ...this.config, ...value }),
        );
      }
      for (const list of lists) {
        const rows = this.config[list.name] || [];
        const key = `list:${list.name}`;
        const section = this.disclosure(
          `${t(this._hass, list.label)} (${rows.length})`,
          key,
          settings,
        );
        section.dataset.key = key;
        if (list.helper)
          section.append(element("p", t(this._hass, list.helper)));
        rows.forEach((original, index) => {
          const data =
            typeof original === "string" ? { entity: original } : original;
          const rowKey = `${key}:${index}`;
          const title =
            data.name ||
            data.label ||
            this._hass?.states?.[data.entity]?.attributes?.friendly_name ||
            data.entity ||
            t(this._hass, "Item {number}", { number: index + 1 });
          const row = this.disclosure(title, rowKey, section);
          row.dataset.key = rowKey;
          this.controls(row, list.fields, data, (value) => {
            const updated = [...this.config[list.name]];
            updated[index] = {
              ...(typeof updated[index] === "string"
                ? { entity: updated[index] }
                : updated[index]),
              ...value,
            };
            this.change({ ...this.config, [list.name]: updated });
            row.querySelector("summary").textContent =
              updated[index].name ||
              updated[index].label ||
              this._hass?.states?.[updated[index].entity]?.attributes
                ?.friendly_name ||
              updated[index].entity ||
              title;
          });
          const actions = element("div", undefined, "actions");
          for (const [label, delta] of [
            ["Move up", -1],
            ["Move down", 1],
            ["Remove", 0],
          ]) {
            const button = element("button", t(this._hass, label));
            button.type = "button";
            button.disabled =
              !!delta && (index + delta < 0 || index + delta >= rows.length);
            button.onclick = () => {
              const updated = [...this.config[list.name]];
              if (delta)
                [updated[index], updated[index + delta]] = [
                  updated[index + delta],
                  updated[index],
                ];
              else updated.splice(index, 1);
              this.change({ ...this.config, [list.name]: updated });
              this.render();
              const target = this.shadowRoot.querySelector(
                `[data-key="${key}:${Math.min(index + delta, updated.length - 1)}"]`,
              );
              if (target) {
                target.open = true;
                target.querySelector("summary").focus();
              } else
                this.shadowRoot
                  .querySelector(`[data-key="${key}"] > button`)
                  ?.focus();
            };
            actions.append(button);
          }
          row.append(actions);
          if (
            data.entity &&
            this._hass?.states &&
            !this._hass.states[data.entity]
          )
            row.append(
              element(
                "p",
                t(this._hass, "Entity not found. Select a replacement above."),
              ),
            );
        });
        const add = element(
          "button",
          t(this._hass, "Add {item}", {
            item: t(this._hass, list.item || "item"),
          }),
        );
        add.type = "button";
        add.onclick = () => {
          this.expanded.add(key);
          this.expanded.add(`${key}:${rows.length}`);
          section.open = true;
          this.change({
            ...this.config,
            [list.name]: [...(this.config[list.name] || []), {}],
          });
          this.render();
          const added = this.shadowRoot.querySelector(
            `[data-key="${key}:${rows.length}"]`,
          );
          added?.querySelector("summary")?.focus();
        };
        section.append(add);
      }
      const appearance = this.section("Appearance");
      // Keep this dedicated native form last for the collection-wide contract.
      appearance.append(
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
      if (options.helper)
        this.shadowRoot.append(element("p", t(this._hass, options.helper)));
    }
  }
  if (!customElements.get(tag)) customElements.define(tag, Editor);
  return Editor;
}
function empty(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && !value.trim()) ||
    (Array.isArray(value) && !value.length)
  );
}
