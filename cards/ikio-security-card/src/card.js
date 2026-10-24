import {
  ControlCard,
  group,
  row,
  title,
  reading,
  note,
  button,
  features,
  stateText,
  el,
  available,
  details,
} from "@ikio/card-ui";
import { validate } from "./config.js";
import { alarmModes, blockedContacts, forceData } from "./adapter.js";
export class Card extends ControlCard {
  validate = validate;
  static getStubConfig() {
    return {
      schema_version: 1,
      modes: ["home", "away"],
      confirm_arm: true,
      allow_override: true,
      persons: [],
      contacts: [],
      motion: [],
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-security-card-editor");
  }
  onVisibility() {
    clearInterval(this.clock);
    this.clockState = ["arming", "pending"].includes(this.state()?.state)
      ? "delay"
      : this.config?.motion?.length
        ? "motion"
        : "idle";
    if (this.isConnected && this.visible && this.clockState !== "idle")
      this.clock = setInterval(
        () => this.update(),
        this.clockState === "delay" ? 1000 : 60000,
      );
  }
  afterRender() {
    const key = ["arming", "pending"].includes(this.state()?.state)
      ? "delay"
      : this.config?.motion?.length
        ? "motion"
        : "idle";
    if (key !== this.clockState) this.onVisibility();
  }
  onDisconnect() {
    clearInterval(this.clock);
  }
  arm(mode, force = false) {
    if (this.blocked(this.config.entity)) return;
    const s = this.state(),
      needsCode = s.attributes?.code_arm_required === true;
    const submit = (code = "") =>
      this.send(
        this.config.entity,
        force ? "alarmo" : "alarm_control_panel",
        force ? "arm" : `alarm_arm_${mode}`,
        force
          ? forceData(this.config.entity, mode, code)
          : { ...(code ? { code } : {}) },
        (state) =>
          state?.state === "arming" || state?.state === `armed_${mode}`,
      );
    if (!force && !needsCode && this.config.confirm_arm === false)
      return submit();
    const rows = [
      note(
        `${force ? "Bypass open sensors and arm" : "Arm"} ${mode.replaceAll("_", " ")}?`,
      ),
    ];
    const affected =
      force && s.attributes?.open_sensors
        ? Object.keys(s.attributes.open_sensors)
        : (this.config.contacts || [])
            .filter((r) => this.state(r.entity)?.state !== "off")
            .map((r) => r.entity);
    for (const id of affected)
      rows.push(
        note(`${this.label(id)}: ${stateText(this.hass, id)}`, "ae-warn"),
      );
    if (force)
      rows.push(
        note(
          "The listed open sensors will be bypassed for this arming. Required codes and normal exit delay still apply.",
        ),
      );
    let input;
    if (needsCode) {
      const label = el("label", "Arming code");
      input = el("input");
      input.type =
        s.attributes?.code_format === "number" ? "password" : "password";
      input.inputMode =
        s.attributes?.code_format === "number" ? "numeric" : "text";
      input.autocomplete = "off";
      input.setAttribute("aria-label", "Arming code");
      label.append(input);
      rows.push(label);
    }
    this.dialog(force ? "Arm anyway" : "Arm alarm", rows, async () => {
      const code = input?.value || "";
      if (needsCode && !code) throw Error("Enter the required arming code");
      if (input) input.value = "";
      await submit(code);
    });
  }
  render() {
    const c = this.config,
      s = this.state();
    if (!c.entity) return note("Choose an alarm panel in the visual editor.");
    const result = group(
      title(
        this,
        c.name || "Home security",
        c.entity,
        stateText(this.hass, c.entity),
      ),
      row(
        ...(c.persons || [])
          .filter((r) => r.entity)
          .map((r) =>
            reading(
              r.name || this.label(r.entity),
              stateText(this.hass, r.entity),
              r.entity,
            ),
          ),
      ),
    );
    const contacts = (c.contacts || []).filter((r) => r.entity),
      blocked = blockedContacts(contacts, this.hass?.states || {});
    if (!contacts.length) result.append(note("No contacts selected"));
    else if (blocked.length)
      result.append(
        note(
          blocked
            .map(
              (r) =>
                `${r.name || this.label(r.entity)}: ${stateText(this.hass, r.entity)}`,
            )
            .join(" · "),
          "ae-warn",
        ),
      );
    else result.append(note("All selected openings closed"));
    const modes = alarmModes.filter(
      (m) =>
        features(s, m.flag) && (c.modes || ["home", "away"]).includes(m.mode),
    );
    if (s?.state === "disarmed")
      result.append(
        row(
          ...modes.map((m) =>
            button(
              `Arm ${m.mode.replaceAll("_", " ")}`,
              () => this.arm(m.mode),
              { disabled: this.blocked(c.entity) },
            ),
          ),
        ),
      );
    else if (s && available(s))
      result.append(
        button(
          "Disarm",
          () => {
            if (s.attributes?.code_format) details(this, c.entity);
            else
              this.send(
                c.entity,
                "alarm_control_panel",
                "alarm_disarm",
                {},
                (state) => state?.state === "disarmed",
              );
          },
          { icon: "mdi:shield-off-outline", disabled: this.blocked(c.entity) },
        ),
      );
    const openReported =
      Object.keys(s?.attributes?.open_sensors || {}).length > 0;
    const hasAlarmo = !!this.hass?.services?.alarmo?.arm;
    if (
      c.allow_override !== false &&
      s?.state === "disarmed" &&
      (blocked.some((r) => this.state(r.entity)?.state === "on") ||
        openReported) &&
      hasAlarmo
    )
      result.append(
        row(
          ...modes.map((m) =>
            button(`Arm ${m.mode} anyway`, () => this.arm(m.mode, true), {
              disabled: this.blocked(c.entity),
            }),
          ),
        ),
      );
    const bypassed = s?.attributes?.bypassed_sensors || [];
    if (bypassed.length) {
      const b = button(
        `${bypassed.length} sensor${bypassed.length === 1 ? "" : "s"} bypassed`,
        () =>
          this.dialog(
            "Bypassed sensors",
            bypassed.map((id) => note(this.label(id))),
          ),
      );
      b.classList.add("ae-warn");
      result.append(b);
    }
    if (s?.state === "triggered")
      result.append(note("ALARM TRIGGERED", "ae-warn"));
    if (s?.attributes?.delay && ["arming", "pending"].includes(s.state))
      result.append(
        note(`${s.state}: configured delay ${s.attributes.delay} seconds`),
      );
    for (const motion of c.motion || []) {
      const state = this.state(motion.entity);
      const age = Date.parse(state?.last_changed);
      if (motion.entity)
        result.append(
          reading(
            motion.name || this.label(motion.entity),
            `${stateText(this.hass, motion.entity)}${Number.isFinite(age) ? ` · ${Math.max(0, Math.floor((Date.now() - age) / 60000))} min ago` : ""}`,
            motion.entity,
          ),
        );
    }
    return result;
  }
}
