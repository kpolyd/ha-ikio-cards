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
  static getStubConfig() {
    return { schema_version: 1, maintenance: [], missions: [] };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-cleaning-card-editor");
  }
  render() {
    const c = this.config,
      s = this.state(),
      a = s?.attributes || {};
    if (!c.entity) return note("Choose a vacuum in the visual editor.");
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
    const action = primary(s),
      controls = [];
    if (action)
      controls.push(
        button(
          action.label,
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
            ? "Returning to dock"
            : stateText(this.hass, c.entity),
        ),
      );
    if (features(s, 16) && !["docked", "returning"].includes(s?.state))
      controls.push(
        button(
          "Return to dock",
          () =>
            this.send(c.entity, "vacuum", "return_to_base", {}, (state) =>
              ["returning", "docked"].includes(state?.state),
            ),
          { icon: "mdi:home-import-outline", disabled: this.blocked(c.entity) },
        ),
      );
    if (features(s, 32) && a.fan_speed_list?.length) {
      const suction = select(
        "Suction power",
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
      controls.push(suction);
    }
    result.append(row(...controls));
    if (c.status_entity)
      result.append(note(valueText(this.hass, c.status_entity)));
    if (a.error) result.append(note(String(a.error), "ae-warn"));
    if (c.maintenance?.length || c.missions?.length) {
      const extras = el("details");
      extras.append(el("summary", "Maintenance and missions"));
      for (const item of c.maintenance || [])
        if (item.entity)
          extras.append(
            note(
              `${item.name || this.label(item.entity)}: ${valueText(this.hass, item.entity)}`,
            ),
          );
      for (const item of c.missions || [])
        if (item.entity)
          extras.append(
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
