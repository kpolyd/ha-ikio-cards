import {
  ControlCard,
  group,
  title,
  row,
  reading,
  note,
  button,
  valueText,
  numeric,
  formatNumber,
  el,
  stateText,
  available,
} from "@ikio/card-ui";
import { validate } from "./config.js";
import { utilization, threshold } from "./adapter.js";
export class Card extends ControlCard {
  validate = validate;
  static getStubConfig() {
    return {
      schema_version: 1,
      online_state: "on",
      uptime_mode: "duration",
      services: [],
      thresholds: [],
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-system-card-editor");
  }
  onVisibility() {
    clearInterval(this.clock);
    if (this.isConnected && this.visible)
      this.clock = setInterval(() => this.update(), 60000);
  }
  onDisconnect() {
    clearInterval(this.clock);
  }
  render() {
    const c = this.config;
    if (!this.entityIds.length)
      return note("Choose system metrics in the visual editor.");
    const availability = this.state(c.availability_entity);
    const status = c.availability_entity
      ? available(availability)
        ? availability.state === (c.online_state || "on")
          ? "Online"
          : "Offline"
        : stateText(this.hass, c.availability_entity)
      : undefined;
    const result = group(
      title(this, c.name || "System", c.availability_entity, status),
    );
    const metrics = row();
    if (c.temperature_entity)
      metrics.append(
        reading(
          "Temperature",
          valueText(this.hass, c.temperature_entity),
          c.temperature_entity,
        ),
      );
    if (c.uptime_entity) {
      let uptime = valueText(this.hass, c.uptime_entity);
      if (c.uptime_mode === "timestamp") {
        const start = Date.parse(this.state(c.uptime_entity)?.state);
        uptime =
          Number.isFinite(start) && start <= Date.now()
            ? `${formatNumber(this.hass, (Date.now() - start) / 3600000, 1)} hours`
            : "Unknown";
      }
      metrics.append(reading("Uptime", uptime, c.uptime_entity));
    }
    result.append(metrics);
    for (const metric of ["cpu", "ram", "disk"]) {
      const id =
        c[(metric === "cpu" ? "cpu" : metric + "_percent") + "_entity"];
      const percent =
        metric === "cpu"
          ? this.state(id)?.attributes?.unit_of_measurement === "%"
            ? numeric(this.state(id))
            : null
          : utilization(
              this.state(id),
              this.state(c[metric + "_used_entity"]),
              this.state(c[metric + "_total_entity"]),
            );
      if (id || c[metric + "_used_entity"] || c[metric + "_total_entity"]) {
        const label = metric.toUpperCase(),
          capacity =
            metric !== "cpu" && c[metric + "_used_entity"]
              ? `${valueText(this.hass, c[metric + "_used_entity"])} / ${valueText(this.hass, c[metric + "_total_entity"])}`
              : "";
        result.append(
          reading(
            label,
            [
              capacity,
              percent === null ? "" : `${formatNumber(this.hass, percent, 1)}%`,
            ]
              .filter(Boolean)
              .join(" · ") || valueText(this.hass, id),
            id || c[metric + "_used_entity"],
          ),
        );
        if (percent !== null) {
          const progress = el("progress", undefined, "ae-progress");
          progress.max = 100;
          progress.value = Math.max(0, Math.min(100, percent));
          progress.setAttribute("aria-label", `${label} ${percent}%`);
          result.append(progress);
          if (percent < 0 || percent > 100)
            result.append(
              note(`${label} measurement outside 0–100%`, "ae-warn"),
            );
        }
      }
    }
    for (const [key, label] of [
      ["database", "Database"],
      ["network_rx", "Network RX"],
      ["network_tx", "Network TX"],
    ])
      if (c[key + "_entity"]) {
        const state = this.state(c[key + "_entity"]),
          unit = state?.attributes?.unit_of_measurement || "";
        result.append(
          reading(
            label,
            valueText(this.hass, c[key + "_entity"]),
            c[key + "_entity"],
          ),
        );
        if (
          key.startsWith("network") &&
          available(state) &&
          !/(\/s|bps|bit\/s)$/i.test(unit)
        )
          result.append(
            note(
              `${label}: selected entity is not a recognized rate sensor.`,
              "ae-warn",
            ),
          );
      }
    for (const rule of c.thresholds || []) {
      const value = numeric(this.state(c[rule.metric + "_entity"])),
        level = threshold(value, rule);
      if (level)
        result.append(
          note(
            `${rule.metric}: ${level} threshold reached (${formatNumber(this.hass, value)})`,
            "ae-warn",
          ),
        );
    }
    for (const service of c.services || []) {
      const block = group(note(service.name || "Service"));
      if (service.status_entity)
        block.append(
          reading(
            "Health",
            stateText(this.hass, service.status_entity),
            service.status_entity,
          ),
        );
      if (service.control_entity)
        block.append(
          button(
            `Power: ${stateText(this.hass, service.control_entity)}`,
            () => this.toggle(service.control_entity),
            {
              icon: "mdi:power",
              disabled: this.blocked(service.control_entity),
            },
          ),
        );
      if (service.restart_action)
        block.append(
          button(
            "Restart",
            () =>
              this.action(
                service.restart_action,
                `Restart ${service.name || "service"}`,
                true,
              ),
            {
              icon: "mdi:restart",
              disabled: this.blocked(service.restart_action),
            },
          ),
        );
      result.append(block);
    }
    return result;
  }
}
