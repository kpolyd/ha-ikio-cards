import {
  ControlCard,
  group,
  row,
  title,
  reading,
  note,
  button,
  valueText,
  stateText,
  available,
} from "@ikio/card-ui";
import { validate } from "./config.js";
export class Card extends ControlCard {
  validate = validate;
  static getStubConfig() {
    return { schema_version: 1, timed_runs: [] };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-appliance-card-editor");
  }
  onVisibility() {
    clearInterval(this.clock);
    this.timerRunning =
      this.visible &&
      this.isConnected &&
      (this.config?.timed_runs || []).some(
        (run) => this.state(run.timer_entity)?.state === "active",
      );
    if (this.timerRunning) this.clock = setInterval(() => this.update(), 15000);
  }
  afterRender() {
    const active =
      this.visible &&
      this.isConnected &&
      (this.config?.timed_runs || []).some(
        (run) => this.state(run.timer_entity)?.state === "active",
      );
    if (active !== this.timerRunning) this.onVisibility();
  }
  onDisconnect() {
    clearInterval(this.clock);
    this.timerRunning = false;
  }
  render() {
    const c = this.config;
    if (!c.entity)
      return note("Choose an appliance switch in the visual editor.");
    const result = group(
      title(
        this,
        c.name || this.label(c.entity),
        c.entity,
        stateText(this.hass, c.entity),
      ),
    );
    result.append(
      row(
        ...["power", "energy"]
          .filter((k) => c[k + "_entity"])
          .map((k) =>
            reading(
              k === "power" ? "Power" : "Energy",
              valueText(this.hass, c[k + "_entity"]),
              c[k + "_entity"],
            ),
          ),
      ),
    );
    const actions = row();
    result.append(actions);
    for (const run of c.timed_runs || []) {
      if (!run.start_script) continue;
      actions.append(
        button(
          run.label || "Start timed run",
          () => this.action(run.start_script, run.label),
          { disabled: this.blocked(run.start_script) },
        ),
      );
      if (run.timer_entity) {
        const timer = this.state(run.timer_entity),
          finish = Date.parse(timer?.attributes?.finishes_at);
        const value =
          timer?.state === "active" && Number.isFinite(finish)
            ? `${Math.max(0, Math.ceil((finish - Date.now()) / 60000))} min remaining`
            : stateText(this.hass, run.timer_entity);
        result.append(reading(run.label || "Timer", value, run.timer_entity));
      }
    }
    actions.append(
      button(
        this.state()?.state === "on" ? "Turn off" : "Turn on",
        () => {
          if (c.confirm_manual_on && this.state()?.state !== "on")
            this.dialog(
              "Turn on appliance",
              [
                note(
                  "Manual operation does not schedule an automatic shutoff.",
                ),
              ],
              () => this.toggle(c.entity),
            );
          else this.toggle(c.entity);
        },
        { icon: "mdi:power", disabled: this.blocked(c.entity) },
      ),
    );
    if (c.stop_script)
      actions.append(
        button("Stop run", () => this.action(c.stop_script, "Stop run"), {
          disabled: this.blocked(c.stop_script),
        }),
      );
    if (c.timed_runs?.length)
      result.append(
        note(
          "Timed shutoff runs in Home Assistant. Manual off does not cancel a backend schedule.",
        ),
      );
    return result;
  }
}
