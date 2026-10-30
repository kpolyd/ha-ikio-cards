import {
  ControlCard,
  el,
  event,
  details,
  note,
  t,
  language,
  formatNumber,
  translateError,
} from "@ikio/card-ui";
import { normalizeConfig } from "./config.js";
import { discoverBatteries, replacementSummary, isLow } from "./batteries.js";
import { batteryStyles } from "./styles.js";
function icon(name) {
  const node = el("ha-icon");
  node.setAttribute("icon", name);
  node.setAttribute("aria-hidden", "true");
  return node;
}
function age(hass, updated) {
  const timestamp = Date.parse(updated);
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  const [value, unit] =
    minutes >= 1440
      ? [Math.floor(minutes / 1440), "day"]
      : minutes >= 60
        ? [Math.floor(minutes / 60), "hour"]
        : [minutes, "minute"];
  return new Intl.RelativeTimeFormat(language(hass), {
    numeric: "always",
    style: "short",
  }).format(-value, unit);
}
export class Card extends ControlCard {
  constructor() {
    super();
    this.shadowRoot.append(el("style", batteryStyles));
    this.expanded = false;
  }
  static getStubConfig() {
    return {
      schema_version: 1,
      low_threshold: 25,
      collapse_threshold: 80,
      ignored_devices: [],
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-battery-card-editor");
  }
  setConfig(config) {
    try {
      super.setConfig(normalizeConfig(config));
    } catch (error) {
      throw new Error(translateError(this.hass, error.message));
    }
  }
  onConfig() {
    this.expanded = false;
    this.discover();
  }
  discover(hass = this.hass) {
    const result = discoverBatteries(hass, this.config);
    this.batteries = result.rows;
    this.entityIds = result.dependencies;
  }
  set hass(value) {
    const oldIds = this.entityIds?.join("|");
    this.discover(value);
    super.hass = value;
    // Also refresh removals and changes to discovery membership. Ordinary state
    // updates are handled by ControlCard using the discovered dependencies.
    if (oldIds !== this.entityIds.join("|")) {
      if (this.visible === false && this.observer) this.renderDirty = true;
      else this.update();
    }
  }
  get hass() {
    return super.hass;
  }
  set preview(value) {
    super.preview = value;
    this.onVisibility();
  }
  get preview() {
    return super.preview;
  }
  onVisibility() {
    clearInterval(this.ageTimer);
    if (this.isConnected && this.visible && !this.preview)
      this.ageTimer = setInterval(() => this.update(), 60000);
  }
  connectedCallback() {
    super.connectedCallback();
    this.onVisibility();
  }
  onDisconnect() {
    clearInterval(this.ageTimer);
  }
  afterRender() {
    for (const node of this.content.querySelectorAll("ha-state-icon")) {
      node.hass = this.hass;
      node.stateObj = this.hass?.states?.[node.dataset.batteryIcon];
    }
  }
  renderRow(row) {
    const button = el("button", undefined, "battery-row", row.id);
    button.type = "button";
    button.dataset.entity = row.id;
    event(button, "click", () => details(this, row.id));
    const glyph = el("ha-state-icon");
    glyph.dataset.batteryIcon = row.id;
    glyph.setAttribute("data-native", "");
    glyph.setAttribute("aria-hidden", "true");
    const copy = el("span", undefined, "battery-copy");
    const metadata = el("span", undefined, "battery-meta");
    const parts = [
      row.type
        ? el(
            "span",
            `${row.quantity && row.quantity !== 1 ? `${row.quantity} × ` : ""}${row.type}`,
            "battery-type",
          )
        : null,
      row.area ? el("span", row.area) : null,
      age(this.hass, row.updated)
        ? el("span", age(this.hass, row.updated))
        : null,
    ].filter(Boolean);
    parts.forEach((part, index) => {
      if (index) metadata.append(el("span", "·"));
      metadata.append(part);
    });
    copy.append(el("span", row.name, "battery-name"), metadata);
    const low = isLow(row, this.config.low_threshold);
    const level = el(
      "span",
      undefined,
      `battery-level${row.value === null ? " unknown" : low ? (row.value <= 15 ? " critical" : " low") : ""}`,
    );
    const text =
      row.value === null
        ? t(this.hass, "Unavailable")
        : row.binary
          ? t(this.hass, row.value === 0 ? "Low" : "Normal")
          : `${formatNumber(this.hass, row.value, 0)}%`;
    level.append(el("span", text, "battery-value"));
    if (row.value !== null && !row.binary) {
      const track = el("span", undefined, "battery-track"),
        fill = el("span", undefined, "battery-fill");
      track.style.display = fill.style.display = "block";
      track.setAttribute("aria-hidden", "true");
      fill.style.width = `${row.value}%`;
      track.append(fill);
      level.append(track);
    }
    button.append(glyph, copy, level);
    return button;
  }
  render() {
    const rows = this.batteries || [],
      root = el("div", undefined, "batteries");
    const header = el("header", undefined, "battery-header"),
      heading = el("div", undefined, "battery-heading");
    heading.append(
      el("h2", this.config.name || t(this.hass, "Batteries")),
      el(
        "span",
        t(this.hass, "{count} devices", { count: rows.length }),
        "battery-count",
      ),
    );
    header.append(icon("mdi:battery-medium"), heading);
    const low = rows.filter((row) => isLow(row, this.config.low_threshold));
    if (low.length) {
      const alert = el("span", undefined, "battery-low");
      alert.append(
        icon("mdi:alert-circle-outline"),
        el("span", t(this.hass, "{count} low", { count: low.length })),
      );
      header.append(alert);
      const summary = replacementSummary(rows, this.config.low_threshold);
      if (summary.types.length || summary.unknown) {
        const replace = el("div", undefined, "battery-replace");
        replace.append(
          icon("mdi:autorenew"),
          el("span", t(this.hass, "Replace")),
        );
        summary.types.forEach(([type, count], index) => {
          if (index) replace.append(el("span", "·"));
          replace.append(el("strong", `${count} × ${type}`));
        });
        if (summary.unknown) {
          if (summary.types.length) replace.append(el("span", "·"));
          replace.append(
            el(
              "span",
              t(this.hass, "{count} battery types unknown", {
                count: summary.unknown,
              }),
            ),
          );
        }
        header.append(replace);
      }
    }
    root.append(header);
    const list = el("div", undefined, "battery-list");
    const visible = rows.filter(
      (row) =>
        row.value === null || row.value <= this.config.collapse_threshold,
    );
    for (const row of this.expanded ? rows : visible)
      list.append(this.renderRow(row));
    root.append(list);
    if (!rows.length)
      root.append(
        note(t(this.hass, "No battery devices found."), "battery-empty"),
      );
    else if (!visible.length && !this.expanded)
      root.append(
        note(
          t(this.hass, "All batteries are above {threshold}%.", {
            threshold: this.config.collapse_threshold,
          }),
          "battery-empty",
        ),
      );
    if (rows.length > visible.length) {
      const expand = el("button", undefined, "battery-expand", "expand");
      expand.type = "button";
      expand.setAttribute("aria-expanded", String(this.expanded));
      expand.append(
        el(
          "span",
          this.expanded
            ? t(this.hass, "Show fewer")
            : t(this.hass, "Show all {count} devices", { count: rows.length }),
        ),
        icon(this.expanded ? "mdi:chevron-up" : "mdi:chevron-down"),
      );
      event(expand, "click", () => {
        this.expanded = !this.expanded;
        this.update();
      });
      root.append(expand);
    }
    return root;
  }
}
