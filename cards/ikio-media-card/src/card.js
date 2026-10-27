import { t } from "@ikio/card-ui/i18n";
import { installRefinement, refine, disclosure } from "@ikio/card-ui";
import {
  ControlCard,
  features,
  group,
  row,
  title,
  reading,
  note,
  button,
  range,
  select,
  el,
  valueText,
  stateText,
  available,
} from "@ikio/card-ui";
import { validate } from "./config.js";
import { transport, position, safeImage } from "./adapter.js";
export class Card extends ControlCard {
  validate = validate;
  constructor() {
    super();
    installRefinement(this);
  }
  static getStubConfig() {
    return {
      schema_version: 1,
      show_artwork: true,
      show_volume: true,
      show_source: true,
    };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-media-card-editor");
  }
  onVisibility() {
    clearInterval(this.clock);
    if (
      this.visible &&
      !this.preview &&
      this.isConnected &&
      this.state()?.state === "playing"
    )
      this.clock = setInterval(() => this.update(), 1000);
  }
  onDisconnect() {
    clearInterval(this.clock);
  }
  afterRender() {
    const playing = this.state()?.state === "playing";
    if (playing !== this.wasPlaying) {
      this.wasPlaying = playing;
      this.onVisibility();
    }
  }
  render() {
    const c = this.config,
      s = this.state(),
      a = s?.attributes || {};
    if (!c.entity)
      return note(t(this.hass, "Choose a media player in the visual editor."));
    const result = group(
      title(
        this,
        c.name || this.label(c.entity),
        c.entity,
        stateText(this.hass, c.entity),
      ),
    );
    refine(result, "mdi:music-note-outline");
    const artwork = safeImage(a.entity_picture, this.hass);
    if (
      a.media_title ||
      (c.show_artwork !== false && artwork && s?.state !== "off")
    ) {
      const info = el("div", undefined, "ikio-media-info");
      if (c.show_artwork !== false && artwork && s?.state !== "off") {
        const image = el("img", undefined, "ikio-artwork");
        image.src = artwork;
        image.alt = t(this.hass, "Media artwork");
        image.width = 44;
        image.height = 44;
        info.append(image);
      } else info.style.gridTemplateColumns = "minmax(0,1fr)";
      const text = el("div");
      if (a.media_title) text.append(el("div", a.media_title, "ikio-track"));
      if (a.media_artist || a.media_series_title)
        text.append(
          el("div", a.media_artist || a.media_series_title, "ikio-artist"),
        );
      info.append(text);
      result.append(info);
    }
    const p = position(s);
    if (p) {
      const format = (t) =>
        `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
      if (features(s, 2)) {
        const seek = range(
          t(this.hass, "Playback"),
          Math.floor(p.value),
          0,
          Math.floor(p.duration),
          1,
          (value) =>
            this.send(c.entity, "media_player", "media_seek", {
              seek_position: value,
            }),
        );
        seek.querySelector("input").disabled = this.blocked(c.entity);
        seek.classList.add("ae-playback");
        const caption = seek.querySelector("span");
        caption.className = "sr";
        seek.style.gridTemplateColumns = "minmax(0,1fr)";
        result.append(
          row(note(`${format(p.value)} / ${format(p.duration)}`), seek),
        );
      } else {
        const bar = el("progress", undefined, "ae-progress");
        bar.max = p.duration;
        bar.value = p.value;
        bar.setAttribute("aria-label", t(this.hass, "Playback progress"));
        result.append(
          row(note(`${format(p.value)} / ${format(p.duration)}`), bar),
        );
      }
    }
    const controls = transport(s).map((action) =>
      button(
        t(this.hass, action.label),
        () =>
          this.send(
            c.entity,
            "media_player",
            action.service,
            {},
            action.target
              ? (state) => state?.state === action.target
              : undefined,
          ),
        { icon: action.icon, disabled: this.blocked(c.entity) },
      ),
    );
    if (features(s, s?.state === "off" ? 128 : 256))
      controls.push(
        button(
          s.state === "off"
            ? t(this.hass, "Power on")
            : t(this.hass, "Power off"),
          () =>
            this.send(
              c.entity,
              "media_player",
              s.state === "off" ? "turn_on" : "turn_off",
              {},
              (state) =>
                s.state === "off"
                  ? available(state) && state.state !== "off"
                  : state?.state === "off",
            ),
          { icon: "mdi:power", disabled: this.blocked(c.entity) },
        ),
      );
    if (controls.length) {
      const transportRow = row(...controls);
      transportRow.classList.add("ikio-transport");
      const primary = [...transportRow.children].find((node) =>
        [t(this.hass, "Play"), t(this.hass, "Pause")].includes(
          node.getAttribute("aria-label"),
        ),
      );
      primary?.classList.add("ikio-primary");
      const timeline = result.querySelector(".ae-playback")?.parentElement;
      if (timeline) result.insertBefore(transportRow, timeline);
      else result.append(transportRow);
    }
    const audio = row();
    audio.classList.add("ikio-media-audio");
    result.append(audio);
    if (c.show_volume !== false) {
      const volumeRow = row();
      if (features(s, 4) && Number.isFinite(a.volume_level)) {
        const volume = range(
          t(this.hass, "Volume"),
          Math.round(a.volume_level * 100),
          0,
          100,
          1,
          (v) =>
            this.send(
              c.entity,
              "media_player",
              "volume_set",
              { volume_level: v / 100 },
              (state) =>
                Math.abs((state?.attributes?.volume_level ?? -1) - v / 100) <
                0.02,
            ),
        );
        volume.querySelector("input").disabled = this.blocked(c.entity);
        volumeRow.append(volume);
      }
      if (features(s, 8))
        volumeRow.append(
          button(
            a.is_volume_muted ? t(this.hass, "Unmute") : t(this.hass, "Mute"),
            () =>
              this.send(
                c.entity,
                "media_player",
                "volume_mute",
                { is_volume_muted: !a.is_volume_muted },
                (state) =>
                  state?.attributes?.is_volume_muted === !a.is_volume_muted,
              ),
            {
              icon: a.is_volume_muted ? "mdi:volume-off" : "mdi:volume-high",
              disabled: this.blocked(c.entity),
            },
          ),
        );
      audio.append(volumeRow);
    }
    if (c.show_source !== false && features(s, 2048) && a.source_list?.length) {
      const sources = select(
        t(this.hass, "Source"),
        a.source_list,
        a.source,
        (v) =>
          this.send(
            c.entity,
            "media_player",
            "select_source",
            { source: v },
            (state) => state?.attributes?.source === v,
          ),
      );
      sources.querySelector("select").disabled = this.blocked(c.entity);
      audio.append(sources);
    }
    const footer = row();
    footer.classList.add("ikio-footer");
    if (c.power_entity)
      footer.append(
        reading(
          t(this.hass, "Power"),
          valueText(this.hass, c.power_entity),
          c.power_entity,
        ),
      );
    const extras = [];
    if (c.backlight_entity)
      extras.push(
        button(
          t(this.hass, "TV glow: {p0}", {
            p0: stateText(this.hass, c.backlight_entity),
          }),
          () => this.toggle(c.backlight_entity),
          { disabled: this.blocked(c.backlight_entity) },
        ),
      );
    for (const shortcut of c.shortcuts || [])
      if (shortcut.entity)
        extras.push(
          button(
            shortcut.label || this.label(shortcut.entity),
            () => this.action(shortcut.entity, shortcut.label),
            { disabled: this.blocked(shortcut.entity) },
          ),
        );
    if (extras.length)
      footer.append(
        disclosure(
          this,
          "media-extras",
          t(this.hass, "More controls"),
          ...extras,
        ),
      );
    if (footer.children.length) result.append(footer);
    return result;
  }
}
