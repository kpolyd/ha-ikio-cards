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
  unitValue,
  available,
  installRefinement,
  refine,
  disclosure,
  glyph,
  updateChipIcons,
} from "@ikio/card-ui";
import { validate, normalize } from "./config.js";
import { dehumidifierStyles } from "./styles.js";
const finite = (v) => typeof v === "number" && Number.isFinite(v);
function svgNode(tag, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    installRefinement(this);
    this.shadowRoot.prepend(el("style", dehumidifierStyles));
    this.drafts = new Map();
  }
  setConfig(c) {
    super.setConfig(normalize(c));
  }
  onConfig() {
    this.active = "humidifier";
    this.cancelMode?.();
    this.drafts?.clear();
    this.dragging = undefined;
  }
  onDisconnect() {
    this.cancelMode?.();
    this.dragging = undefined;
    this.drafts.clear();
  }
  onVisibility() {
    if (!this.visible) {
      this.cancelMode?.();
      this.drafts.clear();
      this.dragging = undefined;
    }
  }
  static getStubConfig() {
    return { schema_version: 1 };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-dehumidifier-card-editor");
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
      finite(a.target_humidity_step) && a.target_humidity_step >= 1
        ? Math.ceil(a.target_humidity_step)
        : 1;
    const requested = this.config.humidity_step;
    return finite(requested)
      ? Math.max(native, Math.ceil(requested / native) * native)
      : native;
  }
  dial(id, label, key, value, min, max, step, extra = {}) {
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
        "humidifier",
        "set_humidity",
        { ...extra, [key]: snap(v) },
        (s) =>
          finite(s?.attributes?.[key]) &&
          Math.abs(s.attributes[key] - snap(v)) < 0.001,
      );
    };
    const wrap = el("div", undefined, "dehumidifier-dial-row", key);
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
    const dial = el("div", undefined, "dehumidifier-dial");
    const svg = svgNode("svg", {
      viewBox: "0 0 280 155",
      class: "dehumidifier-arc",
      "aria-hidden": "true",
    });
    const fraction = Math.max(0, Math.min(1, (shown - min) / (max - min))),
      angle = Math.PI * (1 - fraction);
    const path = "M20 140 A120 120 0 0 1 260 140";
    svg.append(
      svgNode("path", { d: path, class: "dial-track" }),
      svgNode("path", {
        d: path,
        class: "dial-fill",
        pathLength: 100,
        "stroke-dasharray": `${fraction * 100} 100`,
      }),
      svgNode("circle", {
        cx: 140 + 120 * Math.cos(angle),
        cy: 140 - 120 * Math.sin(angle),
        r: 10,
        class: "dial-handle",
      }),
    );
    const point = (e) => {
      const box = e.currentTarget.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const x = ((e.clientX - box.left) * 280) / box.width - 140,
        y = 140 - ((e.clientY - box.top) * 155) / box.height;
      this.drafts.set(
        draftKey,
        snap(min + (1 - Math.atan2(Math.max(0, y), x) / Math.PI) * (max - min)),
      );
      this.update();
    };
    event(svg, "pointerdown", (e) => {
      if (disabled) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      this.dragging = draftKey;
      point(e);
    });
    event(svg, "pointermove", (e) => {
      if (this.dragging === draftKey && !disabled) point(e);
    });
    event(svg, "pointerup", (e) => {
      if (this.dragging !== draftKey) return;
      this.dragging = undefined;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      if (!disabled) commit(this.drafts.get(draftKey) ?? shown);
    });
    event(svg, "pointercancel", () => {
      this.dragging = undefined;
      this.drafts.delete(draftKey);
      this.update();
    });
    const caption = el("div", undefined, "dial-caption");
    const output = el(
      "output",
      formatNumber(this.hass, shown, 3),
      "dial-value",
    );
    output.append(el("span", "%", "dial-unit"));
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
    input.setAttribute("aria-valuetext", `${shown}%`);
    event(input, "input", (e) => {
      this.drafts.set(draftKey, Number(e.currentTarget.value));
      this.update();
    });
    event(input, "change", (e) => commit(Number(e.currentTarget.value)));
    dial.append(svg, caption, input);
    wrap.append(less, dial, more);
    if (disabled) wrap.classList.add("dial-disabled");
    return wrap;
  }
  async chooseMode(mode) {
    const id = this.config.humidifier_entity;
    if (this.blocked(id)) return;
    if (mode === null)
      return this.send(
        id,
        "humidifier",
        "turn_off",
        {},
        (s) => s?.state === "off",
      );
    // set_mode does not promise to power a humidifier on. Bound the turn-on
    // request and cancel the second command if this card is hidden/reconfigured.
    if (this.state(id)?.state === "off") {
      const generation = this.generation;
      let timer;
      const cancelled = new Promise((resolve, reject) => {
        this.cancelMode = () => resolve(false);
        timer = setTimeout(
          () =>
            reject(
              Error(
                t(
                  this.hass,
                  "No confirmation yet. Check the entity state before retrying.",
                ),
              ),
            ),
          10000,
        );
      });
      this.requests.add(id);
      this.error.textContent = "";
      this.update();
      try {
        this.actionHaptic();
        const completed = await Promise.race([
          this.hass
            .callService("humidifier", "turn_on", { entity_id: id })
            .then(() => true),
          cancelled,
        ]);
        if (
          !completed ||
          generation !== this.generation ||
          !this.isConnected ||
          !this.visible ||
          !available(this.state(id))
        )
          return;
        await this.act(
          id,
          "humidifier",
          "set_mode",
          { mode },
          (s) => s?.state === "on" && s?.attributes?.mode === mode,
        );
      } catch (error) {
        if (generation === this.generation)
          this.error.textContent =
            error.message || t(this.hass, "Action failed");
      } finally {
        clearTimeout(timer);
        if (generation === this.generation) {
          this.cancelMode = undefined;
          this.requests.delete(id);
          this.update();
        }
      }
      return;
    }
    return this.send(
      id,
      "humidifier",
      "set_mode",
      { mode },
      (s) => s?.attributes?.mode === mode,
    );
  }
  fanSettings() {
    const id = this.config.fan_entity,
      s = this.state(id),
      a = s?.attributes || {};
    if (!id) return [];
    if (!available(s)) return [note(t(this.hass, "Fan speed unavailable"))];
    if (id.startsWith("select.") && a.options?.length)
      return [
        this.controlSelect(
          id,
          "Fan speed",
          a.options,
          s.state,
          "select",
          "select_option",
          "option",
        ),
      ];
    const settings = [];
    if (features(s, 8) && a.preset_modes?.length)
      settings.push(
        this.controlSelect(
          id,
          "Fan speed",
          a.preset_modes,
          a.preset_mode,
          "fan",
          "set_preset_mode",
          "preset_mode",
        ),
      );
    if (features(s, 1) && finite(a.percentage)) {
      const speed = range(
        t(this.hass, "Fan speed"),
        a.percentage,
        0,
        100,
        finite(a.percentage_step) && a.percentage_step > 0
          ? a.percentage_step
          : 1,
        (percentage) =>
          this.send(
            id,
            "fan",
            "set_percentage",
            { percentage },
            (state) => state?.attributes?.percentage === percentage,
          ),
      );
      speed.querySelector("input").disabled = this.blocked(id);
      speed.querySelector("input").dataset.entity = id;
      settings.push(speed);
    }
    return settings;
  }
  afterRender() {
    updateChipIcons(this);
  }
  render() {
    const c = this.config,
      id = c.humidifier_entity,
      s = this.state(id),
      a = s?.attributes || {};
    const tank = this.state(c.tank_full_entity);
    const full = Boolean(
      c.tank_full_entity && available(tank) && tank.state === c.tank_full_state,
    );
    const action =
      a.action === "drying"
        ? t(this.hass, "Dehumidifying")
        : stateLabel(this.hass, a.action || s?.state || "unknown");
    const status = !id
      ? ""
      : !available(s)
        ? t(this.hass, "Unavailable")
        : s.state === "off"
          ? t(this.hass, "Off")
          : full
            ? t(this.hass, "Tank full")
            : action;
    const result = group(
      title(
        this,
        c.name || (id ? this.label(id) : t(this.hass, "Dehumidifier")),
        id,
        status,
      ),
    );
    refine(result, "mdi:air-humidifier-off");
    result.classList.add("dehumidifier-card");
    result.dataset.mode = s?.state === "on" ? "on" : "off";
    if (id) {
      const icon = el("ha-state-icon");
      icon.dataset.chipEntity = id;
      icon.setAttribute("aria-hidden", "true");
      result.querySelector("header>ha-icon")?.replaceWith(icon);
    }
    if (!id) {
      result.append(
        note(
          t(this.hass, "Choose a dehumidifier entity in the visual editor."),
        ),
      );
      return result;
    }
    if (available(s))
      result.append(
        this.dial(
          id,
          t(this.hass, "Target humidity"),
          "humidity",
          a.humidity,
          a.min_humidity ?? 0,
          a.max_humidity ?? 100,
          this.step(a),
        ),
      );
    const readings = el("div", undefined, "dehumidifier-readings");
    if (c.humidity_entity || finite(a.current_humidity)) {
      const current = reading(
        t(this.hass, "Current"),
        c.humidity_entity
          ? valueText(this.hass, c.humidity_entity)
          : `${formatNumber(this.hass, a.current_humidity, 1)}%`,
        c.humidity_entity,
      );
      current.querySelector(".ae-label").prepend(glyph("mdi:water-percent"));
      readings.append(current);
    }
    if (c.power_entity) {
      const power = unitValue(this.state(c.power_entity), "power");
      const current = reading(
        t(this.hass, "Power"),
        power === null
          ? valueText(this.hass, c.power_entity)
          : `${formatNumber(this.hass, power, 0)} W`,
        c.power_entity,
      );
      current.querySelector(".ae-label").prepend(glyph("mdi:lightning-bolt"));
      readings.append(current);
    }
    if (readings.children.length) result.append(readings);
    if (full) {
      const alert = note(
        t(this.hass, "Empty the water tank to resume."),
        "ae-warn tank-alert",
      );
      alert.setAttribute("role", "alert");
      alert.prepend(glyph("mdi:water-alert-outline"));
      result.append(alert);
    } else if (c.tank_full_entity && !available(tank)) {
      result.append(note(t(this.hass, "Tank status unavailable")));
    }
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
    const section = el("section", undefined, "dehumidifier-modes-section");
    section.append(el("span", t(this.hass, "Mode"), "ae-label"));
    const modes = el("div", undefined, "dehumidifier-modes");
    modes.setAttribute("role", "group");
    modes.setAttribute("aria-label", t(this.hass, "Mode"));
    const off = button(t(this.hass, "Off"), () => this.chooseMode(null), {
      entity: id,
      disabled: this.blocked(id),
      key: "off",
    });
    off.prepend(glyph("mdi:power"));
    off.setAttribute("aria-pressed", String(s.state === "off"));
    modes.append(off);
    const options =
      c.show_mode && features(s, 1) && Array.isArray(a.available_modes)
        ? a.available_modes.filter((m) => typeof m === "string" && m.trim())
        : [];
    // An explicit On action also covers devices reporting no current mode.
    if (!options.length || !options.includes(a.mode)) {
      const on = button(
        t(this.hass, "On"),
        () =>
          this.send(
            id,
            "humidifier",
            "turn_on",
            {},
            (state) => state?.state === "on",
          ),
        { entity: id, disabled: this.blocked(id), key: "on" },
      );
      on.setAttribute(
        "aria-pressed",
        String(s.state === "on" && !options.includes(a.mode)),
      );
      modes.append(on);
    }
    for (const mode of [...new Set(options)]) {
      // Integration values stay verbatim, including service payloads.
      const control = button(mode, () => this.chooseMode(mode), {
        entity: id,
        disabled: this.blocked(id),
        key: `mode:${mode}`,
      });
      control.setAttribute(
        "aria-pressed",
        String(s.state === "on" && a.mode === mode),
      );
      modes.append(control);
    }
    section.append(modes);
    result.append(section);
    const settings = this.fanSettings();
    if (settings.length) {
      const settingsView = disclosure(
        this,
        "dehumidifier-settings",
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
