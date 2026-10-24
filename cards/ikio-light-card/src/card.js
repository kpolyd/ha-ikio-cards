import {
  IkioCard,
  element,
  details,
  entityName,
  bindHold,
} from "@ikio/card-ui";
import { normalizeConfig } from "./config.js";
import { lightState, deviceLocation } from "./adapter.js";
const css = `.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:6px}.tile{min-width:0;border-radius:10px;background:var(--ae-well);overflow:hidden}.tile.on{background:var(--ae-active)}.toggle{width:100%;min-height:48px;padding:6px 8px;text-align:left;background:none;display:flex;gap:7px;align-items:center}.labels{min-width:0}.name{display:block;font-size:12px;overflow-wrap:anywhere}.location{display:block;font-size:12px;color:var(--ae-muted);margin-top:3px;overflow-wrap:anywhere}ha-icon{--mdc-icon-size:18px;flex-shrink:0}.tile[aria-busy=true]{outline:1px solid var(--ae-accent)}.details{background:var(--ae-well)}@container(max-width:280px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
export class IkioLightCard extends IkioCard {
  constructor() {
    super();
    this.shadowRoot.prepend(element("style", css));
    this.rows = [];
    this.cleanups = [];
  }
  static getStubConfig() {
    return { schema_version: 1, lights: [], appearance: { theme: "dark" } };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-light-card-editor");
  }
  setConfig(config) {
    const normalized = normalizeConfig(config);
    this.cancelActions();
    this.clearRows();
    this.config = normalized;
    this.entityIds = normalized.lights.map((row) => row.entity);
    this.setAttribute("appearance", normalized.appearance.theme);
    this.build();
    this.update();
  }
  connectedCallback() {
    super.connectedCallback();
    if (this.config && !this.rows.length) {
      this.build();
      this.update();
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clearRows();
  }
  clearRows() {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    this.rows = [];
  }
  build() {
    this.content.replaceChildren();
    if (!this.config.lights.length) {
      this.content.append(
        element(
          "p",
          "Choose lights in the visual editor to get started.",
          "empty",
        ),
      );
      return;
    }
    const header = element("header");
    this.heading = element("h2", this.config.name || "Lights");
    this.summary = element("span", "", "summary");
    header.append(this.heading, this.summary);
    this.content.append(header);
    const grid = element("div", undefined, "grid");
    this.content.append(grid);
    for (const row of this.config.lights) {
      const tile = element("div", undefined, "tile"),
        toggle = element("button", undefined, "toggle"),
        icon = element("ha-icon"),
        labels = element("span", undefined, "labels"),
        name = element("span", "", "name"),
        location = element("span", "", "location");
      toggle.type = "button";
      labels.append(name, location);
      toggle.append(icon, labels);
      const more = element("button", "Open entity details", "sr details");
      more.type = "button";
      more.addEventListener("click", () => details(this, row.entity));
      tile.append(toggle, more);
      grid.append(tile);
      this.rows.push({ row, tile, toggle, icon, name, location });
      const hold = bindHold(toggle, () => details(this, row.entity));
      this.cleanups.push(() => hold.destroy());
      toggle.addEventListener("click", () => this.toggle(row));
    }
  }
  toggle(row) {
    const target =
      this.hass?.states?.[row.entity]?.state === "on" ? "off" : "on";
    return this.act(
      row.entity,
      row.entity.split(".")[0],
      `turn_${target}`,
      {},
      (state) => state?.state === target,
    );
  }
  update() {
    if (!this.config) return;
    let on = 0,
      offline = 0;
    for (const ui of this.rows) {
      const state = this.hass?.states?.[ui.row.entity],
        model = lightState(state, ui.row, (s) =>
          this.hass?.formatEntityState?.(s),
        ),
        name = entityName(this.hass, state, ui.row.name) || ui.row.entity,
        location = deviceLocation(this.hass, ui.row.entity, ui.row.location);
      on += model.on ? 1 : 0;
      offline += model.available ? 0 : 1;
      ui.name.textContent = name;
      ui.location.textContent = location;
      ui.icon.setAttribute(
        "icon",
        ui.row.icon || state?.attributes?.icon || "mdi:lightbulb-outline",
      );
      ui.tile.classList.toggle("on", model.on);
      ui.tile.setAttribute(
        "aria-busy",
        String(this.pending.has(ui.row.entity)),
      );
      ui.toggle.disabled =
        this.preview || !model.available || this.pending.has(ui.row.entity);
      ui.toggle.setAttribute(
        "aria-label",
        `${model.on ? "Turn off" : "Turn on"} ${name} · ${location} · ${model.status}`,
      );
      ui.toggle.title = `${model.status}${this.pending.has(ui.row.entity) ? " · pending" : ""}`;
      ui.toggle.setAttribute("aria-pressed", String(model.on));
    }
    if (this.summary)
      this.summary.textContent = `${on} / ${this.rows.length} on${offline ? ` · ${offline} unavailable` : ""}`;
  }
}
