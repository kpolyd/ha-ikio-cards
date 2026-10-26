import {
  installRefinement,
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
import { validate } from "./config.js";
import { graphPalette } from "@ikio/graph";
import {
  utilization,
  metricLevel,
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
    this.shadowRoot.append(el("style", systemStyles));
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
        row.label,
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
      times.append(el("span", "−30 min"), el("span", "Now"));
      section.append(times);
    } else
      section.append(
        note(
          this.networkLoading
            ? "Loading network history…"
            : this.networkError ||
                (this.hass?.callWS
                  ? "No network history yet"
                  : "Network history unavailable"),
        ),
      );
    if (plot && this.networkError) section.append(note(this.networkError));
    for (const row of rows)
      if (rateFactor(row.unit) === null)
        section.append(
          note(
            `${row.label}: select a rate sensor (for example MB/s or Mbit/s).`,
            "ae-warn",
          ),
        );
    return section;
  }
  render() {
    const c = this.config;
    if (!this.entityIds.length)
      return note("Choose system metrics in the visual editor.");
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
      title(this, c.name || "Server Monitor", c.availability_entity),
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
        `System temperature: ${valueText(this.hass, c.temperature_entity)}`,
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
        uptimeButton.setAttribute("aria-label", `Uptime: ${headline}`);
        statusNode.append(uptimeButton);
      } else statusNode.append(el("span", headline));
      meta.append(statusNode);
    }
    header.append(meta);
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
        const label = metric === "disk" ? "Disk" : metric.toUpperCase(),
          capacity =
            metric !== "cpu" && c[metric + "_used_entity"]
              ? c[metric + "_total_entity"]
                ? `${valueText(this.hass, c[metric + "_used_entity"])} / ${valueText(this.hass, c[metric + "_total_entity"])}`
                : c[metric + "_free_entity"]
                  ? `${valueText(this.hass, c[metric + "_used_entity"])} used · ${valueText(this.hass, c[metric + "_free_entity"])} free`
                  : `${valueText(this.hass, c[metric + "_used_entity"])} used`
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
          ),
        );
        if (capacity) resource.append(note(capacity));
        if (percent !== null && (percent < 0 || percent > 100))
          resource.append(
            note(`${label} measurement outside 0–100%`, "ae-warn"),
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
            `${metric}: ${level === "critical" ? "error" : "warning"} threshold reached (${formatNumber(this.hass, value)})`,
            level === "critical" ? "system-error-note" : "ae-warn",
          ),
        );
    }
    const services = [];
    for (const service of c.services || []) {
      const block = group(note(service.name || "Service"));
      block.classList.add("ikio-service");
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
              requestReview(
                this,
                service.restart_action,
                `Restart ${service.name || "service"}`,
                "The service may be temporarily unavailable while restarting.",
                () =>
                  this.action(
                    service.restart_action,
                    `Restart ${service.name || "service"}`,
                  ),
              ),
            {
              icon: "mdi:restart",
              disabled: this.blocked(service.restart_action),
            },
          ),
        );
      services.push(block);
    }
    const serviceCount = services.length;
    if (c.database_entity) {
      const extra = group(
        reading(
          "Database",
          valueText(this.hass, c.database_entity),
          c.database_entity,
        ),
      );
      if (serviceCount) extra.classList.add("system-extra-details");
      services.push(extra);
    }
    if (services.length) {
      const footer = disclosure(
        this,
        "system-services",
        serviceCount ? `Services · ${serviceCount}` : "System details",
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
