import { installRefinement, refine, disclosure, glyph } from "@ikio/card-ui";
import {
  ControlCard,
  group,
  title,
  note,
  row,
  button,
  reading,
  valueText,
  stateText,
  available,
  el,
} from "@ikio/card-ui";
import { validate } from "./config.js";
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    installRefinement(this);
  }
  static getStubConfig() {
    return { schema_version: 1 };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-camera-card-editor");
  }
  onConfig() {
    this.stopFeed();
  }
  onDisconnect() {
    this.stopFeed();
  }
  onVisibility() {
    if (!this.visible) this.stopFeed();
    this.update();
  }
  stopFeed() {
    this.feedRequest = (this.feedRequest || 0) + 1;
    this.cancelFeed?.();
    this.cancelFeed = undefined;
    this.live = false;
    this.player?.remove();
    this.player = null;
    this.loadingFeed = false;
  }
  async openFeed() {
    if (
      this.preview ||
      !available(this.state()) ||
      !this.isConnected ||
      !this.visible ||
      this.loadingFeed
    )
      return;
    this.loadingFeed = true;
    this.error.textContent = "";
    this.update();
    const revision = this.revision;
    const request = (this.feedRequest = (this.feedRequest || 0) + 1);
    const valid = () =>
      request === this.feedRequest &&
      revision === this.revision &&
      this.isConnected &&
      this.visible &&
      !this.preview &&
      available(this.state());
    let timer;
    try {
      if (!window.loadCardHelpers)
        throw Error("Home Assistant camera helpers are unavailable");
      const prepare = async () => {
        const helpers = await window.loadCardHelpers();
        if (!valid()) return null;
        const player = await helpers.createCardElement({
          type: "picture-entity",
          entity: this.config.entity,
          camera_view: "live",
          show_name: false,
          show_state: false,
        });
        if (!valid()) {
          player.remove?.();
          return null;
        }
        return player;
      };
      const cancelled = new Promise((_, reject) => {
        this.cancelFeed = () => reject(new Error("Camera view cancelled"));
        timer = setTimeout(() => {
          this.feedRequest++;
          this.loadingFeed = false;
          this.error.textContent =
            "Camera view took too long to load. Try again.";
          this.update();
          reject(new Error("Camera view timed out"));
        }, 8000);
      });
      const player = await Promise.race([prepare(), cancelled]);
      if (!valid() || !player) return;
      this.player = player;
      this.live = true;
      player.hass = this.hass;
      this.update();
    } catch (e) {
      if (valid())
        this.error.textContent = e.message || "Camera view could not be loaded";
    } finally {
      clearTimeout(timer);
      if (request === this.feedRequest && revision === this.revision) {
        this.cancelFeed = undefined;
        this.loadingFeed = false;
        this.update();
      }
    }
  }
  afterRender() {
    const mount = this.content.querySelector("[data-native]");
    if (mount && this.player) {
      if (!mount.contains(this.player)) mount.append(this.player);
      this.player.hass = this.hass;
    }
  }
  render() {
    const c = this.config;
    if (!c.entity) return note("Choose a camera in the visual editor.");
    if (this.preview && this.live) this.stopFeed();
    if (!available(this.state()) && this.live) this.stopFeed();
    const result = group(
      title(
        this,
        c.name || this.label(c.entity),
        c.entity,
        stateText(this.hass, c.entity),
      ),
    );
    refine(result, "mdi:cctv");
    const controls = row();
    if (this.live) {
      const mount = el("div", undefined, undefined, "camera-feed");
      mount.setAttribute("data-native", "");
      result.append(mount);
      controls.append(
        button(
          "Close live view",
          () => {
            this.stopFeed();
            this.update();
          },
          { icon: "mdi:close" },
        ),
      );
    } else {
      const placeholder = el("div", undefined, "ikio-camera-placeholder");
      placeholder.append(
        note(
          this.state(c.power_switch)?.state === "off"
            ? "Camera power is off"
            : !available(this.state())
              ? "Camera unavailable"
              : "Live view starts on demand",
        ),
      );
      result.append(placeholder);
      const open = button(
        this.loadingFeed ? "Loading…" : "Open live view",
        () => this.openFeed(),
        {
          disabled:
            this.preview || !available(this.state()) || this.loadingFeed,
        },
      );
      open.classList.add("ikio-primary", "ikio-camera-open");
      open.prepend(glyph("mdi:video"));
      placeholder.append(open);
    }
    if (c.power_switch)
      controls.append(
        button(
          this.state(c.power_switch)?.state === "on"
            ? "Turn camera off"
            : "Turn camera on",
          () => this.toggle(c.power_switch),
          { icon: "mdi:power", disabled: this.blocked(c.power_switch) },
        ),
      );
    result.append(controls);
    const footer = row();
    footer.classList.add("ikio-footer");
    if (c.snapshot_automation)
      footer.append(
        disclosure(
          this,
          "camera-automation",
          "Snapshot automation",
          button(
            `Snapshot automation: ${stateText(this.hass, c.snapshot_automation)}`,
            () => this.toggle(c.snapshot_automation),
            { disabled: this.blocked(c.snapshot_automation) },
          ),
        ),
      );
    if (c.snapshot_script)
      controls.append(
        button(
          "Capture snapshot",
          () => this.action(c.snapshot_script, "Capture snapshot"),
          { icon: "mdi:camera", disabled: this.blocked(c.snapshot_script) },
        ),
      );
    if (c.capture_timestamp_entity)
      footer.append(
        reading(
          "Captured",
          valueText(this.hass, c.capture_timestamp_entity),
          c.capture_timestamp_entity,
        ),
      );
    else footer.append(note("Snapshot capture time unknown"));
    result.append(footer);
    return result;
  }
}
