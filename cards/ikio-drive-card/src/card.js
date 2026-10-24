import {
  ControlCard,
  group,
  reading,
  note,
  valueText,
  el,
  numeric,
  formatNumber,
  available,
} from "@ikio/card-ui";
import { validate } from "./config.js";
import {
  aggregate,
  locksSummary,
  lockState,
  mapUrl,
  fuelPercent,
  statusPresentation,
} from "./adapter.js";
function icon(name) {
  const glyph = el("ha-icon");
  glyph.setAttribute("icon", name);
  glyph.setAttribute("aria-hidden", "true");
  return glyph;
}
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    this.shadowRoot.prepend(
      el(
        "style",
        `
      .ae-drive{gap:6px;--drive-secure:#91b7a6}
      :host([appearance=light]) .ae-drive{--drive-secure:#346b53}
      :host([appearance=ha]) .ae-drive{--drive-secure:var(--success-color,var(--primary-color))}
      .ae-drive-header{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
      .ae-drive-header h2{display:flex;align-items:center;gap:7px;font-size:14px;margin:0;min-width:0;overflow-wrap:anywhere}
      .ae-drive-header h2 ha-icon{--mdc-icon-size:18px;flex:0 0 18px}
      .ae-drive .ae-drive-parking{flex-direction:row;gap:4px;justify-content:flex-end;max-width:48%;padding:0;min-width:0}
      .ae-drive-parking .ae-value{display:flex;align-items:center;gap:4px;font-size:12px;font-weight:400;color:var(--ae-muted);min-width:0}
      .ae-drive-parking ha-icon{--mdc-icon-size:13px;flex:0 0 13px}
      .ae-drive-metrics,.ae-drive-statuses{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;min-width:0}
      .ae-drive .ae-drive-metrics .ae-reading,.ae-drive .ae-drive-statuses .ae-reading{padding:2px 0;min-width:0;min-height:44px;width:100%}
      .ae-drive .ae-drive-metrics .ae-label{display:flex;align-items:center;gap:5px;min-width:0}
      .ae-drive-metrics .ae-label ha-icon{--mdc-icon-size:14px;flex:0 0 14px}
      .ae-drive .ae-drive-metrics .ae-value{display:flex;align-items:baseline;gap:2px;flex-wrap:wrap;font-size:19px;font-weight:500;min-width:0}
      .ae-drive-metrics .ae-value span{min-width:0;overflow-wrap:anywhere}
      .ae-drive-metrics small{font-size:12px;font-weight:400;color:var(--ae-muted)}
      .ae-drive-statuses{border-top:1px solid var(--ae-border);padding-top:7px}
      .ae-drive .ae-drive-statuses .ae-value{display:flex;align-items:center;gap:5px;font-size:13px;font-weight:500;min-width:0}
      .ae-drive-statuses .ae-value span{min-width:0;overflow-wrap:anywhere}
      .ae-drive-statuses ha-icon{--mdc-icon-size:16px;flex:0 0 16px}
      .ae-drive .drive-secure .ae-value{color:var(--drive-secure)}
      .ae-drive .drive-warning .ae-value{color:var(--ae-warning)}
      .ae-drive .drive-error .ae-value{color:var(--ae-error)}
      .ae-drive .drive-neutral .ae-value{color:var(--ae-muted)}
      .ae-drive .drive-pending .ae-value{color:var(--ae-accent)}
      .ae-drive-footer{display:flex;justify-content:space-between;align-items:center;gap:4px 8px;flex-wrap:wrap;min-width:0}
      .ae-drive-footer .ae-note{margin:0;font-size:12px}
      .ae-drive-footer .ae-location-link{font-size:12px;padding:2px 0;overflow-wrap:anywhere}
      @container(max-width:350px){.ae-drive-metrics,.ae-drive-statuses{gap:6px}.ae-drive .ae-drive-metrics .ae-value{font-size:16px}}
    `,
      ),
    );
  }
  static getStubConfig() {
    return {
      schema_version: 1,
      locks: [],
      doors: [],
      windows: [],
      locks_active_state: "auto",
      doors_active_state: "on",
      windows_active_state: "on",
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-drive-card-editor");
  }
  onVisibility() {
    clearInterval(this.clock);
    if (this.isConnected && this.visible)
      this.clock = setInterval(() => this.update(), 60000);
  }
  onDisconnect() {
    clearInterval(this.clock);
  }
  render() {
    const c = this.config;
    if (!this.entityIds.length)
      return note("Choose car sensors and location in the visual editor.");
    const tracker = this.state(c.tracker_entity);
    const result = group();
    result.classList.add("ae-drive");
    const header = el("div", undefined, "ae-drive-header");
    const heading = el("h2");
    heading.append(icon("mdi:car"), el("span", c.name || "Car"));
    header.append(heading);
    const parkingId = c.location_entity || c.tracker_entity;
    if (parkingId) {
      let location = valueText(this.hass, parkingId);
      if (parkingId === c.tracker_entity && location === "home")
        location = "Home";
      if (parkingId === c.tracker_entity && location === "not_home")
        location = "Away";
      const parking = reading(
        "Parking",
        location,
        parkingId,
        "ae-drive-parking",
      );
      parking.querySelector(".ae-label").classList.add("sr");
      parking
        .querySelector(".ae-value")
        .replaceChildren(icon("mdi:map-marker"), el("span", location));
      header.append(parking);
    }
    result.append(header);
    const metrics = el("div", undefined, "ae-drive-metrics");
    for (const [key, label, glyph] of [
      ["range", "Range", "mdi:map-marker-distance"],
      ["fuel", "Fuel", "mdi:gas-station"],
      ["odometer", "Odometer", "mdi:counter"],
    ]) {
      const id = c[key + "_entity"];
      if (!id) continue;
      const item = reading(label, valueText(this.hass, id), id);
      item.querySelector(".ae-label").prepend(icon(glyph));
      const state = this.state(id);
      const percent =
        key === "fuel" ? fuelPercent(state, c.fuel_capacity) : null;
      const value = percent ?? numeric(state);
      if (value !== null)
        item
          .querySelector(".ae-value")
          .replaceChildren(
            el("span", formatNumber(this.hass, value)),
            el(
              "small",
              percent !== null
                ? "%"
                : state.attributes?.unit_of_measurement || "",
            ),
          );
      metrics.append(item);
    }
    if (metrics.children.length) {
      metrics.style.gridTemplateColumns = `repeat(${metrics.children.length},minmax(0,1fr))`;
      result.append(metrics);
    }
    const statuses = el("div", undefined, "ae-drive-statuses");
    for (const key of ["locks", "doors", "windows"]) {
      const active =
        c[key + "_active_state"] || (key === "locks" ? "unlocked" : "on");
      const secure =
        active === "on"
          ? "off"
          : active === "off"
            ? "on"
            : active === "open"
              ? "closed"
              : "locked";
      const entries = c[key] || [],
        members = entries.map((item) => this.state(item.entity));
      const status =
        key === "locks"
          ? locksSummary(members, c.locks_active_state || "auto")
          : aggregate(members, active, secure);
      const presentation = statusPresentation(key, status);
      // Open/unlocked/unknown summaries should open the member explaining that status.
      const representative =
        entries.find((item) => {
          const state = this.state(item.entity);
          if (key === "locks")
            return lockState(state, c.locks_active_state || "auto") === status;
          return status === "Open"
            ? available(state) && state.state === active
            : status === "Unknown"
              ? !available(state) || state.state !== secure
              : true;
        })?.entity || entries[0]?.entity;
      const item = reading(
        key === "locks" ? "Locks" : key === "doors" ? "Doors" : "Windows",
        status,
        representative,
        `drive-${presentation.tone}`,
      );
      item.dataset.key = `status-${key}`;
      item.dataset.status = status;
      item
        .querySelector(".ae-value")
        .replaceChildren(icon(presentation.icon), el("span", status));
      statuses.append(item);
    }
    result.append(statuses);
    const footer = el("div", undefined, "ae-drive-footer");
    const stamp = c.location_timestamp_entity
      ? Date.parse(this.state(c.location_timestamp_entity)?.state)
      : Date.parse(tracker?.last_updated);
    if (Number.isFinite(stamp))
      footer.append(
        note(
          `Location · ${Math.max(0, Math.floor((Date.now() - stamp) / 60000))} min ago`,
        ),
      );
    else if (parkingId || c.location_timestamp_entity)
      footer.append(note("Location update time unknown"));
    const url = mapUrl(tracker);
    if (c.tracker_entity) {
      const link = el("a", "Open location in maps", "ae-location-link", "maps");
      link.title = "Open location in Google Maps";
      link.setAttribute("aria-label", "Open location in Google Maps");
      if (url) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else {
        link.setAttribute("aria-disabled", "true");
        link.textContent = "Location coordinates unavailable";
      }
      footer.append(link);
    }
    if (footer.children.length) result.append(footer);
    return result;
  }
}
