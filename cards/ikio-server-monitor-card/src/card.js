import { t } from "@ikio/card-ui/i18n";
import {
  installRefinement,
  chipStyles,
  sensorChip,
  updateChipIcons,
  glyph,
  refine,
  disclosure,
  requestReview,
  reviewView,
} from "@ikio/card-ui";
import {
  ControlCard,
  group,
  title,
  reading,
  note,
  button,
  valueText,
  numeric,
  formatNumber,
  el,
  stateText,
  details,
} from "@ikio/card-ui";
import { validate, migrateConfig } from "./config.js";
import { graphPalette } from "@ikio/graph";
import {
  utilization,
  capacityText,
  metricLevel,
  serviceHealth,
  uptimeSeconds,
  uptimeLabel,
  rateFactor,
  availabilityLabel,
} from "./adapter.js";
import { systemStyles, ringReading, networkPlot } from "./views.js";
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    installRefinement(this);
    this.shadowRoot.append(el("style", systemStyles + chipStyles));
  }
  setConfig(config) {
    super.setConfig(migrateConfig(config));
  }
  static getStubConfig() {
    return {
      schema_version: 1,
      services: [],
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-server-monitor-card-editor");
  }
  onConfig() {
    this.stopNetwork();
    this.network = {};
    this.networkError = "";
    this.networkConnection = undefined;
    this.onVisibility();
  }
  onVisibility() {
    clearInterval(this.clock);
    if (!this.visible) this.stopNetwork();
    if (this.isConnected && this.visible) {
      this.loadNetwork();
      this.clock = setInterval(() => {
        this.loadNetwork();
        this.update();
      }, 60000);
    }
  }
  onDisconnect() {
    clearInterval(this.clock);
    this.stopNetwork();
  }
  afterRender() {
    updateChipIcons(this);
    this.loadNetwork();
  }
  networkRows() {
    return [
      ["network_rx", "Download"],
      ["network_tx", "Upload"],
    ]
      .filter(([key]) => this.config?.[key + "_entity"])
      .map(([key, label]) => ({
        key,
        label,
        entity: this.config[key + "_entity"],
        unit: this.state(this.config[key + "_entity"])?.attributes
          ?.unit_of_measurement,
      }));
  }
  stopNetwork() {
    this.networkRequest = (this.networkRequest || 0) + 1;
    this.cancelNetwork?.();
    this.cancelNetwork = undefined;
    this.networkLoading = false;
    this.networkChecked = undefined;
  }
  async loadNetwork() {
    const rows = this.networkRows().filter(
      (row) => rateFactor(row.unit) !== null,
    );
    if (
      !rows.length ||
      !this.hass?.callWS ||
      !this.visible ||
      !this.isConnected ||
      this.preview
    )
      return;
    const connection = this.hass.connection;
    if (this.networkConnection && this.networkConnection !== connection) {
      this.stopNetwork();
      this.network = {};
      this.networkError = "";
    }
    this.networkConnection = connection;
    if (
      this.networkLoading ||
      (this.networkChecked !== undefined &&
        Date.now() - this.networkChecked < 60000)
    )
      return;
    this.networkLoading = true;
    const request = (this.networkRequest = (this.networkRequest || 0) + 1);
    const revision = this.revision;
    const valid = () =>
      request === this.networkRequest &&
      revision === this.revision &&
      this.visible &&
      this.isConnected &&
      !this.preview &&
      this.hass?.connection === connection;
    let timer;
    const cancelled = new Promise((_, reject) => {
      this.cancelNetwork = () => reject(new Error("Cancelled"));
      timer = setTimeout(() => reject(new Error("History timed out")), 5000);
    });
    const now = Date.now();
    try {
      const data = await Promise.race([
        this.hass.callWS({
          type: "history/history_during_period",
          start_time: new Date(now - 1800000).toISOString(),
          end_time: new Date(now).toISOString(),
          entity_ids: [...new Set(rows.map((row) => row.entity))],
          include_start_time_state: true,
          significant_changes_only: false,
          minimal_response: false,
          no_attributes: false,
        }),
        cancelled,
      ]);
      if (!valid()) return;
      this.network = data;
      this.networkError = "";
    } catch {
      if (valid())
        this.networkError =
          "Network history unavailable. Live speeds remain visible.";
    } finally {
      clearTimeout(timer);
      if (valid()) {
        this.networkLoading = false;
        this.cancelNetwork = undefined;
        this.networkChecked = Date.now();
        this.update();
      }
    }
  }
  networkView() {
    const rows = this.networkRows();
    if (!rows.length) return null;
    const section = el("div", undefined, "system-network");
    const palette = graphPalette(this.config.appearance?.theme, this.hass);
    section.style.setProperty("--ae-network-download", palette[0][1]);
    section.style.setProperty("--ae-network-upload", palette.at(-1)[1]);
    const legend = el("div", undefined, "system-network-legend");
    for (const row of rows) {
      const entry = reading(
        t(this.hass, row.label),
        valueText(this.hass, row.entity),
        row.entity,
      );
      const key = el(
        "span",
        undefined,
        `system-network-key ${row.key === "network_tx" ? "upload" : ""}`,
      );
      key.setAttribute("aria-hidden", "true");
      entry.prepend(key);
      legend.append(entry);
    }
    section.append(legend);
    const compatible = rows.filter((row) => rateFactor(row.unit) !== null);
    const plot = networkPlot(compatible, this.network, Date.now(), this.hass);
    if (plot) {
      section.append(plot);
      const times = el("div", undefined, "system-network-times");
      times.append(
        el("span", t(this.hass, "−30 min")),
        el("span", t(this.hass, "Now")),
      );
      section.append(times);
    } else
      section.append(
        note(
          this.networkLoading
            ? t(this.hass, "Loading network history…")
            : t(this.hass, this.networkError) ||
                (this.hass?.callWS
                  ? t(this.hass, "No network history yet")
                  : t(this.hass, "Network history unavailable")),
        ),
      );
    if (plot && this.networkError)
      section.append(note(t(this.hass, this.networkError)));
    for (const row of rows)
      if (rateFactor(row.unit) === null)
        section.append(
          note(
            t(
              this.hass,
              "{p0}: select a rate sensor (for example MB/s or Mbit/s).",
              { p0: row.label },
            ),
            "ae-warn",
          ),
        );
    return section;
  }
  render() {
    const c = this.config;
    if (!this.entityIds.length)
      return note(t(this.hass, "Choose system metrics in the visual editor."));
    const availability = this.state(c.availability_entity);
    const uptimeState = this.state(c.uptime_entity);
    const seconds = uptimeSeconds(uptimeState);
    const status = c.availability_entity
      ? availabilityLabel(availability)
      : seconds !== null
        ? "Online"
        : c.uptime_entity
          ? uptimeState?.state === "unavailable"
            ? "Offline"
            : "Unknown"
          : undefined;
    const uptime = uptimeLabel(
      seconds,
      this.hass?.locale?.language || this.hass?.language || "en",
    );
    const headline = status === "Online" ? uptime || status : status || uptime;
    const result = group(
      title(
        this,
        c.name || t(this.hass, "Server Monitor"),
        c.availability_entity,
      ),
    );
    refine(result, "mdi:server-outline");
    result.classList.add("ikio-server-monitor");
    const header = result.querySelector("header"),
      meta = el("div", undefined, "system-header-meta");
    if (c.temperature_entity) {
      const temperature = button(
        valueText(this.hass, c.temperature_entity),
        () => details(this, c.temperature_entity),
        { entity: c.temperature_entity, key: "header-temperature" },
      );
      temperature.setAttribute(
        "aria-label",
        t(this.hass, "System temperature: {p0}", {
          p0: valueText(this.hass, c.temperature_entity),
        }),
      );
      temperature.prepend(glyph("mdi:thermometer"));
      meta.append(temperature);
    }
    if (headline) {
      const statusNode = el("div", undefined, "system-status");
      if (
        status === "Online" ||
        status === "Offline" ||
        status === "Unavailable"
      ) {
        const dot = el(
          "span",
          undefined,
          status === "Online" ? "system-online-dot" : "system-offline-dot",
        );
        dot.setAttribute("aria-hidden", "true");
        statusNode.append(dot);
      }
      if (uptime && headline === uptime) {
        const uptimeButton = button(
          headline,
          () => details(this, c.uptime_entity),
          { entity: c.uptime_entity, key: "header-uptime" },
        );
        uptimeButton.setAttribute(
          "aria-label",
          t(this.hass, "Uptime: {p0}", { p0: headline }),
        );
        statusNode.append(uptimeButton);
      } else statusNode.append(el("span", t(this.hass, headline)));
      meta.append(statusNode);
    }
    header.append(meta);
    const extraReadings = (c.extra_readings || []).filter((row) => row.entity);
    if (extraReadings.length) {
      const chips = el("div", undefined, "system-extra-readings");
      chips.setAttribute("aria-label", t(this.hass, "Extra readings"));
      extraReadings.forEach((row, index) =>
        chips.append(sensorChip(this, row, `extra-reading-${index}`)),
      );
      result.append(chips);
    }
    const measured = { temperature: numeric(this.state(c.temperature_entity)) };
    const resources = el("div", undefined, "ikio-resources");
    result.append(resources);
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
              this.state(c[metric + "_free_entity"]),
            );
      if (
        id ||
        c[metric + "_used_entity"] ||
        c[metric + "_total_entity"] ||
        c[metric + "_free_entity"]
      ) {
        const label = t(
            this.hass,
            metric === "disk" ? "Disk" : metric.toUpperCase(),
          ),
          capacity =
            metric !== "cpu" && c[metric + "_used_entity"]
              ? capacityText(
                  this.hass,
                  this.state(c[metric + "_used_entity"]),
                  this.state(c[metric + "_total_entity"]),
                  this.state(c[metric + "_free_entity"]),
                )
              : "";
        const resource = group();
        resource.classList.add("ikio-resource");
        resources.append(resource);
        const key = metric === "cpu" ? "cpu" : metric + "_percent";
        measured[key] = percent;
        const level = metricLevel(percent);
        resource.append(
          ringReading(
            label,
            percent,
            id || c[metric + "_used_entity"],
            level,
            this.hass,
            metric === "cpu" ? 1 : 0,
          ),
        );
        if (capacity) resource.append(note(capacity));
        if (percent !== null && (percent < 0 || percent > 100))
          resource.append(
            note(
              t(this.hass, "{p0} measurement outside 0–100%", { p0: label }),
              "ae-warn",
            ),
          );
      }
    }
    const network = this.networkView();
    if (network) result.append(network);
    for (const [metric, value] of Object.entries(measured)) {
      const level = metricLevel(value);
      if (level)
        result.append(
          note(
            t(this.hass, "{p0}: {p1} threshold reached ({p2})", {
              p0: metric,
              p1: level === "critical" ? "error" : "warning",
              p2: formatNumber(this.hass, value),
            }),
            level === "critical" ? "system-error-note" : "ae-warn",
          ),
        );
    }
    const services = [];
    const serviceGrid = el("div", undefined, "system-service-grid");
    for (const [index, service] of (c.services || []).entries()) {
      const name = service.name || t(this.hass, "Service");
      const statusId = service.status_entity || service.control_entity;
      const health = serviceHealth(this.state(statusId));
      const block = el(
        "div",
        undefined,
        `system-service ${health.level}`,
        `service-${index}`,
      );
      const identity = statusId
        ? button("", () => details(this, statusId), {
            entity: statusId,
            key: `service-details-${index}`,
          })
        : el("div");
      identity.classList.add("system-service-identity");
      identity.setAttribute(
        "aria-label",
        `${name}: ${t(this.hass, health.text)}`,
      );
      const dot = el("span", undefined, "system-service-dot");
      dot.setAttribute("aria-hidden", "true");
      const caption = el("span", undefined, "system-service-caption");
      caption.append(el("span", name, "system-service-name"));
      if (health.level !== "running")
        caption.append(
          el("span", t(this.hass, health.text), "system-service-state"),
        );
      identity.replaceChildren(dot, caption);
      block.append(identity);
      const controls = el("div", undefined, "system-service-controls");
      if (service.control_entity) {
        const power = button(
          t(this.hass, "Power {p0}: {p1}", {
            p0: name,
            p1: stateText(this.hass, service.control_entity),
          }),
          () => this.toggle(service.control_entity),
          {
            icon: "mdi:power",
            entity: service.control_entity,
            key: `service-power-${index}`,
            disabled: this.blocked(service.control_entity),
          },
        );
        controls.append(power);
      }
      if (service.restart_action) {
        const restart = button(
          t(this.hass, "Restart {p0}", { p0: name }),
          () =>
            requestReview(
              this,
              service.restart_action,
              t(this.hass, "Restart {p0}", { p0: name }),
              t(
                this.hass,
                "The service may be temporarily unavailable while restarting.",
              ),
              () => this.action(service.restart_action, `Restart ${name}`),
            ),
          {
            icon: "mdi:restart",
            entity: service.restart_action,
            key: `service-restart-${index}`,
            disabled: this.blocked(service.restart_action),
          },
        );
        controls.append(restart);
      }
      if (controls.childElementCount) {
        block.append(controls);
        if (controls.childElementCount > 1)
          block.classList.add("multiple-controls");
      }
      serviceGrid.append(block);
    }
    const serviceCount = serviceGrid.childElementCount;
    if (serviceCount) services.push(serviceGrid);
    if (services.length) {
      const footer = disclosure(
        this,
        "system-services",
        serviceCount
          ? t(this.hass, "Services · {p0}", { p0: serviceCount })
          : t(this.hass, "System details"),
        ...services,
      );
      footer.classList.add("system-footer");
      footer.querySelector("summary").append(glyph("mdi:chevron-down"));
      result.append(footer);
    }
    if (this.review) result.append(reviewView(this));
    return result;
  }
}
