import { t, language } from "@ikio/card-ui/i18n";
import {
  element,
  form,
  emitConfig,
  sameConfig,
  ensureEditorComponents,
  entityName,
} from "@ikio/card-ui";
const labels = {
  name: "Name (optional)",
  icon: "Icon (optional)",
  entity: "Light or switch",
  location: "Location (optional override)",
  theme: "Appearance",
  group_by_location: "Group by location",
};
const rowSchema = [
  {
    name: "entity",
    required: true,
    selector: { entity: { filter: { domain: ["light", "switch"] } } },
  },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "location", selector: { text: {} } },
];
export class IkioLightEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.ready = false;
    this.revision = 0;
  }
  setConfig(config) {
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
    for (const node of this.shadowRoot.querySelectorAll("ha-form"))
      node.hass = hass;
  }
  connectedCallback() {
    ensureEditorComponents()
      .then(() => {
        this.ready = true;
        if (this.isConnected) this.render();
      })
      .catch((error) => {
        if (this.isConnected)
          this.shadowRoot.replaceChildren(
            element("p", t(this._hass, error.message)),
          );
      });
  }
  changed(config) {
    this.config = config;
    emitConfig(this, structuredClone(config));
  }
  render() {
    if (!this.ready || !this.config) return;
    this.shadowRoot.replaceChildren(
      element(
        "style",
        `:host{display:block}section{border:1px solid var(--divider-color,#888);padding:12px;margin:12px 0;border-radius:8px}button{min-height:44px;min-width:44px;margin:4px;color:var(--primary-text-color);background:var(--secondary-background-color);border:1px solid var(--divider-color);border-radius:8px;cursor:pointer}.hint{color:var(--secondary-text-color);font-size:13px}`,
      ),
    );
    this.shadowRoot.append(
      form(
        this._hass,
        {
          name: this.config.name,
          group_by_location: this.config.group_by_location ?? false,
        },
        [
          { name: "name", selector: { text: {} } },
          { name: "group_by_location", selector: { boolean: {} } },
        ],
        labels,
        (value) => this.changed({ ...this.config, ...value }),
      ),
    );
    const rows = this.config.lights || [];
    rows.forEach((original, index) => {
      const row =
          typeof original === "string" ? { entity: original } : original,
        section = element("section");
      section.append(
        element(
          "h3",
          row.name ||
            entityName(this._hass, this._hass?.states?.[row.entity]) ||
            t(this._hass, "Light {p0}", { p0: index + 1 }),
        ),
      );
      section.append(
        form(this._hass, { ...row }, rowSchema, labels, (value) => {
          const lights = [...this.config.lights];
          lights[index] = { ...row, ...value };
          this.changed({ ...this.config, lights });
        }),
      );
      for (const [text, action, disabled] of [
        ["Move up", () => this.move(index, -1), index === 0],
        ["Move down", () => this.move(index, 1), index === rows.length - 1],
        [
          "Remove",
          () => {
            this.changed({
              ...this.config,
              lights: this.config.lights.filter((_, i) => i !== index),
            });
            this.render();
          },
          false,
        ],
      ]) {
        const button = element("button", t(this._hass, text));
        button.type = "button";
        button.disabled = disabled;
        button.addEventListener("click", action);
        section.append(button);
      }
      const state = this._hass?.states?.[row.entity];
      if (row.entity && !state)
        section.append(
          element(
            "p",
            t(this._hass, "Entity not found. Select a replacement above."),
            "hint",
          ),
        );
      this.shadowRoot.append(section);
    });
    const add = element("button", t(this._hass, "Add light or switch"));
    add.type = "button";
    add.addEventListener("click", () => {
      this.changed({
        ...this.config,
        lights: [...(this.config.lights || []), { entity: "" }],
      });
      this.render();
    });
    this.shadowRoot.append(add);
    this.shadowRoot.append(
      form(
        this._hass,
        { theme: "dark", ...this.config.appearance },
        [
          {
            name: "theme",
            selector: {
              select: {
                options: [
                  { value: "dark", label: "Ikio dark" },
                  { value: "light", label: "Ikio light" },
                  { value: "ha", label: "Follow Home Assistant" },
                ],
                mode: "dropdown",
              },
            },
          },
        ],
        labels,
        (value) =>
          this.changed({
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
          "Tap to toggle. Hold for native Home Assistant details, including brightness and colour. Location comes from the entity or device area; an optional location label overrides it.",
        ),
        "hint",
      ),
    );
  }
  move(index, delta) {
    const lights = [...this.config.lights];
    [lights[index], lights[index + delta]] = [
      lights[index + delta],
      lights[index],
    ];
    this.changed({ ...this.config, lights });
    this.render();
  }
}
if (!customElements.get("ikio-lights-card-editor"))
  customElements.define("ikio-lights-card-editor", IkioLightEditor);
