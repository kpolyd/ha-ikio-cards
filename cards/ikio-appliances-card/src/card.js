import {
  installRefinement,
  refine,
  requestReview,
  reviewView,
} from "@ikio/card-ui";
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
  constructor() {
    super();
    installRefinement(this);
  }
  static getStubConfig() {
    return { schema_version: 1, timed_runs: [] };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-appliances-card-editor");
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
    refine(result, "mdi:power-plug-outline");
    const measurements = row(
      ...["power", "energy"]
        .filter((k) => c[k + "_entity"])
        .map((k) =>
          reading(
            k === "power" ? "Power" : "Energy",
            valueText(this.hass, c[k + "_entity"]),
            c[k + "_entity"],
          ),
        ),
    );
    result.append(measurements);
    const actions = row();
    const actionBar = row(actions);
    actionBar.classList.add("ikio-action-bar");
    result.append(actionBar);
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
        measurements.append(
          reading(run.label || "Timer", value, run.timer_entity),
        );
      }
    }
    const manual = row();
    manual.append(
      button(
        this.state()?.state === "on" ? "Turn off" : "Turn on",
        () => {
          if (c.confirm_manual_on && this.state()?.state !== "on")
            requestReview(
              this,
              c.entity,
              "Turn on appliance",
              "Manual operation does not schedule an automatic shutoff.",
              () => {
                if (this.state()?.state !== "on") this.toggle(c.entity);
              },
            );
          else this.toggle(c.entity);
        },
        { icon: "mdi:power", disabled: this.blocked(c.entity) },
      ),
    );
    if (c.stop_script)
      manual.append(
        button("Stop run", () => this.action(c.stop_script, "Stop run"), {
          disabled: this.blocked(c.stop_script),
        }),
      );
    if (actions.children.length) {
      actions.setAttribute("aria-label", "Timed runs");
      actions.firstElementChild?.classList.add("ikio-primary");
    }
    actionBar.append(manual);
    if (this.review && this.state()?.state === "on") this.review = undefined;
    if (this.review) result.append(reviewView(this));
    if (c.timed_runs?.length)
      result.append(
        note("Turning off manually does not cancel a scheduled timed run."),
      );
    return result;
  }
}
