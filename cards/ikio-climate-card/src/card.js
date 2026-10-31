import { t, stateLabel } from "@ikio/card-ui/i18n";
import {
  ControlCard,
  el,
  event,
  group,
  title,
  reading,
  note,
  button,
  select,
  range,
  features,
  formatNumber,
  valueText,
  available,
  installRefinement,
  refine,
  disclosure,
  glyph,
  updateChipIcons,
} from "@ikio/card-ui";
import { validate, normalize } from "./config.js";
import { climateStyles } from "./styles.js";
const modes = {
  off: ["Off", "mdi:power"],
  cool: ["Cool", "mdi:snowflake"],
  heat: ["Heat", "mdi:weather-sunny"],
  heat_cool: ["Heat / cool", "mdi:sun-snowflake"],
  auto: ["Auto", "mdi:autorenew"],
  dry: ["Dry", "mdi:water-percent"],
  fan_only: ["Fan", "mdi:fan"],
};
const finite = (v) => typeof v === "number" && Number.isFinite(v);
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    installRefinement(this);
    this.shadowRoot.prepend(el("style", climateStyles));
    this.drafts = new Map();
  }
  setConfig(c) {
    super.setConfig(normalize(c));
  }
  onConfig() {
    this.active = "climate";
    this.targetBound = "target_temp_low";
    this.drafts?.clear();
  }
  onDisconnect() {
    this.drafts.clear();
  }
  onVisibility() {
    if (!this.visible) {
      this.drafts.clear();
    }
  }
  static getStubConfig() {
    return { schema_version: 1 };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-climate-card-editor");
  }
  controlSelect(id, label, options, value, domain, service, key) {
    const node = select(t(this.hass, label), options, value, (v) =>
      this.send(
        id,
        domain,
        service,
        { [key]: v },
        (s) => (key === "option" ? s?.state : s?.attributes?.[key]) === v,
      ),
    );
    node.querySelector("select").disabled = this.blocked(id);
    return node;
  }
  step(a) {
    const native =
      finite(a.target_temp_step) && a.target_temp_step > 0
        ? a.target_temp_step
        : 1;
    const requested = this.config.temperature_step;
    return finite(requested)
      ? Math.max(native, Math.ceil(requested / native - 1e-8) * native)
      : native;
  }
  dial(id, label, key, value, min, max, step, extra = {}, selectable = false) {
    if (![value, min, max].every(finite) || min >= max)
      return note(t(this.hass, "{p0} unavailable", { p0: label }));
    const draftKey = `${id}:${key}`;
    const shown = this.drafts.get(draftKey) ?? value;
    const snap = (v) =>
      Number(
        Math.max(
          min,
          Math.min(max, min + Math.round((v - min) / step) * step),
        ).toFixed(6),
      );
    const disabled = this.blocked(id) || this.state(id)?.state === "off";
    const commit = (v) => {
      this.drafts.delete(draftKey);
      return this.send(
        id,
        "climate",
        "set_temperature",
        { ...extra, [key]: snap(v) },
        (s) =>
          finite(s?.attributes?.[key]) &&
          Math.abs(s.attributes[key] - snap(v)) < 0.001,
      );
    };
    const wrap = el("div", undefined, "climate-dial-row", key);
    const less = button(
      t(this.hass, "Decrease {p0}", { p0: label.toLowerCase() }),
      () => commit(shown - step),
      { icon: "mdi:minus", disabled: disabled || shown <= min, entity: id },
    );
    const more = button(
      t(this.hass, "Increase {p0}", { p0: label.toLowerCase() }),
      () => commit(shown + step),
      { icon: "mdi:plus", disabled: disabled || shown >= max, entity: id },
    );
    const dial = el("div", undefined, "climate-dial");
    const caption = selectable
      ? button(
          label,
          () => {
            this.targetBound = key;
            this.update();
          },
          { disabled, entity: id },
        )
      : el("div");
    caption.className = "dial-caption";
    if (selectable) {
      caption.replaceChildren();
      caption.setAttribute("aria-pressed", String(this.targetBound === key));
      wrap.classList.toggle("dial-selected", this.targetBound === key);
    }
    const output = el(
      "output",
      formatNumber(this.hass, shown, 3),
      "dial-value",
    );
    output.append(
      el(
        "span",
        this.state(id)?.attributes?.temperature_unit ||
          this.hass?.config?.unit_system?.temperature ||
          "°C",
        "dial-unit",
      ),
    );
    caption.append(el("span", label, "ae-label"), output);
    const input = el("input", undefined, "dial-input");
    Object.assign(input, {
      type: "range",
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(shown),
      disabled,
    });
    input.setAttribute("aria-label", label);
    input.setAttribute(
      "aria-valuetext",
      `${shown} ${this.state(id)?.attributes?.temperature_unit || this.hass?.config?.unit_system?.temperature || "°C"}`,
    );
    event(input, "input", (e) => {
      this.drafts.set(draftKey, Number(e.currentTarget.value));
      this.update();
    });
    event(input, "change", (e) => commit(Number(e.currentTarget.value)));
    if (selectable)
      event(input, "focus", () => {
        if (this.targetBound !== key) {
          this.targetBound = key;
          this.update();
        }
      });
    dial.append(caption, input);
    wrap.append(less, dial, more);
    if (disabled) wrap.classList.add("dial-disabled");
    return wrap;
  }
  position(axis) {
    if (!this.config[`show_${axis}`]) return null;
    const id = this.config[`${axis}_position_entity`],
      s = this.state(id);
    if (!id) return null;
    const label = t(
      this.hass,
      axis === "horizontal" ? "Horizontal position" : "Vertical position",
    );
    if (!available(s))
      return note(t(this.hass, "{p0} unavailable", { p0: label }));
    if (id.startsWith("select.") && s.attributes?.options?.length)
      return this.controlSelect(
        id,
        label,
        s.attributes.options,
        s.state,
        "select",
        "select_option",
        "option",
      );
    if (id.startsWith("number.")) {
      const a = s.attributes || {},
        v = Number(s.state);
      if (![v, a.min, a.max].every(finite) || a.min >= a.max)
        return note(t(this.hass, "{p0} unavailable", { p0: label }));
      const node = range(label, v, a.min, a.max, a.step || 1, (value) =>
        this.send(
          id,
          "number",
          "set_value",
          { value },
          (state) => Number(state?.state) === value,
        ),
      );
      node.querySelector("input").disabled = this.blocked(id);
      return node;
    }
    return null;
  }
  afterRender() {
    updateChipIcons(this);
  }
  render() {
    const c = this.config,
      id = c.climate_entity,
      s = this.state(id),
      a = s?.attributes || {};
    const status = !id
      ? ""
      : !available(s)
        ? "Unavailable"
        : s.state === "off"
          ? "Off"
          : (a.hvac_action || modes[s.state]?.[0] || s.state).replaceAll(
              "_",
              " ",
            );
    const result = group(
      title(
        this,
        c.name || (id ? this.label(id) : t(this.hass, "Climate")),
        id,
        t(this.hass, stateLabel(this.hass, status)),
      ),
    );
    refine(result, "mdi:home-thermometer-outline");
    const nativeIcon = el("ha-state-icon");
    nativeIcon.dataset.chipEntity = id || "";
    nativeIcon.setAttribute("aria-hidden", "true");
    if (id) result.querySelector("header>ha-icon")?.replaceWith(nativeIcon);
    result.classList.add("climate-card");
    result.dataset.mode = s?.state || "off";
    if (!id) {
      result.append(
        note(t(this.hass, "Choose a climate entity in the visual editor.")),
      );
      return result;
    }
    if (available(s)) {
      const step = this.step(a);
      if (features(s, 2) && (s.state === "heat_cool" || !features(s, 1))) {
        const targets = el(
          "div",
          undefined,
          "climate-dual-targets",
          "dual-targets",
        );
        targets.append(
          this.dial(
            id,
            t(this.hass, "Lower target"),
            "target_temp_low",
            a.target_temp_low,
            a.min_temp,
            Math.min(a.max_temp, a.target_temp_high),
            step,
            { target_temp_high: a.target_temp_high },
            true,
          ),
          this.dial(
            id,
            t(this.hass, "Upper target"),
            "target_temp_high",
            a.target_temp_high,
            Math.max(a.min_temp, a.target_temp_low),
            a.max_temp,
            step,
            { target_temp_low: a.target_temp_low },
            true,
          ),
        );
        result.append(targets);
      } else if (features(s, 1))
        result.append(
          this.dial(
            id,
            t(this.hass, "Target"),
            "temperature",
            a.temperature,
            a.min_temp,
            a.max_temp,
            step,
          ),
        );
    }
    const readings = el("div", undefined, "climate-readings");
    const unit =
      this.state(id)?.attributes?.temperature_unit ||
      this.hass?.config?.unit_system?.temperature ||
      "°C";
    const add = (label, sensor, fallback, icon) => {
      if (!sensor && fallback === undefined) return;
      const node = reading(
        t(this.hass, label),
        sensor ? valueText(this.hass, sensor) : fallback,
        sensor,
      );
      node.querySelector(".ae-label").prepend(glyph(icon));
      readings.append(node);
    };
    add(
      t(this.hass, "Current"),
      c.temperature_entity,
      finite(a.current_temperature)
        ? `${a.current_temperature} ${unit}`
        : undefined,
      "mdi:thermometer",
    );
    add(
      t(this.hass, "Humidity"),
      c.humidity_entity,
      finite(a.current_humidity) ? `${a.current_humidity}%` : undefined,
      "mdi:water-percent",
    );
    add(t(this.hass, "Power"), c.power_entity, undefined, "mdi:lightning-bolt");
    if (readings.children.length) result.append(readings);
    if (!available(s)) {
      result.append(
        note(
          t(
            this.hass,
            "Device unavailable. Valid sensor readings remain visible.",
          ),
        ),
      );
      return result;
    }
    if (a.hvac_modes?.length) {
      const section = el("section", undefined, "climate-modes-section");
      const buttons = el("div", undefined, "climate-modes");
      buttons.setAttribute("role", "group");
      buttons.setAttribute("aria-label", t(this.hass, "HVAC mode"));
      const order = [
        ...Object.keys(modes),
        ...a.hvac_modes.filter((m) => !modes[m]),
      ];
      for (const mode of order.filter((m) => a.hvac_modes.includes(m))) {
        const label = modes[mode]?.[0] || mode.replaceAll("_", " ");
        const b = button(
          t(this.hass, label),
          () =>
            this.send(
              id,
              "climate",
              "set_hvac_mode",
              { hvac_mode: mode },
              (state) => state?.state === mode,
            ),
          { disabled: this.blocked(id), entity: id, key: mode },
        );
        b.prepend(glyph(modes[mode]?.[1] || "mdi:thermostat"));
        b.setAttribute("aria-pressed", String(s.state === mode));
        buttons.append(b);
      }
      section.append(buttons);
      result.append(section);
    }
    const settings = [];
    const quick = el(
      "div",
      undefined,
      "climate-quick-settings",
      "quick-settings",
    );
    for (const [flag, toggle, label, values, key, service] of [
      [8, "fan", "Fan", "fan_modes", "fan_mode", "set_fan_mode"],
      [
        16,
        "preset",
        "Preset",
        "preset_modes",
        "preset_mode",
        "set_preset_mode",
      ],
      [32, "swing", "Swing", "swing_modes", "swing_mode", "set_swing_mode"],
      [
        512,
        "swing",
        "Horizontal swing",
        "swing_horizontal_modes",
        "swing_horizontal_mode",
        "set_swing_horizontal_mode",
      ],
    ])
      if (c[`show_${toggle}`] && features(s, flag) && a[values]?.length) {
        const control = this.controlSelect(
          id,
          label,
          a[values],
          a[key],
          "climate",
          service,
          key,
        );
        if (toggle === "preset") settings.push(control);
        else {
          control.prepend(
            glyph(
              toggle === "fan"
                ? "mdi:fan"
                : flag === 512
                  ? "mdi:swap-horizontal"
                  : "mdi:swap-vertical",
            ),
          );
          quick.append(control);
        }
      }
    if (quick.children.length) result.append(quick);
    settings.push(this.position("horizontal"), this.position("vertical"));
    if (settings.some(Boolean)) {
      const settingsView = disclosure(
        this,
        "climate-settings",
        t(this.hass, "Device settings"),
        ...settings,
      );
      const chevron = glyph("mdi:chevron-down");
      chevron.classList.add("settings-chevron");
      settingsView.querySelector("summary").append(chevron);
      result.append(settingsView);
    }
    if (this.pending.size || this.requests.size)
      result.append(note(t(this.hass, "Updating device…")));
    return result;
  }
}
