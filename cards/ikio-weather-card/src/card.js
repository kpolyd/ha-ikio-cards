import {
  IkioCard,
  element as el,
  available,
  entityName,
  details,
  bindHold,
  formatNumber,
  t,
} from "@ikio/card-ui";
import { translateError } from "@ikio/card-ui/i18n";
import { normalizeConfig, periodLabels } from "./config.js";
import {
  finite,
  supportedTypes,
  forecastRows,
  slotLabel,
  metric,
  condition,
  windDirection,
} from "./adapter.js";
import { css } from "./styles.js";
const svg = (tag, attributes = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [name, value] of Object.entries(attributes))
    node.setAttribute(name, String(value));
  return node;
};
const glyph = (icon, label) => {
  const node = el("ha-icon");
  node.setAttribute("icon", icon);
  if (label) {
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", label);
  } else node.setAttribute("aria-hidden", "true");
  return node;
};
export class Card extends IkioCard {
  constructor() {
    super();
    this.shadowRoot.append(el("style", css));
    this.rawForecast = null;
    this.tabButtons = new Map();
    this.top = el("div", undefined, "weather-top");
    this.nameButton = el("button", undefined, "weather-name");
    this.nameButton.type = "button";
    this.nameButton.onclick = () => details(this, this.config?.entity);
    this.legend = el("div", undefined, "weather-legend");
    this.tabs = el("div", undefined, "weather-tabs");
    this.tabs.setAttribute("role", "group");
    this.periodSelect = el("select", undefined, "weather-period");
    this.periodSelect.onchange = () => {
      this.selectedType = this.periodSelect.value;
      this.update();
    };
    this.top.append(this.nameButton, this.legend, this.tabs, this.periodSelect);
    this.current = el("div", undefined, "weather-current");
    this.forecast = el("section", undefined, "weather-forecast");
    this.days = el("div", undefined, "weather-columns");
    this.chart = svg("svg", { class: "weather-plot", role: "img" });
    this.values = el("div", undefined, "weather-columns weather-values");
    this.precipitation = el(
      "div",
      undefined,
      "weather-columns weather-precipitation",
    );
    this.wind = el("div", undefined, "weather-columns weather-wind");
    this.message = el("p", undefined, "weather-message");
    this.message.setAttribute("role", "status");
    this.retry = el("button", undefined, "weather-retry");
    this.retry.type = "button";
    this.retry.onclick = () => {
      this.stopForecast();
      this.syncForecast();
    };
    this.forecast.append(
      this.days,
      this.chart,
      this.values,
      this.precipitation,
      this.wind,
      this.message,
      this.retry,
    );
    this.content.append(this.top, this.current, this.forecast);
    this.onVisibility = () => {
      this.syncForecast();
      this.update(false);
    };
  }
  static getStubConfig(hass) {
    return {
      schema_version: 1,
      entity: Object.keys(hass?.states || {}).find((id) =>
        id.startsWith("weather."),
      ),
      appearance: { theme: "ha" },
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-weather-card-editor");
  }
  setConfig(config) {
    let next;
    try {
      next = normalizeConfig(config);
    } catch (error) {
      throw Error(translateError(this.hass, error.message));
    }
    this.stopForecast();
    this.config = next;
    this.entityIds = [next.entity].filter(Boolean);
    this.selectedType = next.forecast_type;
    this.rawForecast = null;
    this.forecastError = false;
    this.setAttribute("appearance", next.appearance.theme);
    this.update();
  }
  set hass(value) {
    const connection = this._hass?.connection;
    super.hass = value;
    if (connection !== value?.connection) this.syncForecast();
  }
  get hass() {
    return super.hass;
  }
  connectedCallback() {
    document.addEventListener("visibilitychange", this.onVisibility);
    this.hold = bindHold(this.nameButton, () =>
      details(this, this.config?.entity),
    );
    for (const button of this.tabButtons.values()) this.bindTabHold(button);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.drawChart());
      this.resizeObserver.observe(this.forecast);
    }
    if (typeof IntersectionObserver !== "undefined") {
      this.inView = false;
      this.intersectionObserver = new IntersectionObserver((entries) => {
        this.inView = entries[0]?.isIntersecting ?? false;
        this.syncForecast();
        this.update(false);
      });
      this.intersectionObserver.observe(this);
    } else this.inView = true;
    super.connectedCallback();
    this.syncForecast();
  }
  disconnectedCallback() {
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    this.hold?.destroy();
    for (const button of this.tabButtons.values()) {
      button.weatherHold?.destroy();
      button.weatherHold = null;
    }
    this.stopForecast();
    super.disconnectedCallback();
  }
  stopForecast() {
    const job = this.subscription;
    this.subscription = null;
    if (job) {
      clearTimeout(job.timer);
      this.releaseSubscription(job.unsubscribe);
    }
  }
  releaseSubscription(unsubscribe) {
    // The HA connection may already be closed when an element is detached.
    try {
      Promise.resolve(unsubscribe?.()).catch(() => {});
    } catch {
      /* Closed connection. */
    }
  }
  bindTabHold(button) {
    if (!button.weatherHold)
      button.weatherHold = bindHold(button, () =>
        details(this, this.config?.entity),
      );
  }
  syncForecast() {
    if (!this.config) return;
    const state = this.hass?.states?.[this.config.entity];
    const types = supportedTypes(state);
    if (!types.includes(this.selectedType))
      this.selectedType = types.includes(this.config.forecast_type)
        ? this.config.forecast_type
        : types[0];
    const connection = this.hass?.connection;
    const enabled =
      this.isConnected &&
      this.inView !== false &&
      !document.hidden &&
      this.config.show_forecast &&
      available(state) &&
      this.selectedType &&
      connection?.subscribeMessage;
    const old = this.subscription;
    if (
      old &&
      enabled &&
      old.entity === this.config.entity &&
      old.type === this.selectedType &&
      old.connection === connection
    )
      return;
    this.stopForecast();
    if (!enabled) return;
    const job = {
      entity: this.config.entity,
      type: this.selectedType,
      connection,
    };
    this.subscription = job;
    this.rawForecast = null;
    this.forecastError = false;
    this.update(false);
    const fail = () => {
      if (this.subscription !== job) return;
      this.stopForecast();
      this.forecastError = true;
      this.rawForecast = null;
      this.update(false);
    };
    job.timer = setTimeout(fail, 15000);
    const callback = (event) => {
      if (
        !event ||
        this.subscription !== job ||
        (event.type && event.type !== job.type)
      )
        return;
      clearTimeout(job.timer);
      this.rawForecast = Array.isArray(event.forecast) ? event.forecast : [];
      this.forecastError = false;
      this.update(false);
    };
    try {
      Promise.resolve(
        connection.subscribeMessage(callback, {
          type: "weather/subscribe_forecast",
          entity_id: job.entity,
          forecast_type: job.type,
        }),
      ).then((unsubscribe) => {
        if (this.subscription !== job) this.releaseSubscription(unsubscribe);
        else job.unsubscribe = unsubscribe;
      }, fail);
    } catch {
      fail();
    }
  }
  update(sync = true) {
    if (!this.config) return;
    if (sync) this.syncForecast();
    const c = this.config,
      state = this.hass?.states?.[c.entity],
      attrs = state?.attributes || {},
      ok = available(state);
    this.nameButton.textContent =
      c.name || entityName(this.hass, state) || t(this.hass, "Weather");
    this.nameButton.disabled = !c.entity;
    this.nameButton.setAttribute(
      "aria-label",
      t(this.hass, "Open entity details"),
    );
    this.tabs.setAttribute("aria-label", t(this.hass, "Forecast"));
    this.periodSelect.setAttribute("aria-label", t(this.hass, "Forecast"));
    const types = supportedTypes(state);
    const validButtons = new Set(types);
    for (const [type, button] of this.tabButtons)
      if (!validButtons.has(type)) {
        button.weatherHold?.destroy();
        button.remove();
        this.tabButtons.delete(type);
      }
    for (const type of types) {
      let button = this.tabButtons.get(type);
      if (!button) {
        button = el("button");
        button.type = "button";
        button.dataset.type = type;
        button.onclick = () => {
          this.selectedType = type;
          this.update();
        };
        this.bindTabHold(button);
        this.tabButtons.set(type, button);
        this.tabs.append(button);
      }
      button.textContent = t(this.hass, periodLabels[type]);
      button.setAttribute("aria-pressed", String(this.selectedType === type));
    }
    this.tabs.hidden = !c.show_forecast || types.length !== 2 || !ok;
    this.periodSelect.hidden = !c.show_forecast || types.length < 3 || !ok;
    const options = types
      .map((type) => `${type}:${t(this.hass, periodLabels[type])}`)
      .join("|");
    if (this.periodOptions !== options) {
      this.periodOptions = options;
      this.periodSelect.replaceChildren(
        ...types.map((type) => {
          const option = el("option", t(this.hass, periodLabels[type]));
          option.value = type;
          return option;
        }),
      );
    }
    this.periodSelect.value = this.selectedType || "";
    this.current.hidden = !c.show_current || !c.entity;
    this.current.replaceChildren();
    const weather = condition(this.hass, ok ? state.state : "unavailable");
    this.current.append(glyph(attrs.icon || weather.icon));
    const main = el("div", undefined, "weather-main");
    main.append(
      el(
        "div",
        ok
          ? metric(
              this.hass,
              state,
              "temperature",
              attrs.temperature,
              attrs.temperature_unit,
            )
          : "—",
        "weather-temperature",
      ),
      el(
        "div",
        ok ? weather.label : t(this.hass, "Unavailable"),
        "weather-condition",
      ),
    );
    this.current.append(main);
    const readings = el("div", undefined, "weather-readings");
    if (ok) {
      if (c.show_feels_like && finite(attrs.apparent_temperature) !== null)
        readings.append(
          el(
            "span",
            t(this.hass, "Feels like {value}", {
              value: metric(
                this.hass,
                state,
                "apparent_temperature",
                attrs.apparent_temperature,
                attrs.temperature_unit,
              ),
            }),
            "weather-feels",
          ),
        );
      for (const [flag, attr, unit, icon, label] of [
        ["show_humidity", "humidity", "%", "mdi:water-percent", "Humidity"],
        [
          "show_wind",
          "wind_speed",
          attrs.wind_speed_unit,
          "mdi:weather-windy",
          "Wind speed & direction",
        ],
        [
          "show_pressure",
          "pressure",
          attrs.pressure_unit,
          "mdi:gauge",
          "Pressure",
        ],
      ])
        if (c[flag] && finite(attrs[attr]) !== null) {
          const row = el("span", undefined, "weather-reading");
          row.setAttribute("aria-label", t(this.hass, label));
          row.append(
            glyph(icon),
            el(
              "span",
              `${attr === "wind_speed" ? windDirection(attrs.wind_bearing) + " " : ""}${metric(this.hass, state, attr, attrs[attr], unit)}`,
            ),
          );
          readings.append(row);
        }
    }
    this.current.append(readings);
    this.forecast.hidden = !c.show_forecast;
    this.rows = ok
      ? forecastRows(this.rawForecast, this.selectedType, this.hass).slice(
          0,
          c.forecast_slots,
        )
      : [];
    const count = this.rows.length;
    this.forecast.style.setProperty(
      "--weather-slots",
      String(Math.max(1, count)),
    );
    this.days.replaceChildren();
    this.values.replaceChildren();
    this.precipitation.replaceChildren();
    this.wind.replaceChildren();
    let hasRain = false,
      hasProbability = false,
      hasWind = false;
    for (const row of this.rows) {
      const day = el("div", undefined, "weather-day");
      day.append(el("span", slotLabel(this.hass, row, this.selectedType)));
      if (this.selectedType === "twice_daily")
        day.append(el("span", t(this.hass, row.is_daytime ? "Day" : "Night")));
      if (c.show_forecast_conditions) {
        const cond = condition(this.hass, row.condition);
        day.append(glyph(cond.icon, cond.label));
      }
      this.days.append(day);
      const values = el("div");
      values.append(
        el(
          "span",
          this.temperatureLabel(row.temperature, attrs.temperature_unit),
        ),
      );
      if (this.selectedType === "daily" && finite(row.templow) !== null)
        values.append(
          el(
            "span",
            this.temperatureLabel(row.templow, attrs.temperature_unit),
          ),
        );
      this.values.append(values);
      const rain = el("div");
      if (c.show_precipitation) {
        hasRain ||=
          finite(row.precipitation) !== null && row.precipitation >= 0;
        rain.append(
          el(
            "span",
            metric(
              this.hass,
              state,
              "precipitation",
              finite(row.precipitation) !== null && row.precipitation >= 0
                ? row.precipitation
                : null,
              attrs.precipitation_unit,
            ),
          ),
        );
      }
      if (c.show_precipitation_probability) {
        const p = finite(row.precipitation_probability);
        hasProbability ||= p !== null && p >= 0 && p <= 100;
        rain.append(
          el(
            "span",
            metric(
              this.hass,
              state,
              "precipitation_probability",
              p !== null && p >= 0 && p <= 100 ? p : null,
              "%",
            ),
            "weather-probability",
          ),
        );
      }
      this.precipitation.append(rain);
      const wind = el("div");
      hasWind ||= finite(row.wind_speed) !== null;
      wind.textContent =
        finite(row.wind_speed) !== null
          ? `${windDirection(row.wind_bearing)} ${metric(this.hass, state, "wind_speed", row.wind_speed, attrs.wind_speed_unit)}`
          : "—";
      this.wind.append(wind);
    }
    this.values.hidden = c.show_temperature_graph;
    this.precipitation.hidden = !hasRain && !hasProbability;
    this.precipitation.setAttribute(
      "aria-label",
      t(this.hass, "Precipitation"),
    );
    this.wind.hidden = !c.show_forecast_wind || !hasWind;
    this.wind.setAttribute("aria-label", t(this.hass, "Forecast wind"));
    this.message.hidden = !!count;
    this.message.textContent = t(
      this.hass,
      !c.entity
        ? "Choose a weather entity in the visual editor."
        : !ok
          ? "Weather unavailable"
          : !types.length
            ? "This entity does not provide a forecast."
            : this.forecastError
              ? "Forecast could not be loaded."
              : this.rawForecast === null
                ? "Loading forecast…"
                : "No forecast available.",
    );
    this.retry.hidden = !this.forecastError;
    this.retry.textContent = t(this.hass, "Retry");
    this.drawChart();
  }
  temperatureLabel(value, unit) {
    return finite(value) === null
      ? "—"
      : `${formatNumber(this.hass, value, 1)}${unit === "°C" || unit === "°F" ? "°" : unit ? ` ${unit}` : ""}`;
  }
  drawChart() {
    if (!this.config) return;
    const rows = this.rows || [],
      c = this.config,
      width = this.forecast.clientWidth || 300;
    this.chart.setAttribute("viewBox", `0 0 ${width} 84`);
    this.chart.replaceChildren();
    this.legend.replaceChildren();
    const temps = rows
      .flatMap((r) => [
        finite(r.temperature),
        ...(this.selectedType === "daily" ? [finite(r.templow)] : []),
      ])
      .filter((v) => v !== null);
    const rains = rows
      .map((r) => finite(r.precipitation))
      .filter((v) => v !== null && v >= 0);
    const showTemps = c.show_temperature_graph && temps.length > 0;
    const showRain = c.show_precipitation && rains.length > 0;
    this.chart.hidden = !rows.length || (!showTemps && !showRain);
    this.legend.hidden = !showTemps;
    if (!rows.length) return;
    const unit =
      this.hass?.states?.[c.entity]?.attributes?.temperature_unit || "";
    const rainUnit =
      this.hass?.states?.[c.entity]?.attributes?.precipitation_unit || "";
    this.chart.setAttribute(
      "aria-label",
      t(
        this.hass,
        "Forecast temperature ({temperature_unit}) and precipitation ({precipitation_unit}) use separate scales.",
        { temperature_unit: unit, precipitation_unit: rainUnit },
      ),
    );
    const x = (i) => ((i + 0.5) * width) / rows.length;
    if (showRain) {
      const max = Math.max(...rains) || 1;
      rows.forEach((row, i) => {
        const value = finite(row.precipitation);
        if (value === null || value < 0) return;
        const height = (value / max) * 66;
        const bar = svg("rect", {
          x: ((i + 0.18) * width) / rows.length,
          y: 84 - height,
          width: (width / rows.length) * 0.64,
          height,
          rx: 2,
          fill: "var(--weather-rain)",
          opacity: 0.22,
          class: "weather-rain-bar",
        });
        const title = svg("title");
        title.textContent = `${slotLabel(this.hass, row, this.selectedType)}: ${formatNumber(this.hass, value, 2)} ${rainUnit}`;
        bar.append(title);
        this.chart.append(bar);
      });
    }
    if (!showTemps) return;
    const min = Math.min(...temps),
      range = Math.max(Math.max(...temps) - min, 1),
      y = (value) => 61 - ((value - min) / range) * 40;
    const series = [
      {
        key: "temperature",
        label: this.selectedType === "daily" ? "High" : "Temperature",
        color: "var(--weather-high)",
      },
    ];
    if (
      this.selectedType === "daily" &&
      rows.some((row) => finite(row.templow) !== null)
    )
      series.push({
        key: "templow",
        label: "Low",
        color: "var(--weather-low)",
        low: true,
      });
    for (const s of series) {
      const item = el("span");
      item.append(
        el("i", undefined, `weather-swatch${s.low ? " low" : ""}`),
        el("span", t(this.hass, s.label)),
      );
      this.legend.append(item);
      let path = "";
      rows.forEach((row, i) => {
        const value = finite(row[s.key]);
        if (value === null) {
          path += " ";
          return;
        }
        const previous = i > 0 && finite(rows[i - 1][s.key]) !== null;
        path += `${previous ? "L" : "M"}${x(i)} ${y(value)} `;
      });
      const line = svg("path", {
        d: path,
        fill: "none",
        stroke: s.color,
        "stroke-width": 2,
        class: `weather-line ${s.key}`,
      });
      if (s.low) line.setAttribute("stroke-dasharray", "4 3");
      this.chart.append(line);
      rows.forEach((row, i) => {
        const value = finite(row[s.key]);
        if (value === null) return;
        const point = svg("circle", {
          cx: x(i),
          cy: y(value),
          r: 2.5,
          fill: s.color,
        });
        const tooltip = svg("title");
        tooltip.textContent = `${slotLabel(this.hass, row, this.selectedType)}: ${this.temperatureLabel(value, unit)}`;
        point.append(tooltip);
        this.chart.append(point);
        const label = svg("text", {
          x: x(i),
          y: y(value) + (s.low ? 16 : -10),
          "text-anchor": "middle",
        });
        label.textContent = this.temperatureLabel(value, unit);
        this.chart.append(label);
        if (label.getComputedTextLength?.() > width / rows.length - 2) {
          label.remove();
        }
      });
    }
    if (!c.show_current && unit) this.legend.append(el("span", unit));
  }
}
