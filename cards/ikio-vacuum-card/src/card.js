import { t } from "@ikio/card-ui/i18n";
import { installRefinement, refine, disclosure } from "@ikio/card-ui";
import {
  ControlCard,
  group,
  row,
  title,
  note,
  features,
  button,
  select,
  valueText,
  stateText,
  el,
} from "@ikio/card-ui";
import { validate } from "./config.js";
import { primary } from "./adapter.js";
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    installRefinement(this);
  }
  static getStubConfig() {
    return { schema_version: 1, maintenance: [], missions: [] };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-vacuum-card-editor");
  }
  render() {
    const c = this.config,
      s = this.state(),
      a = s?.attributes || {};
    if (!c.entity)
      return note(t(this.hass, "Choose a vacuum in the visual editor."));
    const battery = c.battery_entity
      ? valueText(this.hass, c.battery_entity)
      : Number.isFinite(a.battery_level)
        ? `${a.battery_level}%`
        : "";
    const result = group(
      title(
        this,
        c.name || this.label(c.entity),
        c.entity,
        [stateText(this.hass, c.entity), battery].filter(Boolean).join(" · "),
      ),
    );
    refine(result, "mdi:robot-vacuum");
    const action = primary(s),
      controls = [];
    if (action)
      controls.push(
        button(
          t(this.hass, action.label),
          () =>
            this.send(c.entity, "vacuum", action.service, {}, (state) =>
              action.service === "start"
                ? state?.state === "cleaning"
                : action.service === "pause"
                  ? state?.state === "paused"
                  : state?.state === "idle",
            ),
          { icon: action.icon, disabled: this.blocked(c.entity) },
        ),
      );
    else
      controls.push(
        note(
          s?.state === "returning"
            ? t(this.hass, "Returning to dock")
            : stateText(this.hass, c.entity),
        ),
      );
    if (features(s, 16) && !["docked", "returning"].includes(s?.state))
      controls.push(
        button(
          t(this.hass, "Return to dock"),
          () =>
            this.send(c.entity, "vacuum", "return_to_base", {}, (state) =>
              ["returning", "docked"].includes(state?.state),
            ),
          { icon: "mdi:home-import-outline", disabled: this.blocked(c.entity) },
        ),
      );
    if (features(s, 32) && a.fan_speed_list?.length) {
      const suction = select(
        t(this.hass, "Suction power"),
        a.fan_speed_list,
        a.fan_speed,
        (v) =>
          this.send(
            c.entity,
            "vacuum",
            "set_fan_speed",
            { fan_speed: v },
            (state) => state?.attributes?.fan_speed === v,
          ),
      );
      suction.querySelector("select").disabled = this.blocked(c.entity);
      result.append(suction);
    }
    const actionRow = row(...controls);
    if (action) {
      const primaryControl = actionRow.firstElementChild;
      primaryControl.classList.remove("ae-icon");
      primaryControl.classList.add("ikio-primary", "ikio-labelled-action");
      primaryControl.append(el("span", t(this.hass, action.label)));
    }
    const taskRow = row(actionRow);
    taskRow.classList.add("ikio-vacuum-controls");
    const suction = result.querySelector(".ae-select");
    if (suction) taskRow.append(suction);
    result.insertBefore(taskRow, result.children[1] || null);
    if (c.status_entity)
      result.append(note(valueText(this.hass, c.status_entity)));
    if (a.error) result.append(note(String(a.error), "ae-warn"));
    if (c.maintenance?.length || c.missions?.length) {
      const extras = disclosure(
        this,
        "cleaning-extras",
        t(this.hass, "Maintenance and missions"),
      );
      const body = extras.querySelector(".ikio-disclosure-body");
      for (const item of c.maintenance || [])
        if (item.entity)
          body.append(
            note(
              `${item.name || this.label(item.entity)}: ${valueText(this.hass, item.entity)}`,
            ),
          );
      for (const item of c.missions || [])
        if (item.entity)
          body.append(
            button(
              item.label || this.label(item.entity),
              () => this.action(item.entity, item.label),
              { disabled: this.blocked(item.entity) },
            ),
          );
      result.append(extras);
    }
    return result;
  }
}
