import { t } from "@ikio/card-ui/i18n";
import {
  ControlCard,
  features,
  group,
  title,
  reading,
  note,
  button,
  select,
  el,
  event,
  valueText,
  stateText,
  available,
  installRefinement,
  refine,
  glyph,
  updateChipIcons,
  unitValue,
  formatNumber,
} from "@ikio/card-ui";
import { validate, normalize } from "./config.js";
import {
  transport,
  position,
  safeImage,
  volumeLevel,
  playbackTime,
  flags,
} from "./adapter.js";
import { mediaStyles } from "./styles.js";
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    installRefinement(this);
    this.shadowRoot.prepend(el("style", mediaStyles));
  }
  setConfig(config) {
    super.setConfig(normalize(config));
  }
  static getStubConfig() {
    return {
      schema_version: 1,
      show_volume: true,
      show_source: true,
      volume_step: 5,
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-media-card-editor");
  }
  onConfig() {
    clearInterval(this.clock);
    this.clock = undefined;
    this.seekDraft = undefined;
    this.failedArtwork = undefined;
  }
  onVisibility() {
    this.syncClock();
    if (!this.visible) this.seekDraft = undefined;
    this.update();
  }
  onDisconnect() {
    clearInterval(this.clock);
    this.clock = undefined;
    this.seekDraft = undefined;
    // Stop loading artwork when the component is detached.
    this.content.querySelector(".media-artwork")?.removeAttribute("src");
  }
  syncClock() {
    const run =
      this.visible &&
      !this.preview &&
      this.isConnected &&
      this.state()?.state === "playing" &&
      position(this.state());
    if (!run) {
      clearInterval(this.clock);
      this.clock = undefined;
    } else if (!this.clock)
      this.clock = setInterval(() => this.tickPlayback(), 1000);
  }
  tickPlayback() {
    const p = position(this.state());
    if (!p || this.seekDraft !== undefined) return;
    const timeline = this.content.querySelector(".media-timeline");
    if (!timeline) return;
    const control = timeline.querySelector("input, progress");
    if (control && this.shadowRoot.activeElement !== control)
      control.value = String(p.value);
    if (control?.tagName === "INPUT")
      control.setAttribute(
        "aria-valuetext",
        `${playbackTime(p.value)} / ${playbackTime(p.duration)}`,
      );
    const elapsed = timeline.querySelector(".media-times span");
    if (elapsed) elapsed.textContent = playbackTime(p.value);
  }
  afterRender() {
    updateChipIcons(this);
    this.syncClock();
  }
  async playerCommand(service, data = {}, confirm) {
    if (!available(this.state()) || this.state().state === "off") return;
    return this.send(
      this.config.entity,
      "media_player",
      service,
      data,
      confirm,
    );
  }
  changeVolume(direction) {
    const s = this.state(),
      current = volumeLevel(s);
    if (features(s, flags.volume) && current !== null) {
      const next = Number(
        Math.max(
          0,
          Math.min(1, current + (direction * this.config.volume_step) / 100),
        ).toFixed(6),
      );
      if (next === current) return;
      return this.playerCommand(
        "volume_set",
        { volume_level: next },
        (state) => {
          const value = volumeLevel(state);
          return value !== null && Math.abs(value - next) < 0.005;
        },
      );
    }
    if (features(s, flags.volumeStep))
      return this.playerCommand(
        direction > 0 ? "volume_up" : "volume_down",
        {},
        (state) => {
          const value = volumeLevel(state);
          return (
            available(state) &&
            (current === null ||
              (value !== null &&
                (direction > 0 ? value > current : value < current)))
          );
        },
      );
  }
  volumeView() {
    const c = this.config,
      s = this.state(),
      a = s?.attributes || {};
    if (!c.show_volume || !available(s) || s.state === "off") return null;
    const level = volumeLevel(s),
      muted = typeof a.is_volume_muted === "boolean" ? a.is_volume_muted : null;
    const adjust =
      (features(s, flags.volume) && level !== null) ||
      features(s, flags.volumeStep);
    const canMute = features(s, flags.mute);
    if (!adjust && !canMute && !features(s, flags.volume)) return null;
    const wrap = el("div", undefined, "media-volume", "volume");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", t(this.hass, "Volume"));
    if (adjust)
      wrap.append(
        button(t(this.hass, "Decrease volume"), () => this.changeVolume(-1), {
          icon: "mdi:minus",
          disabled: this.blocked(c.entity) || level === 0,
          entity: c.entity,
          key: "volume-down",
        }),
      );
    const center = canMute
      ? button(
          t(this.hass, muted ? "Unmute" : "Mute"),
          () => {
            if (muted === null) return;
            this.playerCommand(
              "volume_mute",
              { is_volume_muted: !muted },
              (state) => state?.attributes?.is_volume_muted === !muted,
            );
          },
          {
            disabled: this.blocked(c.entity) || muted === null,
            entity: c.entity,
            key: "volume-center",
          },
        )
      : el("div", undefined, "", "volume-center");
    center.classList.add("media-volume-center");
    if (canMute) center.setAttribute("aria-pressed", String(muted === true));
    center.replaceChildren(
      glyph(
        muted === true || level === 0
          ? "mdi:volume-off"
          : level !== null && level < 0.5
            ? "mdi:volume-medium"
            : "mdi:volume-high",
      ),
      el(
        "output",
        muted === true
          ? t(this.hass, "Muted")
          : level === null
            ? "—"
            : `${formatNumber(this.hass, level * 100, 0)}%`,
      ),
    );
    if (!canMute) center.setAttribute("aria-label", t(this.hass, "Volume"));
    wrap.append(center);
    if (adjust)
      wrap.append(
        button(t(this.hass, "Increase volume"), () => this.changeVolume(1), {
          icon: "mdi:plus",
          disabled: this.blocked(c.entity) || level === 1,
          entity: c.entity,
          key: "volume-up",
        }),
      );
    return wrap;
  }
  timeline(s) {
    const p = position(s);
    if (!p) return null;
    const timeline = el("div", undefined, "media-timeline", "timeline");
    const shown = this.seekDraft ?? p.value;
    if (features(s, flags.seek)) {
      const input = el("input", undefined, "media-seek", "seek");
      Object.assign(input, {
        type: "range",
        min: "0",
        max: String(p.duration),
        step: "1",
        value: String(shown),
        disabled: this.blocked(this.config.entity),
      });
      input.setAttribute("aria-label", t(this.hass, "Playback"));
      input.setAttribute(
        "aria-valuetext",
        `${playbackTime(shown)} / ${playbackTime(p.duration)}`,
      );
      input.dataset.entity = this.config.entity;
      event(input, "input", (e) => {
        this.seekDraft = Number(e.currentTarget.value);
        this.update();
      });
      event(input, "change", (e) => {
        const value = Math.max(
          0,
          Math.min(p.duration, Number(e.currentTarget.value)),
        );
        this.seekDraft = undefined;
        this.playerCommand("media_seek", { seek_position: value }, (state) => {
          const actual = position(state);
          return actual && Math.abs(actual.value - value) < 3;
        });
      });
      event(input, "pointercancel", () => {
        this.seekDraft = undefined;
        this.update();
      });
      event(input, "keydown", (e) => {
        if (e.key === "Escape") {
          this.seekDraft = undefined;
          e.currentTarget.value = String(p.value);
          this.update();
        }
      });
      timeline.append(input);
    } else {
      const progress = el(
        "progress",
        undefined,
        "media-readonly-progress",
        "progress",
      );
      progress.max = p.duration;
      progress.value = shown;
      progress.setAttribute("aria-label", t(this.hass, "Playback progress"));
      timeline.append(progress);
    }
    const times = el("div", undefined, "media-times");
    times.append(
      el("span", playbackTime(shown)),
      el("span", playbackTime(p.duration)),
    );
    timeline.append(times);
    return timeline;
  }
  render() {
    const c = this.config,
      s = this.state(),
      a = s?.attributes || {};
    if (!c.entity)
      return note(t(this.hass, "Choose a media player in the visual editor."));
    const online = available(s),
      off = s?.state === "off",
      active = online && !off;
    const result = group(
      title(
        this,
        c.name || this.label(c.entity),
        c.entity,
        stateText(this.hass, c.entity),
      ),
    );
    refine(result, "mdi:music-note-outline");
    result.classList.add("media-card");
    const nativeIcon = el("ha-state-icon");
    nativeIcon.dataset.chipEntity = c.entity;
    nativeIcon.setAttribute("aria-hidden", "true");
    result.querySelector("header>ha-icon")?.replaceWith(nativeIcon);
    const powerGroup = el("div", undefined, "media-power-group", "power-group");
    if (c.power_entity) {
      const watts = unitValue(this.state(c.power_entity), "power");
      const value =
        watts === null
          ? valueText(this.hass, c.power_entity)
          : `${formatNumber(this.hass, watts, 0)} W`;
      const power = reading(
        t(this.hass, "Power"),
        value,
        c.power_entity,
        "media-power-reading",
      );
      const label = power.querySelector(".ae-label");
      label.replaceChildren(glyph("mdi:lightning-bolt"));
      power.setAttribute("aria-label", `${t(this.hass, "Power")}: ${value}`);
      powerGroup.append(power);
    }
    if (features(s, off ? flags.on : flags.off)) {
      const power = button(
        t(this.hass, off ? "Power on" : "Power off"),
        () =>
          this.send(
            c.entity,
            "media_player",
            off ? "turn_on" : "turn_off",
            {},
            (state) =>
              off
                ? available(state) && state.state !== "off"
                : state?.state === "off",
          ),
        {
          icon: "mdi:power",
          disabled: this.blocked(c.entity),
          entity: c.entity,
          key: "power",
        },
      );
      power.classList.add("media-power");
      powerGroup.append(power);
    }
    if (powerGroup.childElementCount)
      result.querySelector("header").append(powerGroup);
    const now = el("div", undefined, "media-now", "now");
    now.hidden = !active;
    const artwork =
      active && this.visible && this.isConnected
        ? safeImage(a.entity_picture, this.hass)
        : null;
    const image = el("img", undefined, "media-artwork", "artwork");
    image.hidden = !artwork || artwork === this.failedArtwork;
    if (!image.hidden) {
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.src = artwork;
      event(image, "error", () => {
        if (
          safeImage(this.state()?.attributes?.entity_picture, this.hass) !==
          artwork
        )
          return;
        this.failedArtwork = artwork;
        this.update();
      });
      now.classList.add("has-art");
    }
    now.append(image);
    const info = el("div", undefined, "media-info", "info");
    const copy = el("div", undefined, "media-copy", "copy");
    const fallback =
      s?.state === "idle"
        ? t(this.hass, "Nothing playing")
        : t(this.hass, "Media information unavailable");
    copy.append(el("div", a.media_title || fallback, "media-track"));
    if (a.media_artist || a.media_series_title)
      copy.append(
        el("div", a.media_artist || a.media_series_title, "media-artist"),
      );
    const transportRow = el("div", undefined, "media-transport", "transport");
    if (active)
      for (const action of transport(s)) {
        const control = button(
          t(this.hass, action.label),
          () =>
            this.playerCommand(
              action.service,
              {},
              action.target
                ? (state) => state?.state === action.target
                : undefined,
            ),
          {
            icon: action.icon,
            disabled: this.blocked(c.entity),
            entity: c.entity,
            key: action.service,
          },
        );
        if (["media_play", "media_pause"].includes(action.service))
          control.classList.add("media-primary");
        transportRow.append(control);
      }
    info.append(copy, transportRow);
    now.append(info);
    if (active) {
      const timeline = this.timeline(s);
      if (timeline) now.append(timeline);
    }
    result.append(now);
    const message = note(
      !online
        ? t(this.hass, "Player unavailable")
        : off
          ? t(this.hass, "Nothing playing")
          : "",
    );
    message.dataset.key = "player-message";
    message.hidden = online;
    result.append(message);
    const controls = el("div", undefined, "media-controls", "controls");
    const volume = this.volumeView();
    if (volume) controls.append(volume);
    if (
      active &&
      c.show_source &&
      features(s, flags.source) &&
      a.source_list?.length
    ) {
      const sources = select(
        t(this.hass, "Source"),
        a.source_list,
        a.source,
        (source) =>
          this.playerCommand(
            "select_source",
            { source },
            (state) => state?.attributes?.source === source,
          ),
        "source",
      );
      sources.querySelector("select").disabled = this.blocked(c.entity);
      controls.append(sources);
    }
    controls.hidden = !controls.children.length;
    result.append(controls);
    const busy = note(t(this.hass, "Updating device…"));
    busy.dataset.key = "busy";
    busy.hidden = !this.pending.size && !this.requests.size;
    result.append(busy);
    return result;
  }
}
