import { t, translateError } from "@ikio/card-ui/i18n";
import {
  IkioCard,
  element,
  details,
  entityName,
  bindHold,
} from "@ikio/card-ui";
import { normalizeConfig } from "./config.js";
import {
  lightState,
  deviceLocation,
  groupLights,
  lightAppearance,
} from "./adapter.js";
const css = `
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}
.tile{min-width:0;border-radius:10px;background:var(--ae-well);overflow:hidden}
.tile.on{background:var(--ae-active)}
:host([appearance=ha]) .tile.on{background:color-mix(in srgb,var(--primary-color,#03a9f4) 10%,var(--ae-well))}
:host([appearance=ha]) .tile.on ha-state-icon{color:var(--primary-color,#03a9f4)}
.toggle{position:relative;width:100%;min-height:44px;padding:4px 4px;text-align:left;background:none;display:flex;gap:4px;align-items:center}
.labels{min-width:0;flex:1;padding-inline-end:12px}.name{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.location{display:block;font-size:12px;color:var(--ae-muted);margin-top:3px;overflow-wrap:anywhere}
.location[hidden]{display:none}ha-state-icon,ha-icon{--mdc-icon-size:14px;flex:0 0 14px}
.tile.unavailable ha-state-icon{color:var(--ae-muted)}.tile.unavailable .toggle{color:var(--ae-muted)}
.tile[aria-busy=true]{outline:1px solid var(--ae-accent)}.details{background:var(--ae-well)}
.packed-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.packed-row+.packed-row{border-top:1px solid var(--ae-border);margin-top:6px;padding-top:5px}
.area-group{min-width:0}.area-group+.area-group{border-inline-start:1px solid var(--ae-border);padding-inline-start:5px}
.area-heading{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:2px 6px;min-height:18px;margin-bottom:3px}
.area-heading h3{font-size:12px;font-weight:500;margin:0;overflow-wrap:anywhere;min-width:0}
.summary{display:flex;align-items:center;gap:4px;font-variant-numeric:tabular-nums}.summary ha-icon{color:var(--ae-temperature)}
.state-dot{position:absolute;inset-inline-end:7px;top:50%;transform:translateY(-50%);width:7px;height:7px;box-sizing:border-box;border-radius:50%;border:1px solid var(--ae-muted);background:transparent}
.tile.on .state-dot{background:var(--lamp-colour,var(--ae-temperature));border:0;box-shadow:0 0 0 1px color-mix(in srgb,var(--ae-text) 20%,transparent)}
.state-dot[hidden]{display:none}
.level{position:absolute;bottom:0;inset-inline-start:0;height:2px;background:var(--ae-temperature);pointer-events:none}.level[hidden]{display:none}
.area-grid{grid-template-columns:repeat(var(--area-columns),minmax(0,1fr))}
@container(max-width:239px){.layout:not(.grouped)>.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.packed-row{display:block}.area-group+.area-group{border-inline-start:0;padding-inline-start:0;margin-top:6px}.area-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

export class IkioLightsCard extends IkioCard {
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
    return document.createElement("ikio-lights-card-editor");
  }
  setConfig(config) {
    let normalized;
    try {
      normalized = normalizeConfig(config);
    } catch (error) {
      throw new Error(translateError(this.hass, error.message));
    }
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
          t(this.hass, "Choose lights in the visual editor to get started."),
          "empty",
        ),
      );
      return;
    }
    const header = element("header");
    this.heading = element("h2", this.config.name || t(this.hass, "Lights"));
    this.summary = element("span", "", "summary");
    const summaryIcon = element("ha-icon");
    summaryIcon.setAttribute("icon", "mdi:lightbulb-on-outline");
    summaryIcon.setAttribute("aria-hidden", "true");
    this.activeCount = element("span");
    this.summary.append(summaryIcon, this.activeCount);
    header.append(this.heading, this.summary);
    this.content.append(header);
    this.layout = element("div", undefined, "layout");
    this.content.append(this.layout);
    for (const row of this.config.lights) {
      const tile = element("div", undefined, "tile"),
        toggle = element("button", undefined, "toggle"),
        icon = element("ha-state-icon"),
        labels = element("span", undefined, "labels"),
        name = element("span", "", "name"),
        location = element("span", "", "location");
      toggle.type = "button";
      labels.append(name, location);
      const dot = element("span", undefined, "state-dot"),
        level = element("span", undefined, "level");
      dot.setAttribute("aria-hidden", "true");
      level.setAttribute("aria-hidden", "true");
      toggle.append(icon, labels, dot, level);
      const more = element(
        "button",
        t(this.hass, "Open entity details"),
        "sr details",
      );
      more.type = "button";
      more.addEventListener("click", () => details(this, row.entity));
      tile.append(toggle, more);

      this.rows.push({ row, tile, toggle, icon, name, location, dot, level });
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
            heading.append(element("h3", group.location));
            const grid = element("div", undefined, "grid area-grid");
            grid.style.setProperty("--area-columns", String(group.columns));
            const members = group.lights.map((light) =>
              nodes.get(light.entity),
            );
            for (const ui of members) grid.append(ui.tile);
            section.append(heading, grid);
            row.append(section);
            this.groups.push({ members });
          }
          fragment.append(row);
        }
      }
      this.layout.replaceChildren(fragment);
      this.layoutSignature = signature;
      if (focused?.isConnected) focused.focus({ preventScroll: true });
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
    if (this.heading)
      this.heading.textContent = this.config.name || t(this.hass, "Lights");
    if (!this.rows.length) {
      const empty = this.content.querySelector(".empty");
      if (empty)
        empty.textContent = t(
          this.hass,
          "Choose lights in the visual editor to get started.",
        );
    }
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
      model.status = t(this.hass, model.status);
      ui.model = model;
      ui.name.textContent = name;
      ui.tile.querySelector(".details").textContent = t(
        this.hass,
        "Open entity details",
      );
      ui.location.textContent = this.config.group_by_location
        ? model.available
          ? ""
          : model.status
        : location;
      ui.location.hidden = !!this.config.group_by_location && model.available;
      ui.tile.classList.toggle("unavailable", !model.available);
      ui.icon.hass = this.hass;
      ui.icon.stateObj = state;
      ui.icon.icon = ui.row.icon || undefined;
      const appearance = lightAppearance(state, ui.row);
      if (appearance.colour)
        ui.toggle.style.setProperty("--lamp-colour", appearance.colour);
      else ui.toggle.style.removeProperty("--lamp-colour");
      ui.dot.hidden = !model.on;
      ui.level.hidden = appearance.brightness === null;
      ui.level.style.width = `${appearance.brightness ?? 0}%`;
      ui.tile.classList.toggle("on", model.on);
      ui.tile.setAttribute(
        "aria-busy",
        String(this.pending.has(ui.row.entity)),
      );
      ui.toggle.disabled =
        this.preview || !model.available || this.pending.has(ui.row.entity);
      ui.toggle.setAttribute(
        "aria-label",
        `${t(this.hass, model.on ? "Turn off" : "Turn on")} ${name} · ${location} · ${model.status}`,
      );
      ui.toggle.title = `${name} · ${location} · ${model.status}${this.pending.has(ui.row.entity) ? t(this.hass, " · pending") : ""}`;
      ui.toggle.setAttribute("aria-pressed", String(model.on));
    }
    this.arrange();
    if (this.summary) {
      this.activeCount.textContent = String(on);
      const label = t(this.hass, "{p0} / {p1} on{p2}", {
        p0: on,
        p1: this.rows.length,
        p2: offline
          ? ` · ${t(this.hass, "{p0} unavailable", { p0: offline })}`
          : "",
      });
      this.summary.setAttribute("aria-label", label);
      this.summary.title = label;
    }
  }
}
