import { installRefinement, refine, disclosure, glyph } from "@ikio/card-ui";
import {
  ControlCard,
  group,
  row,
  title,
  reading,
  note,
  button,
  select,
  range,
  features,
  valueText,
  stateText,
  available,
} from "@ikio/card-ui";
import { validate } from "./config.js";
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    installRefinement(this);
  }
  static getStubConfig() {
    return { schema_version: 1 };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-climate-card-editor");
  }
  onConfig() {
    this.active = this.config.default_device;
  }
  controlSelect(id, label, options, value, domain, service, key) {
    const node = select(label, options, value, (v) =>
      this.send(
        id,
        domain,
        service,
        { [key]: v },
        (state) => state?.attributes?.[key] === v,
      ),
    );
    node.querySelector("select").disabled = this.blocked(id);
    return node;
  }
  target(
    id,
    label,
    value,
    min,
    max,
    step,
    domain,
    key,
    service = "set_temperature",
    extra = {},
  ) {
    if (
      !Number.isFinite(value) ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min >= max
    )
      return null;
    const control = range(label, value, min, max, step || 1, (v) =>
      this.send(
        id,
        domain,
        service,
        { ...extra, [key]: v },
        (state) => Math.abs((state?.attributes?.[key] ?? -999) - v) < 0.1,
      ),
    );
    control.querySelector("input").disabled = this.blocked(id);
    return control;
  }
  render() {
    const c = this.config,
      devices = ["climate", "humidifier", "fan"].filter(
        (k) => c[k + "_entity"],
      );
    if (!devices.includes(this.active)) this.active = devices[0];
    const id = c[this.active + "_entity"],
      s = this.state(id),
      a = s?.attributes || {},
      domain = this.active;
    const result = group(
      title(
        this,
        c.name || "Climate",
        id,
        id ? a.hvac_action || stateText(this.hass, id) : undefined,
      ),
    );
    refine(result, "mdi:home-thermometer-outline");
    const readings = row(
      ...[
        ["temperature", "Temperature"],
        ["humidity", "Humidity"],
        ["fridge", "Fridge"],
      ]
        .filter(([k]) => c[k + "_entity"])
        .map(([k, label]) =>
          reading(
            label,
            valueText(this.hass, c[k + "_entity"]),
            c[k + "_entity"],
            k === "temperature" ? "ae-hero" : "",
          ),
        ),
    );
    readings.classList.add("ikio-metrics");
    if (c.fridge_entity) {
      const fridge = [...readings.children].find(
        (node) => node.dataset.entity === c.fridge_entity,
      );
      if (fridge) {
        fridge.classList.add("ikio-fridge");
        fridge.querySelector(".ae-label").prepend(glyph("mdi:fridge-outline"));
      }
    }
    result.append(readings);
    if (!devices.length) {
      if (!readings.children.length)
        result.append(
          note(
            "Choose room sensors and/or comfort devices in the visual editor.",
          ),
        );
      return result;
    }
    if (devices.length > 1) {
      const tabs = row(
        ...devices.map((k) => {
          const b = button(
            k === "climate"
              ? "Air conditioner"
              : k === "humidifier"
                ? "Dehumidifier"
                : "Fan",
            () => {
              this.active = k;
              this.update();
            },
          );
          b.setAttribute("aria-pressed", String(k === domain));
          return b;
        }),
      );
      tabs.classList.add("ikio-device-tabs");
      tabs.setAttribute("role", "group");
      tabs.setAttribute("aria-label", "Climate device");
      result.append(tabs);
    }
    if (!available(s)) {
      result.append(
        note("Device unavailable. Valid room readings remain visible."),
      );
      return result;
    }
    const advanced = [];
    if (domain === "climate") {
      const mainControls = row();
      mainControls.classList.add("ikio-climate-controls");
      if (a.hvac_modes?.length) {
        const modes = select("HVAC mode", a.hvac_modes, s.state, (v) =>
          this.send(
            id,
            "climate",
            "set_hvac_mode",
            { hvac_mode: v },
            (state) => state?.state === v,
          ),
        );
        modes.querySelector("select").disabled = this.blocked(id);
        mainControls.append(modes);
      }
      if (features(s, 2) && s.state === "heat_cool") {
        const lo = this.target(
          id,
          "Lower target",
          a.target_temp_low,
          a.min_temp,
          Math.min(a.max_temp, a.target_temp_high),
          a.target_temp_step,
          "climate",
          "target_temp_low",
          "set_temperature",
          { target_temp_high: a.target_temp_high },
        );
        const hi = this.target(
          id,
          "Upper target",
          a.target_temp_high,
          Math.max(a.min_temp, a.target_temp_low),
          a.max_temp,
          a.target_temp_step,
          "climate",
          "target_temp_high",
          "set_temperature",
          { target_temp_low: a.target_temp_low },
        );
        if (lo) mainControls.append(lo);
        if (hi) mainControls.append(hi);
      } else if (features(s, 1)) {
        const target = this.target(
          id,
          "Target",
          a.temperature,
          a.min_temp,
          a.max_temp,
          a.target_temp_step,
          "climate",
          "temperature",
        );
        if (target) mainControls.append(target);
      }
      for (const [flag, label, values, key, service] of [
        [8, "Fan mode", "fan_modes", "fan_mode", "set_fan_mode"],
        [16, "Preset", "preset_modes", "preset_mode", "set_preset_mode"],
        [32, "Swing", "swing_modes", "swing_mode", "set_swing_mode"],
        [
          512,
          "Horizontal swing",
          "swing_horizontal_modes",
          "swing_horizontal_mode",
          "set_swing_horizontal_mode",
        ],
      ])
        if (features(s, flag) && a[values]?.length)
          advanced.push(
            this.controlSelect(
              id,
              label,
              a[values],
              a[key],
              "climate",
              service,
              key,
            ),
          );
      result.append(mainControls);
    } else if (domain === "humidifier") {
      result.append(
        button(
          s.state === "on" ? "Turn off" : "Turn on",
          () => this.toggle(id),
          { icon: "mdi:power", disabled: this.blocked(id) },
        ),
      );
      const target = this.target(
        id,
        "Target humidity",
        a.humidity,
        a.min_humidity ?? 0,
        a.max_humidity ?? 100,
        1,
        "humidifier",
        "humidity",
        "set_humidity",
      );
      if (target) result.append(target);
      if (features(s, 1) && a.available_modes?.length)
        advanced.push(
          this.controlSelect(
            id,
            "Mode",
            a.available_modes,
            a.mode,
            "humidifier",
            "set_mode",
            "mode",
          ),
        );
    } else {
      result.append(
        button(
          s.state === "on" ? "Turn off" : "Turn on",
          () => this.toggle(id),
          { icon: "mdi:power", disabled: this.blocked(id) },
        ),
      );
      if (features(s, 1)) {
        const speed = this.target(
          id,
          "Fan speed",
          a.percentage,
          0,
          100,
          a.percentage_step || 1,
          "fan",
          "percentage",
          "set_percentage",
        );
        if (speed) result.append(speed);
      }
      if (features(s, 8) && a.preset_modes?.length)
        advanced.push(
          this.controlSelect(
            id,
            "Preset",
            a.preset_modes,
            a.preset_mode,
            "fan",
            "set_preset_mode",
            "preset_mode",
          ),
        );
      if (features(s, 2))
        advanced.push(
          button(
            a.oscillating ? "Stop oscillation" : "Oscillate",
            () =>
              this.send(
                id,
                "fan",
                "oscillate",
                { oscillating: !a.oscillating },
                (state) => state?.attributes?.oscillating === !a.oscillating,
              ),
            { disabled: this.blocked(id) },
          ),
        );
      if (features(s, 4))
        advanced.push(
          this.controlSelect(
            id,
            "Direction",
            ["forward", "reverse"],
            a.direction,
            "fan",
            "set_direction",
            "direction",
          ),
        );
    }
    if (advanced.length)
      result.append(
        disclosure(this, "comfort-settings", "Device settings", ...advanced),
      );
    if (c[domain + "_power_entity"])
      result.append(
        reading(
          "Power",
          valueText(this.hass, c[domain + "_power_entity"]),
          c[domain + "_power_entity"],
        ),
      );
    return result;
  }
}
