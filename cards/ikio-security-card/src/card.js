import {
  ControlCard,
  group,
  row,
  note,
  button,
  features,
  stateText,
  el,
  available,
  details,
  event,
} from "@ikio/card-ui";
import { validate } from "./config.js";
import { alarmModes, forceData } from "./adapter.js";

const modeIcon = {
  home: "mdi:home",
  away: "mdi:lock",
  night: "mdi:weather-night",
  vacation: "mdi:airplane",
  custom_bypass: "mdi:shield-half-full",
};
const ids = (value) =>
  Array.isArray(value) ? value : Object.keys(value || {});
const icon = (name) => {
  const node = el("ha-icon");
  node.setAttribute("icon", name);
  node.setAttribute("aria-hidden", "true");
  return node;
};
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    this.resetInput();
    this.shadowRoot.prepend(
      el(
        "style",
        `
      .ae-security{gap:10px;--security-green:#6ef0a6;--security-selected:#367a56;--security-selected-text:#edfff4}
      :host([appearance=light]) .ae-security{--security-green:#247147;--security-selected:#367a56}
      :host([appearance=ha]) .ae-security{--security-green:var(--success-color,#247147)}
      .security-header{display:flex;align-items:center;gap:15px;padding:5px 2px 8px}
      .security-emblem{display:grid;place-items:center;width:58px;height:58px;flex:none;border:2px solid var(--ae-muted);border-radius:50%;color:var(--ae-muted);background:transparent;padding:0;font:inherit}
      .security-emblem ha-icon{--mdc-icon-size:38px}
      .security-header h2{font-size:20px;font-weight:500;margin:0 0 7px;overflow-wrap:anywhere}
      .security-state{font-size:15px;color:var(--ae-muted)}
      .security-armed .security-emblem{color:var(--security-green);border-color:var(--security-green);background:color-mix(in srgb,var(--security-green) 14%,var(--ae-surface))}
      .security-armed .security-state{color:var(--security-green)}
      .security-alert .security-emblem,.security-alert .security-state{color:var(--ae-error);border-color:var(--ae-error)}
      .security-delay .security-emblem,.security-delay .security-state{color:var(--ae-warning);border-color:var(--ae-warning)}
      .security-modes{display:grid;grid-template-columns:repeat(var(--mode-count),minmax(0,1fr));gap:4px;padding:4px;background:var(--ae-well);border-radius:15px}
      .security-modes .ae-button{min-width:0;min-height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:0;background:transparent;font:inherit;color:var(--ae-muted);padding:8px 3px;overflow-wrap:anywhere}
      .security-modes .ae-button[aria-pressed=true]{background:color-mix(in srgb,var(--ae-muted) 35%,var(--ae-well));color:var(--ae-text)}
      .security-armed .security-modes .ae-button[aria-pressed=true]{background:var(--security-selected);color:var(--security-selected-text)}
      .security-modes ha-icon{--mdc-icon-size:22px}
      .security-sensors{display:grid;gap:6px}
      .security-bypass{display:flex;align-items:center;gap:8px;min-height:44px;font-size:13px;color:var(--ae-muted)}
      .security-bypass input{width:17px;height:17px;margin:0;accent-color:var(--ae-warning)}
      .security-sensor-summary{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--ae-warning)}
      .security-sensor-summary ha-icon{--mdc-icon-size:17px;flex:none}
      .security-sensor-summary.clear{color:var(--security-green)}
      .security-chips{display:flex;flex-wrap:wrap;gap:0 12px}
      .security-chips button{display:flex;align-items:center;gap:5px;min-height:44px;min-width:44px;padding:0;border:0;background:transparent;color:var(--ae-warning);font:inherit;font-size:12px;text-align:left;overflow-wrap:anywhere}
      .security-chips ha-state-icon{--mdc-icon-size:17px;flex:none}
      .security-pin{border-top:1px solid var(--ae-border);padding-top:14px;display:grid;gap:10px}
      .security-pin label{display:grid;gap:8px;color:var(--ae-muted);font-size:13px}
      .security-pin input{width:100%;min-width:0;min-height:40px;font:inherit;font-size:20px;letter-spacing:7px;text-align:center;color:var(--ae-text);background:transparent;border:1px solid var(--ae-border);border-radius:8px;padding:6px}
      .security-keypad{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;width:100%;max-width:280px;justify-self:center}
      .security-keypad .ae-button{min-height:44px;font-size:20px;border:0}
      .security-keypad .security-clear{font-size:12px}
      .security-pin-actions{display:flex;justify-content:flex-end;gap:8px}
      .security-submit{background:var(--security-selected);color:var(--security-selected-text)}
      @container(max-width:300px){.security-header{gap:10px}.security-modes{grid-template-columns:repeat(auto-fit,minmax(65px,1fr))}}
    `,
      ),
    );
  }
  static getStubConfig() {
    return {
      schema_version: 1,
      modes: ["home", "away"],
      confirm_arm: true,
      allow_override: true,
      contacts: [],
      motion: [],
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-security-card-editor");
  }
  resetInput() {
    this.pin = "";
    const input = this.shadowRoot?.querySelector(".security-pin input");
    if (input) input.value = "";
    this.bypass = false;
    this.armIntent = null;
  }
  onConfig() {
    this.resetInput();
    this.lastAlarmState = undefined;
  }
  onVisibility() {
    clearInterval(this.clock);
    if (!this.visible) {
      this.resetInput();
      this.update();
    }
    if (
      this.isConnected &&
      this.visible &&
      ["arming", "pending"].includes(this.state()?.state)
    )
      this.clock = setInterval(() => this.update(), 1000);
  }
  afterRender() {
    this.entityIds = [
      ...new Set([
        ...this.entityIds,
        ...this.sensorRows().map((r) => r.entity),
      ]),
    ];
    for (const glyph of this.content.querySelectorAll("ha-state-icon")) {
      glyph.hass = this.hass;
      glyph.stateObj = this.state(glyph.dataset.sensor);
    }
    const delay = ["arming", "pending"].includes(this.state()?.state);
    if (delay !== this.clockDelay) {
      this.clockDelay = delay;
      this.onVisibility();
    }
  }
  onDisconnect() {
    clearInterval(this.clock);
    this.resetInput();
  }
  sensorRows() {
    const c = this.config,
      s = this.state();
    const rows = new Map();
    for (const r of c.contacts || [])
      if (r.entity) rows.set(r.entity, { ...r, kind: "opening" });
    for (const r of c.motion || [])
      if (r.entity) rows.set(r.entity, { ...r, kind: "motion" });
    for (const id of [
      ...ids(s?.attributes?.open_sensors),
      ...ids(s?.attributes?.bypassed_sensors),
    ])
      if (!rows.has(id)) rows.set(id, { entity: id, kind: "sensor" });
    return [...rows.values()];
  }
  openIds() {
    return [
      ...new Set([
        ...(this.config.contacts || [])
          .filter((r) => this.state(r.entity)?.state === "on")
          .map((r) => r.entity),
        ...ids(this.state()?.attributes?.open_sensors),
      ]),
    ];
  }
  canBypass() {
    return (
      this.state()?.state === "disarmed" &&
      this.config.allow_override !== false &&
      !!this.hass?.services?.alarmo?.arm &&
      this.openIds().length > 0
    );
  }
  arm(mode) {
    if (this.blocked(this.config.entity) || this.state()?.state !== "disarmed")
      return;
    const supported = alarmModes.some(
      (m) =>
        m.mode === mode &&
        features(this.state(), m.flag) &&
        (this.config.modes || ["home", "away"]).includes(mode),
    );
    if (!supported) return;
    this.pin = "";
    this.armIntent = mode;
    if (
      this.config.confirm_arm === false &&
      !this.state()?.attributes?.code_arm_required &&
      !this.bypass
    )
      return this.submitArm();
    this.update();
  }
  submitArm() {
    const mode = this.armIntent;
    if (
      !mode ||
      this.blocked(this.config.entity) ||
      this.state()?.state !== "disarmed"
    )
      return;
    if (this.state()?.attributes?.code_arm_required && !this.pin) return;
    const force = this.bypass && this.canBypass();
    const code = this.pin;
    this.resetInput();
    return this.send(
      this.config.entity,
      force ? "alarmo" : "alarm_control_panel",
      force ? "arm" : `alarm_arm_${mode}`,
      force ? forceData(this.config.entity, mode, code) : code ? { code } : {},
      (state) => state?.state === "arming" || state?.state === `armed_${mode}`,
    );
  }
  disarm() {
    const s = this.state();
    if (this.blocked(this.config.entity) || s?.state === "disarmed") return;
    if (s.attributes?.code_format && !this.pin) return;
    const code = this.pin;
    this.resetInput();
    return this.send(
      this.config.entity,
      "alarm_control_panel",
      "alarm_disarm",
      code ? { code } : {},
      (state) => state?.state === "disarmed",
    );
  }
  pinView(arming = false) {
    const s = this.state(),
      requiresCode = arming
        ? s.attributes?.code_arm_required
        : !!s.attributes?.code_format;
    const result = el("div", undefined, "security-pin", "pin");
    const label = el(
      "label",
      arming
        ? `Arm ${this.armIntent.replaceAll("_", " ")}`
        : "Enter PIN to disarm",
    );
    if (!arming || requiresCode) {
      const input = el("input", undefined, undefined, "alarm-pin");
      input.type = "password";
      input.autocomplete = "off";
      input.inputMode =
        s.attributes?.code_format === "text" ? "text" : "numeric";
      input.maxLength = 32;
      input.value = this.pin;
      input.placeholder = "— — — —";
      input.setAttribute(
        "aria-label",
        arming ? "Arming code" : "Disarming code",
      );
      input.disabled = this.blocked(this.config.entity);
      event(input, "input", (e) => {
        this.pin = e.currentTarget.value;
        this.update();
      });
      event(input, "keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          arming ? this.submitArm() : this.disarm();
        }
      });
      label.append(input);
      result.append(label);
      const keypad = el("div", undefined, "security-keypad");
      const edit = (fn) => {
        if (this.blocked(this.config.entity)) return;
        this.pin = fn(this.pin);
        this.update();
      };
      for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9, "Clear", 0, "Delete"]) {
        const key = button(
          String(digit),
          () =>
            edit((value) =>
              digit === "Clear"
                ? ""
                : digit === "Delete"
                  ? value.slice(0, -1)
                  : (value + digit).slice(0, 32),
            ),
          {
            key: `pin-${digit}`,
            disabled: this.blocked(this.config.entity),
            ...(digit === "Delete" ? { icon: "mdi:backspace-outline" } : {}),
          },
        );
        if (digit === "Clear") key.classList.add("security-clear");
        keypad.append(key);
      }
      result.append(keypad);
    } else result.append(label);
    if (arming && this.bypass && this.canBypass())
      result.append(
        note(
          "The listed open sensors will be bypassed for this arming. Required codes and normal exit delay still apply.",
          "ae-warn",
        ),
      );
    const actions = row();
    actions.className = "security-pin-actions";
    if (arming)
      actions.append(
        button("Cancel", () => {
          this.resetInput();
          this.update();
        }),
      );
    const submit = button(
      arming ? "Confirm arm" : "Disarm",
      () => (arming ? this.submitArm() : this.disarm()),
      {
        disabled:
          this.blocked(this.config.entity) || (requiresCode && !this.pin),
        key: "submit-alarm",
      },
    );
    submit.classList.add("security-submit");
    actions.append(submit);
    result.append(actions);
    return result;
  }
  render() {
    const c = this.config,
      s = this.state();
    if (!c.entity) return note("Choose an alarm panel in the visual editor.");
    if (this.lastAlarmState !== s?.state) {
      this.resetInput();
      this.lastAlarmState = s?.state;
    }
    if (!this.canBypass()) this.bypass = false;
    const armed = s?.state?.startsWith("armed_"),
      live = available(s);
    const result = group();
    result.classList.add("ae-security");
    if (armed) result.classList.add("security-armed");
    if (s?.state === "triggered") result.classList.add("security-alert");
    if (["arming", "pending"].includes(s?.state))
      result.classList.add("security-delay");
    const header = el("header", undefined, "security-header", "header");
    const emblem = button("Alarm details", () => details(this, c.entity), {
      icon: armed
        ? "mdi:shield-check"
        : s?.state === "triggered"
          ? "mdi:shield-alert"
          : "mdi:shield-off-outline",
      entity: c.entity,
    });
    emblem.className = "security-emblem";
    const heading = el("div");
    const status =
      (s && this.hass?.formatEntityState?.(s)) ||
      {
        disarmed: "Disarmed",
        armed_away: "Armed away",
        armed_home: "Armed home",
        arming: "Arming",
        pending: "Entry delay",
        triggered: "Alarm triggered",
      }[s?.state] ||
      stateText(this.hass, c.entity);
    const statusNode = el("div", status, "security-state");
    statusNode.setAttribute("aria-live", "polite");
    heading.append(el("h2", c.name || "Home security"), statusNode);
    header.append(emblem, heading);
    result.append(header);
    const sensors = el("div", undefined, "security-sensors", "sensors");
    if (this.canBypass()) {
      const label = el("label", undefined, "security-bypass");
      const check = el("input", undefined, undefined, "bypass-open");
      check.type = "checkbox";
      check.checked = this.bypass;
      check.disabled = this.blocked(c.entity);
      event(check, "change", (e) => {
        this.bypass = e.currentTarget.checked;
        this.update();
      });
      label.append(check, el("span", "Bypass open sensors"));
      sensors.append(label);
    }
    const bypassed = new Set(ids(s?.attributes?.bypassed_sensors));
    const reported = new Set(ids(s?.attributes?.open_sensors));
    const rows = this.sensorRows();
    const alerts = rows.filter(
      (r) =>
        bypassed.has(r.entity) ||
        reported.has(r.entity) ||
        this.state(r.entity)?.state !== "off",
    );
    const unknown = alerts.filter(
      (r) =>
        !available(this.state(r.entity)) &&
        !bypassed.has(r.entity) &&
        !reported.has(r.entity),
    );
    const openings = alerts.filter(
      (r) =>
        r.kind === "opening" &&
        (this.state(r.entity)?.state === "on" || reported.has(r.entity)) &&
        !bypassed.has(r.entity),
    );
    const motion = alerts.filter(
      (r) =>
        r.kind === "motion" &&
        (this.state(r.entity)?.state === "on" || reported.has(r.entity)) &&
        !bypassed.has(r.entity),
    );
    const other = alerts.filter(
      (r) =>
        r.kind === "sensor" && !bypassed.has(r.entity) && !unknown.includes(r),
    );
    const messages = [
      bypassed.size
        ? `${bypassed.size} sensor${bypassed.size === 1 ? "" : "s"} bypassed`
        : "",
      openings.length
        ? `${openings.length} opening${openings.length === 1 ? "" : "s"} open`
        : "",
      motion.length ? `${motion.length} motion active` : "",
      other.length
        ? `${other.length} sensor${other.length === 1 ? "" : "s"} open`
        : "",
      unknown.length
        ? `${unknown.length} sensor${unknown.length === 1 ? "" : "s"} unavailable`
        : "",
    ].filter(Boolean);
    const summary = el(
      "div",
      undefined,
      `security-sensor-summary${alerts.length ? "" : " clear"}`,
    );
    summary.append(
      icon(
        alerts.length ? "mdi:alert-circle-outline" : "mdi:check-circle-outline",
      ),
      el(
        "span",
        messages.join(" · ") ||
          (rows.length ? "All selected sensors clear" : "No sensors selected"),
      ),
    );
    sensors.append(summary);
    if (alerts.length) {
      const chips = el("div", undefined, "security-chips");
      for (const r of alerts) {
        const suffix = bypassed.has(r.entity)
          ? "bypassed"
          : !available(this.state(r.entity))
            ? "unavailable"
            : r.kind === "motion"
              ? "motion detected"
              : "open";
        const chip = button(
          r.name || this.label(r.entity),
          () => details(this, r.entity),
          { key: r.entity, entity: r.entity },
        );
        chip.setAttribute(
          "aria-label",
          `${r.name || this.label(r.entity)}: ${suffix}`,
        );
        const glyph = el("ha-state-icon");
        glyph.dataset.sensor = r.entity;
        glyph.setAttribute("aria-hidden", "true");
        glyph.setAttribute("data-native", "");
        chip.prepend(glyph);
        chips.append(chip);
      }
      sensors.append(chips);
    }
    result.append(sensors);
    const modes = alarmModes
      .filter(
        (m) =>
          features(s, m.flag) && (c.modes || ["home", "away"]).includes(m.mode),
      )
      .sort((a, b) => (a.mode === "away" ? -1 : b.mode === "away" ? 1 : 0));
    const selector = el("div", undefined, "security-modes", "modes");
    selector.style.setProperty("--mode-count", modes.length + 1);
    selector.setAttribute("role", "group");
    selector.setAttribute("aria-label", "Alarm mode");
    const disarmed = button(
      "Disarmed",
      () => {
        if (s?.state !== "disarmed")
          this.content.querySelector(".security-pin input")?.focus();
      },
      { key: "mode-disarmed", disabled: !live || this.blocked(c.entity) },
    );
    disarmed.prepend(icon("mdi:shield-off-outline"));
    disarmed.setAttribute("aria-pressed", String(s?.state === "disarmed"));
    selector.append(disarmed);
    for (const m of modes) {
      const label = m.mode.replaceAll("_", " ");
      const key = button(
        label[0].toUpperCase() + label.slice(1),
        () => this.arm(m.mode),
        {
          key: `mode-${m.mode}`,
          disabled:
            this.blocked(c.entity) ||
            (s?.state !== "disarmed" && s?.state !== `armed_${m.mode}`),
        },
      );
      key.prepend(icon(modeIcon[m.mode]));
      key.setAttribute("aria-pressed", String(s?.state === `armed_${m.mode}`));
      selector.append(key);
    }
    result.append(selector);
    if (s?.attributes?.delay && ["arming", "pending"].includes(s.state))
      result.append(
        note(
          `${status}: configured delay ${s.attributes.delay} seconds`,
          "ae-warn",
        ),
      );
    if (live && s.state !== "disarmed") result.append(this.pinView());
    else if (live && this.armIntent) result.append(this.pinView(true));
    return result;
  }
}
