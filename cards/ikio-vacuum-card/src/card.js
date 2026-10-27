import {
  ControlCard,
  available,
  button,
  details,
  el,
  event,
  features,
  glyph,
  group,
  note,
  select,
  stateLabel,
  stateText,
  t,
  updateChipIcons,
} from "@ikio/card-ui";
import { normalize, validate } from "./config.js";
import { primary } from "./adapter.js";
import { vacuumStyles } from "./styles.js";
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    this.shadowRoot.prepend(el("style", vacuumStyles));
  }
  setConfig(config) {
    const normalized = normalize(config);
    super.setConfig(
      normalized && typeof normalized === "object" && !Array.isArray(normalized)
        ? { ...normalized, appearance: { theme: "ha" } }
        : normalized,
    );
  }
  static getStubConfig() {
    return { schema_version: 1 };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-vacuum-card-editor");
  }
  onVisibility() {
    this.syncMotion();
  }
  onDisconnect() {
    this.syncMotion();
  }
  afterRender() {
    updateChipIcons(this);
    this.syncMotion();
  }
  syncMotion() {
    this.toggleAttribute(
      "vacuum-motion",
      this.isConnected &&
        this.visible &&
        !this.preview &&
        this.state()?.state === "cleaning",
    );
  }
  render() {
    const id = this.config.entity;
    if (!id) return note(t(this.hass, "Choose a vacuum in the visual editor."));
    const state = this.state(),
      attrs = state?.attributes || {},
      online = available(state);
    const result = group();
    result.classList.add("vacuum-card");
    result.dataset.state = state?.state || "unknown";
    const header = el("header", undefined, "vacuum-header", "header");
    const robot = el("span", undefined, "vacuum-robot");
    robot.setAttribute("aria-hidden", "true");
    const icon = el("ha-state-icon", undefined, "vacuum-disc");
    icon.dataset.chipEntity = id;
    const spark = glyph("mdi:creation");
    spark.classList.add("vacuum-spark");
    robot.append(icon, spark);
    const copy = el("div", undefined, "vacuum-heading");
    const name = button(this.label(id), () => details(this, id), {
      key: "name",
      entity: id,
    });
    name.className = "ae-title vacuum-name";
    const status = el("span", undefined, "vacuum-state");
    status.setAttribute("aria-live", "polite");
    status.textContent = !state
      ? stateText(this.hass, id)
      : state.state === "error"
        ? t(this.hass, "Needs attention")
        : this.hass?.formatEntityState?.(state) ||
          stateLabel(this.hass, state.state);
    copy.append(name, status);
    header.append(robot, copy);
    const battery = attrs.battery_level;
    if (
      typeof battery === "number" &&
      Number.isFinite(battery) &&
      battery >= 0 &&
      battery <= 100
    ) {
      const value = online
        ? new Intl.NumberFormat(
            this.hass?.locale?.language || this.hass?.language || "en",
            { style: "percent", maximumFractionDigits: 0 },
          ).format(battery / 100)
        : "—";
      const reading = el("span", undefined, "vacuum-battery");
      reading.setAttribute(
        "aria-label",
        t(this.hass, "Battery: {p0}", { p0: value }),
      );
      const batteryIcon = glyph("mdi:battery");
      batteryIcon.setAttribute("aria-hidden", "true");
      reading.append(batteryIcon, el("span", value));
      header.append(reading);
    }
    result.append(header);
    const controls = el("div", undefined, "vacuum-controls", "controls"),
      action = primary(state);
    if (action) {
      const control = button(
        t(this.hass, action.label),
        () =>
          this.send(id, "vacuum", action.service, {}, (next) =>
            action.service === "start"
              ? next?.state === "cleaning"
              : action.service === "pause"
                ? next?.state === "paused"
                : next?.state === "idle",
          ),
        {
          icon: action.icon,
          key: "primary",
          entity: id,
          disabled: this.blocked(id),
        },
      );
      control.classList.add("vacuum-primary");
      control.append(el("span", t(this.hass, action.label)));
      controls.append(control);
    }
    if (
      features(state, 16) &&
      !["docked", "returning"].includes(state?.state)
    ) {
      const dock = button(
        t(this.hass, "Return to dock"),
        () =>
          this.send(id, "vacuum", "return_to_base", {}, (next) =>
            ["returning", "docked"].includes(next?.state),
          ),
        {
          icon: "mdi:home-import-outline",
          key: "dock",
          entity: id,
          disabled: this.blocked(id),
        },
      );
      dock.classList.add("vacuum-dock");
      controls.append(dock);
    }
    if (
      features(state, 32) &&
      Array.isArray(attrs.fan_speed_list) &&
      attrs.fan_speed_list.length
    ) {
      const options = [...attrs.fan_speed_list];
      const focused = this.content.querySelector(".vacuum-suction select");
      if (
        focused &&
        this.shadowRoot.activeElement === focused &&
        focused.value &&
        !options.includes(focused.value)
      )
        options.unshift(focused.value);
      if (attrs.fan_speed != null && !options.includes(attrs.fan_speed))
        options.unshift(attrs.fan_speed);
      const suction = select(
        t(this.hass, "Suction"),
        options,
        attrs.fan_speed,
        (value) =>
          this.send(
            id,
            "vacuum",
            "set_fan_speed",
            { fan_speed: value },
            (next) => next?.attributes?.fan_speed === value,
          ),
        "suction",
      );
      suction.classList.add("vacuum-suction");
      const input = suction.querySelector("select");
      if (attrs.fan_speed == null) {
        const unknown = el("option", t(this.hass, "Unknown"));
        unknown.value = "";
        unknown.disabled = true;
        input.prepend(unknown);
        input.value = "";
      }
      input.disabled = this.blocked(id);
      event(input, "blur", (event) => {
        event.currentTarget.value = String(
          this.state()?.attributes?.fan_speed ?? "",
        );
      });
      controls.append(suction);
    }
    if (controls.childElementCount) result.append(controls);
    if (online && attrs.error) {
      const error = note(String(attrs.error), "vacuum-alert");
      error.setAttribute("role", "alert");
      result.append(error);
    }
    if (this.pending.size || this.requests.size)
      result.append(note(t(this.hass, "Updating device…")));
    return result;
  }
}
