import { element as el, details, t, styles } from "@ikio/card-ui";
import { language, translateError } from "@ikio/card-ui/i18n";
import { Room } from "./enums.js";
import { daylightForSun } from "./theme.js";
import { fields, normalizeConfig } from "./config.js";
import {
  loadConfiguration,
  ConfigurationFileError,
} from "./load-configuration.js";
import cardStyles from "./styles/card.js";
import labelStyles from "./styles/labels.js";

export class Card extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.room = Room.OVERVIEW;
    this.top = true;
    this.walls = true;
    this.daylight = 0;
    this.states = {};
    this.loadVersion = 0;
    this.configuration = null;
    this.shadowRoot.append(el("style", styles + cardStyles + labelStyles));
    this.status = el("div", undefined, "configuration-status");
    this.status.setAttribute("role", "status");
    this.statusText = el("p");
    this.retry = el("button");
    this.retry.type = "button";
    this.retry.onclick = () => this.load();
    this.status.append(this.statusText, this.retry);
    this.shadowRoot.append(this.status);
  }
  static getStubConfig() {
    return {
      schema_version: 1,
      home_model: "",
      entity_inventory: "",
      device_bindings: "",
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-home-3d-card-editor");
  }
  setConfig(value) {
    let next;
    try {
      next = normalizeConfig(value);
    } catch (error) {
      throw Error(translateError(this._hass, error.message));
    }
    const key = JSON.stringify(fields.map((f) => next[f.name] || ""));
    this.config = next;
    this.setAttribute("appearance", next.appearance.theme);
    if (key === this.configKey) {
      this.sync();
      return;
    }
    this.configKey = key;
    this.cancelLoad();
    this.disposeModel();
    this.configuration = null;
    if (this.isConnected) this.load();
    else this.renderStatus();
  }
  set hass(value) {
    this._hass = value;
    this.states = value?.states || {};
    this.updateLabels();
    this.sync();
  }
  get hass() {
    return this._hass;
  }
  getCardSize() {
    return 10;
  }
  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 6 };
  }
  connectedCallback() {
    if (this.configuration) this.mount();
    else this.load();
  }
  disconnectedCallback() {
    this.cancelLoad();
    this.disposeModel();
  }
  cancelLoad() {
    this.loadVersion++;
    this.controller?.abort();
    clearTimeout(this.loadTimer);
    this.loading = false;
  }
  disposeModel() {
    this.model?.dispose();
    this.model = null;
    this.shell?.remove();
    this.shell = null;
    this.snapshot = null;
  }
  renderStatus() {
    const ready = fields.every((f) => this.config?.[f.name]);
    this.status.hidden = !!this.model;
    this.statusText.textContent = t(
      this._hass,
      this.failure?.key === "schema"
        ? "Invalid Home 3D configuration. Check the file structure and references."
        : this.failure?.key === "webgl"
          ? "The 3D view needs WebGL. Enable hardware acceleration in your browser."
          : this.failure?.key === "timeout"
            ? "Loading the Home 3D configuration timed out."
            : this.failure
              ? "Could not load {file}. Check the URL and JSON content."
              : this.loading
                ? "Loading home configuration…"
                : "Provide the three Home 3D configuration file URLs in the visual editor.",
      {
        file: t(
          this._hass,
          fields.find((f) => f.name === this.failure?.key)?.label || "Home 3D",
        ),
      },
    );
    this.retry.hidden = !ready || this.loading || !this.failure;
    this.retry.textContent = t(this._hass, "Retry");
  }
  async load() {
    this.cancelLoad();
    this.failure = null;
    if (!this.isConnected || !fields.every((f) => this.config?.[f.name])) {
      this.renderStatus();
      return;
    }
    this.disposeModel();
    this.configuration = null;
    const version = this.loadVersion;
    this.controller = new AbortController();
    const controller = this.controller;
    this.loading = true;
    this.renderStatus();
    this.loadTimer = setTimeout(() => {
      if (version !== this.loadVersion) return;
      this.cancelLoad();
      this.failure = { key: "timeout" };
      this.renderStatus();
    }, 15000);
    try {
      const [configuration, { createModel }] = await Promise.all([
        loadConfiguration(this.config, { signal: controller.signal }),
        import("./model.js"),
      ]);
      if (version !== this.loadVersion || !this.isConnected) return;
      this.createModel = createModel;
      this.configuration = configuration;
      this.loading = false;
      clearTimeout(this.loadTimer);
      if (!Object.hasOwn(configuration.rooms, this.room))
        this.room = Room.OVERVIEW;
      this.mount();
    } catch (error) {
      if (version !== this.loadVersion || !this.isConnected) return;
      controller.abort();
      this.loading = false;
      clearTimeout(this.loadTimer);
      this.failure =
        error instanceof ConfigurationFileError ? error : { key: "schema" };
      this.renderStatus();
    }
  }
  mount() {
    if (this.model || !this.configuration || !this.createModel) return;
    const shell = el("section", undefined, "shell"),
      body = el("div", undefined, "body"),
      view = el("main", undefined, "view");
    const canvas = el("canvas"),
      tools = el("div", undefined, "tools");
    this.roomSelect = el("select");
    for (const room of Object.keys(this.configuration.rooms)) {
      const option = el("option");
      option.value = room;
      this.roomSelect.append(option);
    }
    this.roomSelect.value = this.room;
    this.roomSelect.onchange = () => this.choose(this.roomSelect.value);
    this.topButton = el("button");
    this.topButton.type = "button";
    this.topButton.onclick = () => {
      this.top = !this.top;
      this.model.focus(this.room, this.top);
      this.updateLabels();
    };
    this.wallsButton = el("button");
    this.wallsButton.type = "button";
    this.wallsButton.onclick = () => {
      this.walls = !this.walls;
      this.model.setWalls(this.walls);
      this.updateLabels();
    };
    this.resetButton = el("button");
    this.resetButton.type = "button";
    this.resetButton.onclick = () => {
      this.top = true;
      this.choose(Room.OVERVIEW);
      this.updateLabels();
    };
    tools.append(
      this.roomSelect,
      this.topButton,
      this.wallsButton,
      this.resetButton,
    );
    view.append(canvas, tools);
    body.append(view);
    shell.append(body);
    this.shadowRoot.append(shell);
    this.shell = shell;
    try {
      this.model = this.createModel(
        canvas,
        (hit) => {
          if (hit.badgeEntity) details(this, hit.badgeEntity);
          else if (hit.room) this.choose(hit.room);
        },
        this.configuration,
        {
          room: this.room,
          top: this.top,
          walls: this.walls,
          getHass: () => this._hass,
        },
      );
    } catch {
      shell.remove();
      this.shell = null;
      this.failure = { key: "webgl" };
      this.renderStatus();
      return;
    }
    this.status.hidden = true;
    this.updateLabels();
    this.sync();
  }
  updateLabels() {
    this.setAttribute("lang", language(this._hass));
    this.renderStatus();
    if (!this.model) return;
    this.roomSelect.setAttribute("aria-label", t(this._hass, "Choose room"));
    for (const option of this.roomSelect.options)
      option.textContent =
        option.value === Room.OVERVIEW
          ? t(this._hass, "Overview")
          : option.value;
    for (const [button, label, on] of [
      [this.topButton, "Top view", this.top],
      [this.wallsButton, "Full walls", this.walls],
    ]) {
      button.textContent = t(this._hass, label);
      button.classList.toggle("active", on);
      button.setAttribute("aria-pressed", String(on));
    }
    this.resetButton.textContent = t(this._hass, "Reset");
    this.shell
      .querySelector("canvas")
      .setAttribute(
        "aria-label",
        t(
          this._hass,
          "Interactive 3D home. One finger scrolls the dashboard; use two fingers to rotate or zoom.",
        ),
      );
  }
  sunState() {
    const id =
      this.configuration?.entities.find((item) =>
        item.entity.startsWith("sun."),
      )?.entity || "sun.sun";
    return this.states[id];
  }
  syncLighting() {
    if (!this.model) return;
    const next = daylightForSun(this.sunState());
    if (next !== null) this.daylight = next;
    this.model.setDaylight(this.daylight);
  }
  sync() {
    if (!this.model) return;
    this.model.initializeSun(this.sunState());
    this.syncLighting();
    const mapped = Object.fromEntries(
      this.configuration.entities.map(({ entity }) => [
        entity,
        this.states[entity],
      ]),
    );
    const snapshot = JSON.stringify([
      language(this._hass),
      this._hass?.locale?.number_format,
      Object.entries(mapped).map(([id, s]) => [
        id,
        s?.state,
        s?.attributes?.unit_of_measurement,
        ...(this.configuration.lightEntities.has(id)
          ? [s?.attributes?.brightness, s?.attributes?.rgb_color]
          : []),
      ]),
    ]);
    if (snapshot === this.snapshot) return;
    this.snapshot = snapshot;
    this.model.update(mapped);
  }
  choose(room) {
    if (!this.model || !Object.hasOwn(this.configuration.rooms, room)) return;
    this.room = room;
    this.roomSelect.value = room;
    this.model.focus(room, this.top);
  }
}
