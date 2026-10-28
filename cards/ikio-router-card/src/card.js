import { rateDisplay } from "./rate-display.js";
import {
  t,
  ControlCard,
  group,
  title,
  note,
  reading,
  button,
  valueText,
  numeric,
  formatNumber,
  el,
  details,
  available,
  installRefinement,
  chipStyles,
  sensorChip,
  updateChipIcons,
  glyph,
  refine,
} from "@ikio/card-ui";
import { graphPalette } from "@ikio/graph";
import { validate, defaults } from "./config.js";
import {
  internetStatus,
  gauge,
  rateFactor,
  uptimeSeconds,
  uptimeLabel,
  availabilityLabel,
} from "./adapter.js";
import {
  routerStyles,
  networkStyles,
  networkPlot,
  miniGauge,
} from "./views.js";
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    installRefinement(this);
    this.shadowRoot.append(
      el("style", routerStyles + networkStyles + chipStyles),
    );
  }
  setConfig(config) {
    super.setConfig({
      ...config,
      appearance: { theme: "ha", ...config.appearance },
    });
  }
  static getStubConfig() {
    return {
      schema_version: 1,
      ...defaults,
      appearance: { theme: "ha" },
      extra_readings: [],
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-router-card-editor");
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
          start_time: new Date(
            now - (this.config.history_minutes || 30) * 60000,
          ).toISOString(),
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
  rateText(id) {
    return rateDisplay(this.hass, {
      entity: id,
      unit: this.state(id)?.attributes?.unit_of_measurement,
    });
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
        this.rateText(row.entity),
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
    const plot = networkPlot(
      compatible,
      this.network,
      Date.now(),
      this.hass,
      this.config.history_minutes || 30,
      this.config.graph_height || 132,
    );
    if (plot) {
      section.append(plot);
      const times = el("div", undefined, "system-network-times");
      times.append(
        el(
          "span",
          t(this.hass, "−{minutes} min", {
            minutes: this.config.history_minutes || 30,
          }),
        ),
        el("span", t(this.hass, "Now")),
      );
      plot.append(times);
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
  entityButton(id, label, cls) {
    const n = id
      ? button(label, () => details(this, id), { entity: id, key: cls })
      : el("div");
    n.replaceChildren();
    n.className = cls;
    return n;
  }
  address(id) {
    const s = this.state(id);
    return available(s) ? String(s.state) : "—";
  }
  pathNode(icon, id, caption, label, cls = "") {
    const n = this.entityButton(id, label, `router-node ${cls}`),
      symbol = el("span", undefined, "router-symbol");
    symbol.append(glyph(icon));
    n.append(symbol);
    if (caption) n.append(el("span", caption, "router-caption"));
    n.setAttribute("aria-label", label);
    return n;
  }
  cellularView() {
    const c = this.config;
    if (
      c.connection_type !== "cellular" ||
      !["network_type", "signal", "rsrp", "rsrq", "snr"].some(
        (k) => c[k + "_entity"],
      )
    )
      return null;
    const section = el("section", undefined, "router-cellular"),
      heading = el("div", undefined, "router-cell-head");
    const network = this.entityButton(
      c.network_type_entity,
      t(this.hass, "Cellular"),
      "router-cell-title",
    );
    network.append(
      glyph("mdi:transmission-tower"),
      el(
        "span",
        c.network_type_entity
          ? this.address(c.network_type_entity)
          : t(this.hass, "Cellular"),
      ),
    );
    heading.append(network);
    if (c.signal_entity) {
      const value = numeric(this.state(c.signal_entity));
      const text =
        value !== null && value >= 0 && value <= 100
          ? `${formatNumber(this.hass, value, 0)}%`
          : "—";
      const signal = this.entityButton(
        c.signal_entity,
        t(this.hass, "Signal: {value}", { value: text }),
        "router-signal",
      );
      signal.append(
        el("span", t(this.hass, "Signal: {value}", { value: text })),
      );
      heading.append(signal);
    }
    section.append(heading);
    const metrics = el("div", undefined, "router-metrics");
    for (const [key, label, abbr, unit] of [
      ["rsrp", "Strength", "RSRP", "dBm"],
      ["rsrq", "Quality", "RSRQ", "dB"],
      ["snr", "SNR", "SNR / SINR", "dB"],
    ]) {
      const id = c[key + "_entity"];
      if (!id) continue;
      const g = gauge(this.state(id), key, c);
      const value =
        g.value === null ? "—" : formatNumber(this.hass, g.value, 1);
      const n = this.entityButton(
        id,
        `${t(this.hass, label)}: ${value} ${unit}`,
        `router-metric ${g.level}`,
      );
      n.append(
        el("span", t(this.hass, label), "ae-label"),
        miniGauge(g.fill, g.value !== null),
        el(
          "span",
          `${value}${g.value === null ? "" : " " + unit}`,
          "router-gauge-value",
        ),
        el("span", abbr, "ae-label"),
      );
      metrics.append(n);
    }
    if (metrics.childElementCount) section.append(metrics);
    return section;
  }
  render() {
    const c = this.config;
    if (!this.entityIds.length)
      return note(t(this.hass, "Choose router entities in the visual editor."));
    const result = group(
      title(this, c.name || t(this.hass, "Router"), c.availability_entity),
    );
    refine(result, "mdi:router-network");
    result.classList.add("ikio-router");
    const dark =
      c.appearance?.theme === "dark" ||
      (c.appearance?.theme === "ha" && this.hass?.themes?.darkMode);
    result.style.setProperty("--router-online", dark ? "#a4e4b8" : "#28613e");
    const header = result.querySelector("header"),
      meta = el("div", undefined, "router-header-meta");
    if (c.uptime_entity) {
      const label =
        uptimeLabel(
          uptimeSeconds(this.state(c.uptime_entity)),
          this.hass?.locale?.language || this.hass?.language || "en",
        ) || "—";
      const n = this.entityButton(c.uptime_entity, label, "router-uptime");
      n.append(el("span", label));
      meta.append(n);
    }
    if (c.availability_entity) {
      const state = availabilityLabel(this.state(c.availability_entity));
      const dot = el(
        "span",
        undefined,
        `router-status ${state === "Online" ? "online" : state === "Offline" ? "offline" : "unknown"}`,
      );
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", t(this.hass, state));
      meta.prepend(dot);
    }
    header.append(meta);
    const readings = [
      ...(c.latency_entity
        ? [{ entity: c.latency_entity, name: t(this.hass, "Latency") }]
        : []),
      ...(c.extra_readings || []),
    ].filter((row) => row.entity);
    if (readings.length) {
      const chips = el("div", undefined, "router-chips");
      readings.forEach((row, i) =>
        chips.append(sensorChip(this, row, `router-chip-${i}`)),
      );
      result.append(chips);
    }
    const path = el("div", undefined, "router-path");
    const state = internetStatus(
      this.state(c.internet_status_entity),
      c.connected_state,
    );
    const label = t(
      this.hass,
      state === "online"
        ? "Internet connected"
        : state === "offline"
          ? "Internet disconnected"
          : "Internet status unknown",
    );
    const globe = this.pathNode(
      "mdi:web",
      c.internet_status_entity,
      c.internet_ip_entity ? this.address(c.internet_ip_entity) : "",
      label,
      `router-internet ${state}`,
    );
    // Keep the IP independently accessible when status and address have different entities.
    if (c.internet_ip_entity) {
      const caption = globe.querySelector(".router-caption");
      if (caption) {
        caption.remove();
        const ip = this.entityButton(
          c.internet_ip_entity,
          this.address(c.internet_ip_entity),
          "router-address",
        );
        ip.append(el("span", this.address(c.internet_ip_entity)));
        const wrap = el("div", undefined, "router-internet-group");
        wrap.append(globe, ip);
        path.append(wrap);
      } else path.append(globe);
    } else path.append(globe);
    const wanLink = el("span", undefined, `router-link ${state}`);
    wanLink.setAttribute("aria-hidden", "true");
    path.append(wanLink);
    path.append(
      this.pathNode(
        "mdi:router-wireless",
        c.local_ip_entity,
        c.local_ip_entity ? this.address(c.local_ip_entity) : "",
        `${t(this.hass, "Local IP")}: ${c.local_ip_entity ? this.address(c.local_ip_entity) : "—"}`,
        "router-center",
      ),
    );
    const link = el("span", undefined, "router-link");
    link.setAttribute("aria-hidden", "true");
    path.append(link);
    const count = numeric(this.state(c.devices_entity));
    path.append(
      this.pathNode(
        "mdi:devices",
        c.devices_entity,
        c.devices_entity
          ? count !== null && count >= 0
            ? t(this.hass, "{count} devices", { count })
            : "—"
          : "",
        t(this.hass, "Devices"),
        "router-devices",
      ),
    );
    result.append(path);
    const cellular = this.cellularView();
    if (cellular) result.append(cellular);
    const network = this.networkView();
    if (network) result.append(network);
    return result;
  }
}
