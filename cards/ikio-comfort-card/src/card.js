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
  static getStubConfig() {
    return { schema_version: 1 };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-comfort-card-editor");
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
        c.name || "Room comfort",
        id,
        id ? stateText(this.hass, id) : undefined,
      ),
    );
    const readings = row(
      ...[
        ["temperature", "Room temperature"],
        ["humidity", "Room humidity"],
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
    if (devices.length > 1)
      result.append(
        row(
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
        ),
      );
    if (!available(s)) {
      result.append(
        note("Device unavailable. Valid room readings remain visible."),
      );
      return result;
    }
    if (domain === "climate") {
      if (a.hvac_action) result.append(note(`Activity: ${a.hvac_action}`));
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
        result.append(modes);
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
        if (lo) result.append(lo);
        if (hi) result.append(hi);
      } else if (features(s, 1)) {
        const target = this.target(
          id,
          "Target temperature",
          a.temperature,
          a.min_temp,
          a.max_temp,
          a.target_temp_step,
          "climate",
          "temperature",
        );
        if (target) result.append(target);
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
          result.append(
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
        result.append(
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
        result.append(
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
        result.append(
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
        result.append(
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
    const settings = row();
    for (const control of [...result.children])
      if (control.matches(".ae-select,.ae-button")) settings.append(control);
    if (settings.children.length) result.append(settings);
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
