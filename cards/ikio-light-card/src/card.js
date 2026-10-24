import {
  IkioCard,
  element,
  details,
  entityName,
  bindHold,
} from "@ikio/card-ui";
import { normalizeConfig } from "./config.js";
import { lightState, deviceLocation, groupLights } from "./adapter.js";
const css = `
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
.tile{min-width:0;border-radius:10px;background:var(--ae-well);overflow:hidden}
.tile.on{background:var(--ae-active)}
.toggle{width:100%;min-height:44px;padding:4px 4px;text-align:left;background:none;display:flex;gap:4px;align-items:center}
.labels{min-width:0}.name{display:block;font-size:12px;overflow-wrap:anywhere}
.location{display:block;font-size:12px;color:var(--ae-muted);margin-top:3px;overflow-wrap:anywhere}
.location[hidden]{display:none}ha-icon{--mdc-icon-size:14px;flex:0 0 14px}
.tile.unavailable ha-icon{display:none}.tile.unavailable .toggle{color:var(--ae-muted)}
.tile[aria-busy=true]{outline:1px solid var(--ae-accent)}.details{background:var(--ae-well)}
.packed-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.packed-row+.packed-row{border-top:1px solid var(--ae-border);margin-top:6px;padding-top:5px}
.area-group{min-width:0}.area-group+.area-group{border-inline-start:1px solid var(--ae-border);padding-inline-start:5px}
.area-heading{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:2px 6px;min-height:18px;margin-bottom:3px}
.area-heading h3{font-size:12px;font-weight:500;margin:0;overflow-wrap:anywhere;min-width:0}
.area-count{font-size:12px;color:var(--ae-muted);font-variant-numeric:tabular-nums}
.area-grid{grid-template-columns:repeat(var(--area-columns),minmax(0,1fr))}
@container(max-width:239px){.layout:not(.grouped)>.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.packed-row{display:block}.area-group+.area-group{border-inline-start:0;padding-inline-start:0;margin-top:6px}.area-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

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
    if (this.config && !this.rows.length) this.build();
    super.connectedCallback();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.clearRows();
  }
  clearRows() {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];
    this.rows = [];
    this.layoutSignature = undefined;
    this.groups = [];
  }
  build() {
    this.content.replaceChildren();
    this.summary = undefined;
    this.layout = undefined;
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
    this.layout = element("div", undefined, "layout");
    this.content.append(this.layout);
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

      this.rows.push({ row, tile, toggle, icon, name, location });
      const hold = bindHold(toggle, () => details(this, row.entity));
      this.cleanups.push(() => hold.destroy());
      toggle.addEventListener("click", () => this.toggle(row));
    }
  }
  arrange() {
    if (!this.layout || this.rows.length !== this.config.lights.length) return;
    const packed = this.config.group_by_location
      ? groupLights(this.config.lights, this.hass)
      : null;
    const signature = packed
      ? JSON.stringify(
          packed.map((groups) =>
            groups.map((g) => [g.location, ...g.lights.map((l) => l.entity)]),
          ),
        )
      : "flat";
    if (signature !== this.layoutSignature) {
      const focused = this.shadowRoot.activeElement;
      const nodes = new Map(this.rows.map((ui) => [ui.row.entity, ui]));
      const fragment = document.createDocumentFragment();
      this.groups = [];
      this.layout.classList.toggle("grouped", !!packed);
      if (!packed) {
        const grid = element("div", undefined, "grid");
        for (const ui of this.rows) grid.append(ui.tile);
        fragment.append(grid);
      } else {
        for (const groups of packed) {
          const row = element("div", undefined, "packed-row");
          for (const group of groups) {
            const section = element("section", undefined, "area-group");
            section.style.gridColumn = `span ${group.columns}`;
            section.setAttribute("aria-label", group.location);
            const heading = element("div", undefined, "area-heading");
            const count = element("span", "", "area-count");
            count.hidden = group.lights.length === 1;
            heading.append(element("h3", group.location), count);
            const grid = element("div", undefined, "grid area-grid");
            grid.style.setProperty("--area-columns", String(group.columns));
            const members = group.lights.map((light) =>
              nodes.get(light.entity),
            );
            for (const ui of members) grid.append(ui.tile);
            section.append(heading, grid);
            row.append(section);
            this.groups.push({ count, members });
          }
          fragment.append(row);
        }
      }
      this.layout.replaceChildren(fragment);
      this.layoutSignature = signature;
      if (focused?.isConnected) focused.focus({ preventScroll: true });
    }
    for (const group of this.groups) {
      const active = group.members.filter((ui) => ui.model?.on).length;
      const offline = group.members.filter((ui) => !ui.model?.available).length;
      group.count.textContent = `${active}/${group.members.length} on`;
      group.count.title = offline ? `${offline} unavailable` : "";
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
      ui.model = model;
      ui.name.textContent = name;
      ui.location.textContent = this.config.group_by_location
        ? model.available
          ? ""
          : model.status
        : location;
      ui.location.hidden = !!this.config.group_by_location && model.available;
      ui.tile.classList.toggle("unavailable", !model.available);
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
    this.arrange();
    if (this.summary)
      this.summary.textContent = `${on} / ${this.rows.length} on${offline ? ` · ${offline} unavailable` : ""}`;
  }
}
