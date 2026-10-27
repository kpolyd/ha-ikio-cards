import { t } from "@ikio/card-ui/i18n";
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
import { SensorActivity } from "./activity.js";
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
    this.activity = new SensorActivity(this);
    this.shadowRoot.prepend(
      el(
        "style",
        `
      .ae-security{gap:10px;--security-green:#6ef0a6;--security-selected:#367a56;--security-selected-text:#edfff4;--security-coral:#f08072}
      :host([appearance=light]) .ae-security{--security-green:#247147;--security-selected:#367a56;--security-coral:#b7473b}
      :host([appearance=ha]) .ae-security{--security-green:var(--success-color,#247147)}
      .security-header{display:flex;align-items:center;gap:15px;padding:5px 2px 8px}
      .security-emblem{display:grid;place-items:center;width:58px;height:58px;flex:none;border:2px solid var(--ae-muted);border-radius:50%;color:var(--ae-muted);background:transparent;padding:0;font:inherit}
      .security-emblem ha-icon{--mdc-icon-size:32px}
      .security-header h2{font-size:20px;font-weight:500;margin:0 0 7px;overflow-wrap:anywhere}
      .security-state{font-size:15px;color:var(--ae-muted)}
      .security-armed .security-emblem{color:var(--security-green);border-color:var(--security-green);background:color-mix(in srgb,var(--security-green) 14%,var(--ae-surface))}
      .security-armed .security-state{color:var(--security-green)}
      .security-alert .security-emblem,.security-alert .security-state{color:var(--ae-error);border-color:var(--ae-error)}
      .security-delay .security-emblem,.security-delay .security-state{color:var(--security-coral);border-color:var(--security-coral)}
      .security-emblem.security-countdown{position:relative;border-color:transparent}
      .security-countdown svg{position:absolute;inset:-2px;width:58px;height:58px;pointer-events:none;transform:rotate(-90deg)}
      .security-countdown circle{fill:none;stroke-width:2}
      .security-countdown-track{stroke:var(--ae-border)}
      .security-countdown-arc{stroke:currentColor;stroke-linecap:round;transition:stroke-dasharray 1s linear}
      .security-seconds{font-weight:600;font-variant-numeric:tabular-nums}
      @media(prefers-reduced-motion:reduce){.security-countdown-arc{transition:none}}
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
      button.security-sensor-summary{width:100%;min-height:44px;border:0;padding:0;background:transparent;font:inherit;font-size:13px;text-align:left;cursor:pointer}
      .security-sensor-chevron{margin-left:auto}
      .security-chips{display:grid;gap:0;border-top:1px solid var(--ae-border)}
      .security-sensor-area{display:grid;grid-template-columns:70px minmax(0,1fr);gap:8px;padding:4px 0;align-items:start}
      .security-sensor-area+.security-sensor-area{border-top:1px solid var(--ae-border)}
      .security-sensor-area h3{margin:14px 0 0;font-size:11px;font-weight:500;line-height:16px;color:var(--ae-muted);overflow-wrap:anywhere}
      .security-area-chips{display:flex;flex-wrap:wrap;gap:0 6px;min-width:0}
      .security-chip-content{display:flex;align-items:center;gap:5px;min-width:0;max-width:100%;padding:4px 7px;border-radius:7px;background:var(--ae-well)}
      .security-chip-label{min-width:0;overflow-wrap:anywhere}
      @container(max-width:300px){.security-sensor-area{grid-template-columns:62px minmax(0,1fr);gap:6px}}
      .security-chips[hidden]{display:none}
      .security-chips button{display:flex;align-items:center;gap:5px;min-height:44px;min-width:44px;max-width:100%;padding:0;border:0;background:transparent;color:var(--ae-text);font:inherit;font-size:12px;text-align:left;overflow-wrap:anywhere}
      .security-chips ha-state-icon{--mdc-icon-size:14px;flex:none;color:var(--ae-error)}
      .security-activity{border-top:1px solid var(--ae-border);padding-top:10px;min-width:0}
      .security-activity>header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
      .security-activity h3{font-size:13px;font-weight:500;margin:0}
      .security-activity>header>span,.security-activity h4{font-size:11px;color:var(--ae-muted);font-weight:500}
      .security-activity h4{margin:10px 0 4px}
      .security-activity-scroll{max-height:288px;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:var(--ae-border) transparent;overflow-anchor:none}
      .security-activity-scroll:focus-visible{outline:2px solid var(--ae-accent);outline-offset:2px}
      .security-activity-row.ae-button{width:100%;display:grid;grid-template-columns:18px minmax(0,1fr) minmax(65px,auto);gap:8px;align-items:center;min-height:48px;border:0;border-radius:0;background:transparent;padding:5px 0;text-align:left;font:inherit;font-size:12px}
      .security-activity-row>ha-state-icon{--mdc-icon-size:16px;color:var(--ae-muted)}
      .security-activity-content,.security-activity-end{display:grid;gap:2px;min-width:0;overflow-wrap:anywhere}
      .security-activity-name{font-weight:500}
      .security-activity-meta{display:flex;flex-wrap:wrap;align-items:center;gap:3px 7px;font-size:11px;color:var(--ae-muted)}
      .security-activity-actor{display:inline-flex;align-items:center;gap:4px;min-width:0}
      .security-activity-actor img{width:16px;height:16px;object-fit:cover;border-radius:50%}
      .security-activity-actor ha-icon{--mdc-icon-size:16px}
      .security-activity-end{text-align:right}
      .security-activity-end time{font-size:11px;color:var(--ae-muted);font-variant-numeric:tabular-nums}
      .activity-triggered>ha-state-icon,.activity-triggered .security-activity-end>span{color:var(--ae-error)}
      .activity-active>ha-state-icon{color:var(--ae-warning)}
      .activity-armed>ha-state-icon{color:var(--security-green)}
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
      allow_override: true,
      contacts: [],
      motion: [],
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-alarmo-card-editor");
  }
  resetInput() {
    this.pin = "";
    const input = this.shadowRoot?.querySelector(".security-pin input");
    if (input) input.value = "";
    this.bypass = false;
    this.armIntent = null;
  }
  onConfig() {
    this.activity.reset();
    this.sensorsExpanded = false;
    this.stopCountdown();
    this.resetInput();
    this.lastAlarmState = undefined;
    this.stopAlarmo();
    this.alarmoConnection = null;
    this.alarmoChecked = undefined;
    this.alarmoSensors = [];
    this.alarmoStatus = "idle";
    this.failedSensors = [];
    this.loadAlarmo();
  }
  onVisibility() {
    if (!this.visible) {
      this.activity.stop();
      this.stopCountdown();
      this.stopAlarmo();
      this.resetInput();
      this.update();
    }
    if (this.isConnected && this.visible) {
      this.loadAlarmo();
      this.update();
    }
  }
  afterRender() {
    this.activity.sync();
    this.loadAlarmo();
    this.entityIds = [
      ...new Set([
        ...this.entityIds,
        ...this.sensorRows().map((r) => r.entity),
        ...(this.config.show_activity
          ? Object.keys(this.hass?.states || {}).filter((id) =>
              id.startsWith("person."),
            )
          : []),
      ]),
    ];
    for (const glyph of this.content.querySelectorAll("ha-state-icon")) {
      glyph.hass = this.hass;
      glyph.stateObj = glyph.dataset.activityEntity
        ? {
            ...this.state(glyph.dataset.activityEntity),
            entity_id: glyph.dataset.activityEntity,
            state: glyph.dataset.activityState,
            attributes: {
              ...this.state(glyph.dataset.activityEntity)?.attributes,
              ...(glyph.dataset.activityIcon
                ? { icon: glyph.dataset.activityIcon }
                : {}),
            },
          }
        : this.state(glyph.dataset.sensor);
    }
    this.activity.afterRender();
    this.syncCountdown();
  }
  onDisconnect() {
    this.activity.stop();
    this.stopAlarmo();
    this.stopCountdown();
    this.resetInput();
  }
  delayKey() {
    const state = this.state();
    return ["arming", "pending"].includes(state?.state)
      ? JSON.stringify([this.config.entity, state.state, state.last_changed])
      : undefined;
  }
  stopCountdown() {
    this.countdownRequest = (this.countdownRequest || 0) + 1;
    this.cancelCountdown?.();
    this.cancelCountdown = undefined;
    clearInterval(this.clock);
    this.clock = undefined;
    this.countdownKey = undefined;
    this.countdown = undefined;
    this.countdownLoading = false;
    this.countdownChecked = undefined;
  }
  countdownValue() {
    if (
      this.countdownKey !== this.delayKey() ||
      this.countdownConnection !== this.hass?.connection ||
      !this.countdown
    )
      return;
    return {
      seconds: Math.ceil(Math.max(0, this.countdown.end - Date.now()) / 1000),
      fraction: Math.max(
        0,
        Math.min(
          1,
          (this.countdown.end - Date.now()) / (this.countdown.delay * 1000),
        ),
      ),
    };
  }
  async syncCountdown() {
    const key = this.delayKey();
    if (!key || !this.isConnected || !this.visible || this.preview) {
      this.stopCountdown();
      return;
    }
    if (
      key !== this.countdownKey ||
      this.countdownConnection !== this.hass?.connection
    ) {
      this.stopCountdown();
      this.countdownKey = key;
      this.countdownConnection = this.hass?.connection;
    }
    this.clock ??= setInterval(() => this.update(), 1000);
    if (
      !this.hass?.callWS ||
      this.countdownLoading ||
      (this.countdownChecked !== undefined &&
        Date.now() - this.countdownChecked < 15000)
    )
      return;
    this.countdownLoading = true;
    const request = (this.countdownRequest = (this.countdownRequest || 0) + 1);
    const valid = () =>
      request === this.countdownRequest &&
      key === this.delayKey() &&
      this.isConnected &&
      this.visible &&
      !this.preview &&
      this.countdownConnection === this.hass?.connection;
    let timer;
    const cancelled = new Promise((_, reject) => {
      this.cancelCountdown = () => reject(new Error("Countdown cancelled"));
      timer = setTimeout(() => reject(new Error("Countdown timed out")), 5000);
    });
    try {
      const data = await Promise.race([
        this.hass.callWS({
          type: "alarmo/countdown",
          entity_id: this.config.entity,
        }),
        cancelled,
      ]);
      if (!valid()) return;
      if (
        !Number.isFinite(data?.delay) ||
        data.delay <= 0 ||
        !Number.isFinite(data.remaining)
      )
        throw new Error("Countdown unavailable");
      this.countdown = {
        delay: data.delay,
        end:
          Date.now() + Math.max(0, Math.min(data.delay, data.remaining)) * 1000,
      };
    } catch {
      // Keep the backend state and PIN pad when a countdown is unavailable.
    } finally {
      clearTimeout(timer);
      if (valid()) {
        this.countdownLoading = false;
        this.cancelCountdown = undefined;
        this.countdownChecked = Date.now();
        this.update();
      }
    }
  }
  stopAlarmo() {
    this.alarmoRequest = (this.alarmoRequest || 0) + 1;
    this.cancelAlarmoLoad?.();
    this.cancelAlarmoLoad = undefined;
    for (const unsubscribe of this.alarmoSubscriptions || []) unsubscribe();
    this.alarmoSubscriptions = [];
    this.alarmoSubscribed = false;
    this.alarmoLoading = false;
    clearInterval(this.alarmoRefresh);
    this.alarmoRefresh = undefined;
  }
  async loadAlarmo(force = false) {
    const connection = this.hass?.connection;
    if (
      !this.config?.entity ||
      !this.hass?.callWS ||
      !this.isConnected ||
      !this.visible ||
      this.preview
    )
      return;
    if (
      connection &&
      this.alarmoConnection &&
      connection !== this.alarmoConnection
    ) {
      this.stopAlarmo();
      this.alarmoSensors = [];
      this.alarmoStatus = "idle";
      this.alarmoChecked = undefined;
    }
    this.subscribeAlarmo();
    this.alarmoRefresh ??= setInterval(() => this.loadAlarmo(true), 60000);
    if (
      this.alarmoLoading ||
      (!force &&
        this.alarmoStatus !== "idle" &&
        this.alarmoConnection === connection &&
        Date.now() - this.alarmoChecked < 60000)
    )
      return;
    this.alarmoConnection = connection;
    this.alarmoLoading = true;
    const request = (this.alarmoRequest = (this.alarmoRequest || 0) + 1);
    const entity = this.config.entity;
    const valid = () =>
      request === this.alarmoRequest &&
      this.config.entity === entity &&
      this.isConnected &&
      this.visible;
    let timer;
    const cancelled = new Promise((_, reject) => {
      this.cancelAlarmoLoad = () => reject(new Error("Discovery cancelled"));
      timer = setTimeout(() => reject(new Error("Discovery timed out")), 5000);
    });
    try {
      const [entities, sensors] = await Promise.race([
        Promise.all([
          this.hass.callWS({ type: "alarmo/entities" }),
          this.hass.callWS({ type: "alarmo/sensors" }),
        ]),
        cancelled,
      ]);
      if (!valid()) return;
      const panel = entities.find((item) => item.entity_id === entity);
      if (!panel) {
        this.alarmoSensors = [];
        this.alarmoStatus = "not-alarmo";
      } else {
        this.alarmoArea = panel.area_id;
        const areas = new Set(
          entities
            .filter((item) => String(item.area_id) !== "0")
            .map((item) => String(item.area_id)),
        );
        this.alarmoSensors = Object.entries(sensors)
          .filter(
            ([id, sensor]) =>
              id.startsWith("binary_sensor.") &&
              sensor.enabled !== false &&
              (String(panel.area_id) === "0"
                ? areas.has(String(sensor.area))
                : String(sensor.area) === String(panel.area_id)),
          )
          .map(([id, sensor]) => ({
            entity: id,
            kind:
              sensor.type === "motion"
                ? "motion"
                : ["door", "window"].includes(sensor.type)
                  ? "opening"
                  : "sensor",
            alarmo: sensor,
          }));
        this.alarmoStatus = "ready";
      }
      this.subscribeAlarmo();
    } catch {
      if (!valid()) return;
      this.alarmoStatus = "unavailable";
    } finally {
      clearTimeout(timer);
      if (valid()) {
        this.cancelAlarmoLoad = undefined;
        this.alarmoChecked = Date.now();
        this.alarmoLoading = false;
        this.update();
      }
    }
  }
  subscribeAlarmo() {
    const connection = this.hass?.connection;
    if (!connection || this.alarmoSubscribed) return;
    this.alarmoSubscribed = true;
    const revision = this.revision;
    const subscriptions = this.alarmoSubscriptions;
    const register = async (promise) => {
      try {
        const unsubscribe = await promise;
        if (
          !this.isConnected ||
          !this.visible ||
          revision !== this.revision ||
          subscriptions !== this.alarmoSubscriptions
        )
          unsubscribe();
        else subscriptions.push(unsubscribe);
      } catch {
        /* State attributes remain a fallback when event access is unavailable. */
      }
    };
    if (connection.subscribeEvents)
      register(
        connection.subscribeEvents(
          (event) => this.alarmoFailure(event.data),
          "alarmo_failed_to_arm",
        ),
      );
    if (connection.subscribeMessage)
      register(
        connection.subscribeMessage(() => this.loadAlarmo(true), {
          type: "alarmo_config_updated",
        }),
      );
  }
  alarmoFailure(data) {
    if (
      data?.entity_id !== this.config.entity ||
      !this.pending.has(this.config.entity)
    )
      return;
    const action = this.pending.get(this.config.entity);
    clearTimeout(action.timer);
    this.pending.delete(this.config.entity);
    this.failedSensors = Array.isArray(data.sensors) ? data.sensors : [];
    this.resetInput();
    this.error.textContent = t(
      this.hass,
      {
        open_sensors:
          "Cannot arm: sensors are open. Close them or select Bypass open sensors.",
        invalid_code: "Invalid or missing alarm code.",
        not_allowed: "Alarmo did not allow this command.",
      }[data.reason] || "Alarmo could not complete the command.",
    );
    this.update();
  }
  reconcile() {
    super.reconcile();
    const entity = this.config?.entity;
    const state = this.state(entity);
    if (
      entity &&
      this.pending.has(entity) &&
      state?.state === "disarmed" &&
      ids(state.attributes?.open_sensors).length &&
      JSON.stringify(state.attributes.open_sensors) !== this.armOpenSnapshot
    )
      this.alarmoFailure({
        entity_id: entity,
        reason: "open_sensors",
        sensors: ids(state.attributes.open_sensors),
      });
  }
  sensorLabel(row) {
    if (row.name) return row.name;
    const label =
      this.state(row.entity)?.attributes?.friendly_name ||
      this.label(row.entity);
    const deviceId = this.hass?.entities?.[row.entity]?.device_id;
    const device = this.hass?.devices?.[deviceId];
    const deviceName = device?.name_by_user || device?.name;
    return deviceName && !label.toLowerCase().includes(deviceName.toLowerCase())
      ? `${deviceName} ${label}`
      : label;
  }
  sensorGroups(rows) {
    const groups = new Map();
    const typeOrder = (row) => {
      const type =
        this.state(row.entity)?.attributes?.device_class || row.alarmo?.type;
      if (type === "door" || type === "garage_door") return 0;
      if (type === "window") return 1;
      if (row.kind === "opening" || type === "opening") return 2;
      if (row.kind === "motion" || type === "motion" || type === "occupancy")
        return 3;
      return 4;
    };
    for (const row of rows) {
      const entry = this.hass?.entities?.[row.entity];
      const areaId =
        entry?.area_id || this.hass?.devices?.[entry?.device_id]?.area_id;
      const area = this.hass?.areas?.[areaId];
      const key = area ? areaId : null;
      if (!groups.has(key))
        groups.set(key, {
          name: area?.name || t(this.hass, "Unassigned"),
          rows: [],
        });
      groups.get(key).rows.push(row);
    }
    for (const group of groups.values())
      group.rows.sort(
        (a, b) =>
          typeOrder(a) - typeOrder(b) ||
          this.sensorLabel(a).localeCompare(this.sensorLabel(b)),
      );
    return [...groups.values()];
  }
  sensorRows() {
    const c = this.config,
      s = this.state();
    const rows = new Map(
      (this.alarmoSensors || []).map((row) => [row.entity, row]),
    );
    for (const r of c.contacts || [])
      if (r.entity) rows.set(r.entity, { ...r, kind: "opening" });
    for (const r of c.motion || [])
      if (r.entity) rows.set(r.entity, { ...r, kind: "motion" });
    for (const id of [
      ...(this.failedSensors || []),
      ...ids(s?.attributes?.open_sensors),
      ...ids(s?.attributes?.bypassed_sensors),
    ])
      if (!rows.has(id)) rows.set(id, { entity: id, kind: "sensor" });
    return [...rows.values()];
  }
  openIds() {
    return [
      ...new Set([
        ...this.sensorRows()
          .filter((r) => this.state(r.entity)?.state === "on")
          .map((r) => r.entity),
        ...ids(this.state()?.attributes?.open_sensors).filter(
          (id) => this.state(id)?.state !== "off",
        ),
        ...(this.failedSensors || []).filter(
          (id) => this.state(id)?.state !== "off",
        ),
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
    if (!this.state()?.attributes?.code_arm_required) return this.submitArm();
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
    this.armOpenSnapshot = JSON.stringify(
      this.state()?.attributes?.open_sensors || null,
    );
    const code = this.pin;
    this.failedSensors = [];
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
        ? t(this.hass, "Arm {p0}", {
            p0: t(
              this.hass,
              this.armIntent[0].toUpperCase() +
                this.armIntent.slice(1).replaceAll("_", " "),
            ),
          })
        : t(this.hass, "Enter PIN to disarm"),
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
        arming ? t(this.hass, "Arming code") : t(this.hass, "Disarming code"),
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
          t(this.hass, String(digit)),
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
          t(
            this.hass,
            "The listed open sensors will be bypassed for this arming. Required codes and normal exit delay still apply.",
          ),
          "ae-warn",
        ),
      );
    const actions = row();
    actions.className = "security-pin-actions";
    if (arming)
      actions.append(
        button(t(this.hass, "Cancel"), () => {
          this.resetInput();
          this.update();
        }),
      );
    const submit = button(
      arming
        ? t(this.hass, "Arm {p0}", {
            p0: t(
              this.hass,
              this.armIntent[0].toUpperCase() +
                this.armIntent.slice(1).replaceAll("_", " "),
            ),
          })
        : t(this.hass, "Disarm"),
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
    if (!c.entity)
      return note(t(this.hass, "Choose an alarm panel in the visual editor."));
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
    const emblem = button(
      t(this.hass, "Alarm details"),
      () => details(this, c.entity),
      {
        icon: armed
          ? "mdi:shield-check"
          : s?.state === "triggered"
            ? "mdi:shield-alert"
            : "mdi:shield-off-outline",
        entity: c.entity,
      },
    );
    emblem.className = "security-emblem";
    const countdown = this.countdownValue();
    if (countdown) {
      emblem.classList.add("security-countdown");
      const ns = "http://www.w3.org/2000/svg";
      const ring = document.createElementNS(ns, "svg");
      ring.setAttribute("viewBox", "0 0 60 60");
      ring.setAttribute("aria-hidden", "true");
      for (const name of ["track", "arc"]) {
        const circle = document.createElementNS(ns, "circle");
        for (const [attr, value] of Object.entries({
          cx: 30,
          cy: 30,
          r: 28,
          pathLength: 100,
        }))
          circle.setAttribute(attr, String(value));
        circle.setAttribute("class", `security-countdown-${name}`);
        if (name === "arc")
          circle.setAttribute(
            "stroke-dasharray",
            `${countdown.fraction * 100} 100`,
          );
        ring.append(circle);
      }
      emblem.append(ring);
    }
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
    const statusNode = el("div", undefined, "security-state");
    const statusLabel = el("span", t(this.hass, status));
    statusLabel.setAttribute("aria-live", "polite");
    statusNode.append(statusLabel);
    if (countdown)
      statusNode.append(
        el("span", ` · ${countdown.seconds} s`, "security-seconds"),
      );
    heading.append(el("h2", c.name || t(this.hass, "Alarmo")), statusNode);
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
      label.append(check, el("span", t(this.hass, "Bypass open sensors")));
      sensors.append(label);
    }
    const bypassed = new Set(ids(s?.attributes?.bypassed_sensors));
    const reported = new Set(
      [
        ...ids(s?.attributes?.open_sensors),
        ...(this.failedSensors || []),
      ].filter((id) => this.state(id)?.state !== "off"),
    );
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
        ? t(this.hass, "{count} sensors bypassed", { count: bypassed.size })
        : "",
      openings.length
        ? t(this.hass, "{count} openings open", { count: openings.length })
        : "",
      motion.length
        ? t(this.hass, "{count} motion active", { count: motion.length })
        : "",
      other.length
        ? t(this.hass, "{count} sensors open", { count: other.length })
        : "",
      unknown.length
        ? t(this.hass, "{count} sensors unavailable", { count: unknown.length })
        : "",
    ].filter(Boolean);
    const sensorStatusKnown =
      (rows.length > 0 || this.alarmoStatus === "ready") &&
      this.alarmoStatus !== "unavailable";
    if (!alerts.length) this.sensorsExpanded = false;
    const summary = el(
      alerts.length ? "button" : "div",
      undefined,
      `security-sensor-summary${!alerts.length && sensorStatusKnown && rows.length ? " clear" : ""}`,
    );
    if (alerts.length) {
      summary.type = "button";
      summary.dataset.key = "toggle-sensors";
      summary.setAttribute("aria-expanded", String(this.sensorsExpanded));
      summary.setAttribute("aria-controls", "security-sensor-details");
      event(summary, "click", () => {
        this.sensorsExpanded = !this.sensorsExpanded;
        this.update();
      });
    }

    summary.append(
      icon(
        alerts.length || !sensorStatusKnown
          ? "mdi:alert-circle-outline"
          : rows.length
            ? "mdi:check-circle-outline"
            : "mdi:information-outline",
      ),
      el(
        "span",
        [
          ...messages,
          ...(this.alarmoStatus === "unavailable"
            ? [t(this.hass, "Alarmo sensor list unavailable")]
            : []),
        ].join(" · ") ||
          (rows.length
            ? t(this.hass, "All monitored sensors clear")
            : this.alarmoStatus === "ready"
              ? t(this.hass, "No sensors enabled in Alarmo for this panel")
              : this.alarmoStatus === "unavailable"
                ? t(this.hass, "Alarmo sensor list unavailable")
                : !this.hass?.callWS
                  ? t(this.hass, "Alarmo sensor list unavailable")
                  : this.alarmoStatus === "not-alarmo"
                    ? t(this.hass, "No monitored sensors")
                    : t(this.hass, "Loading Alarmo sensors…")),
      ),
    );
    if (alerts.length) {
      const chevron = icon(
        this.sensorsExpanded ? "mdi:chevron-up" : "mdi:chevron-down",
      );
      chevron.classList.add("security-sensor-chevron");
      summary.append(chevron);
    }
    sensors.append(summary);
    if (alerts.length) {
      const chips = el("div", undefined, "security-chips");
      chips.id = "security-sensor-details";
      chips.hidden = !this.sensorsExpanded;
      for (const group of this.sensorGroups(alerts)) {
        const area = el("section", undefined, "security-sensor-area");
        area.setAttribute("aria-label", group.name);
        area.append(el("h3", group.name));
        const areaChips = el("div", undefined, "security-area-chips");
        for (const r of group.rows) {
          const suffix = bypassed.has(r.entity)
            ? "bypassed"
            : !available(this.state(r.entity))
              ? "unavailable"
              : r.kind === "motion"
                ? "motion detected"
                : "open";
          const chip = button(
            this.sensorLabel(r),
            () => details(this, r.entity),
            { key: r.entity, entity: r.entity },
          );
          chip.setAttribute(
            "aria-label",
            `${this.sensorLabel(r)}: ${t(this.hass, suffix)}`,
          );
          const glyph = el("ha-state-icon");
          glyph.dataset.sensor = r.entity;
          glyph.setAttribute("aria-hidden", "true");
          glyph.setAttribute("data-native", "");
          const label = el("span", this.sensorLabel(r), "security-chip-label");
          if (suffix === "bypassed" || suffix === "unavailable")
            label.append(document.createTextNode(` · ${t(this.hass, suffix)}`));
          const content = el("span", undefined, "security-chip-content");
          content.append(glyph, label);
          chip.replaceChildren(content);
          areaChips.append(chip);
        }
        area.append(areaChips);
        chips.append(area);
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
    selector.setAttribute("aria-label", t(this.hass, "Alarm mode"));
    const disarmed = button(
      t(this.hass, "Disarmed"),
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
        t(this.hass, label[0].toUpperCase() + label.slice(1)),
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
    if (live && s.state !== "disarmed") result.append(this.pinView());
    else if (live && this.armIntent) result.append(this.pinView(true));
    if (c.show_activity) result.append(this.activity.view());
    return result;
  }
}
