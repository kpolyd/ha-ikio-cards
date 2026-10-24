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
    this.live = false;
    this.player?.remove();
    this.player = null;
    this.loadingFeed = false;
  }
  async openFeed() {
    if (this.preview || !available(this.state()) || !this.isConnected) return;
    this.loadingFeed = true;
    this.error.textContent = "";
    this.update();
    const revision = this.revision;
    try {
      if (!window.loadCardHelpers)
        throw Error("Home Assistant camera helpers are unavailable");
      const helpers = await window.loadCardHelpers();
      const player = await helpers.createCardElement({
        type: "picture-entity",
        entity: this.config.entity,
        camera_view: "live",
        show_name: false,
        show_state: false,
      });
      if (!this.isConnected || revision !== this.revision || !this.visible) {
        player.remove?.();
        return;
      }
      this.player = player;
      this.live = true;
      player.hass = this.hass;
      this.update();
    } catch (e) {
      if (revision === this.revision)
        this.error.textContent = e.message || "Camera view could not be loaded";
    } finally {
      if (revision === this.revision) {
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
      const placeholder = el("div", undefined, "ae-camera-placeholder");
      placeholder.style.cssText =
        "display:grid;place-items:center;min-height:64px;background:var(--ae-well);border-radius:8px";
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
      controls.append(
        button(
          this.loadingFeed ? "Loading…" : "Open live view",
          () => this.openFeed(),
          {
            icon: "mdi:video",
            disabled:
              this.preview || !available(this.state()) || this.loadingFeed,
          },
        ),
      );
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
    if (c.snapshot_automation)
      result.append(
        button(
          `Snapshot automation: ${stateText(this.hass, c.snapshot_automation)}`,
          () => this.toggle(c.snapshot_automation),
          { disabled: this.blocked(c.snapshot_automation) },
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
      result.append(
        reading(
          "Captured",
          valueText(this.hass, c.capture_timestamp_entity),
          c.capture_timestamp_entity,
        ),
      );
    else result.append(note("Snapshot capture time unknown"));
    return result;
  }
}
