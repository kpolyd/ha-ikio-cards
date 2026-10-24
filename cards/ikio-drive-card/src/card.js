import {
  ControlCard,
  group,
  row,
  title,
  reading,
  note,
  valueText,
  button,
  el,
  details,
} from "@ikio/card-ui";
import { validate } from "./config.js";
import { aggregate, locksSummary, mapUrl, fuelPercent } from "./adapter.js";
export class Card extends ControlCard {
  validate = validate;
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
    const tracker = this.state(c.tracker_entity),
      result = group(
        title(this, c.name || "Car", c.tracker_entity || c.range_entity),
        row(
          ...[
            ["range", "Range"],
            ["fuel", "Fuel"],
            ["odometer", "Odometer"],
          ]
            .filter(([key]) => c[key + "_entity"])
            .map(([key, label]) =>
              reading(
                label,
                valueText(this.hass, c[key + "_entity"]),
                c[key + "_entity"],
                key === "range" ? "ae-hero" : "",
              ),
            ),
        ),
      );
    const pct = fuelPercent(this.state(c.fuel_entity), c.fuel_capacity);
    if (pct !== null) {
      const bar = el("progress", undefined, "ae-progress");
      bar.max = 100;
      bar.value = pct;
      bar.setAttribute("aria-label", `Fuel ${Math.round(pct)} percent`);
      result.append(bar);
    }
    result.append(
      row(
        ...["locks", "doors", "windows"].map((key) => {
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
          const members = (c[key] || []).map((item) => this.state(item.entity));
          const status =
            key === "locks"
              ? locksSummary(members, c.locks_active_state || "auto")
              : aggregate(members, active, secure);
          const label = status;
          const item = reading(
            key === "locks" ? "Locks" : key === "doors" ? "Doors" : "Windows",
            label,
            null,
            ["Open", "Unlocked", "Jammed"].includes(status) ? "ae-warn" : "",
          );
          const first = c[key]?.[0]?.entity;
          if (first) item.dataset.entity = first;
          return item;
        }),
      ),
    );
    const locationRow = row();
    result.append(locationRow);
    if (c.location_entity || c.tracker_entity)
      locationRow.append(
        reading(
          "Parking",
          valueText(this.hass, c.location_entity || c.tracker_entity),
          c.location_entity || c.tracker_entity,
        ),
      );
    const stamp = c.location_timestamp_entity
      ? Date.parse(this.state(c.location_timestamp_entity)?.state)
      : Date.parse(tracker?.last_updated);
    if (Number.isFinite(stamp))
      (locationRow.firstElementChild || locationRow).append(
        note(
          `Last known location · ${Math.max(0, Math.floor((Date.now() - stamp) / 60000))} min ago`,
        ),
      );
    else if (c.tracker_entity)
      (locationRow.firstElementChild || locationRow).append(
        note("Location update time unknown"),
      );
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
      locationRow.append(link);
    }
    return result;
  }
}
