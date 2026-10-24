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
    if (!c.entity) return note("Choose a media player in the visual editor.");
    const result = group(
      title(
        this,
        c.name || this.label(c.entity),
        c.entity,
        stateText(this.hass, c.entity),
      ),
    );
    const artwork = safeImage(a.entity_picture, this.hass);
    if (c.show_artwork !== false && artwork && s?.state !== "off") {
      const image = el("img");
      image.src = artwork;
      image.alt = "Media artwork";
      image.style.cssText =
        "width:48px;height:48px;object-fit:cover;border-radius:8px";
      result.append(
        row(
          image,
          note(
            [a.media_title, a.media_artist || a.media_series_title]
              .filter(Boolean)
              .join(" · "),
          ),
        ),
      );
    } else if (a.media_title) result.append(note(a.media_title));
    const p = position(s);
    if (p) {
      const format = (t) =>
        `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
      if (features(s, 2)) {
        const seek = range(
          "Playback",
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
        bar.setAttribute("aria-label", "Playback progress");
        result.append(
          row(note(`${format(p.value)} / ${format(p.duration)}`), bar),
        );
      }
    }
    const controls = transport(s).map((action) =>
      button(
        action.label,
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
          s.state === "off" ? "Power on" : "Power off",
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
    if (controls.length) result.append(row(...controls));
    if (c.show_volume !== false) {
      const volumeRow = row();
      if (features(s, 4) && Number.isFinite(a.volume_level)) {
        const volume = range(
          "Volume",
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
            a.is_volume_muted ? "Unmute" : "Mute",
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
      result.append(volumeRow);
    }
    if (c.show_source !== false && features(s, 2048) && a.source_list?.length) {
      const sources = select("Source", a.source_list, a.source, (v) =>
        this.send(
          c.entity,
          "media_player",
          "select_source",
          { source: v },
          (state) => state?.attributes?.source === v,
        ),
      );
      sources.querySelector("select").disabled = this.blocked(c.entity);
      result.append(sources);
    }
    if (c.power_entity)
      result.append(
        reading("Power", valueText(this.hass, c.power_entity), c.power_entity),
      );
    if (c.backlight_entity)
      result.append(
        button(
          `TV glow: ${stateText(this.hass, c.backlight_entity)}`,
          () => this.toggle(c.backlight_entity),
          { disabled: this.blocked(c.backlight_entity) },
        ),
      );
    for (const shortcut of c.shortcuts || [])
      if (shortcut.entity)
        result.append(
          button(
            shortcut.label || this.label(shortcut.entity),
            () => this.action(shortcut.entity, shortcut.label),
            { disabled: this.blocked(shortcut.entity) },
          ),
        );
    return result;
  }
}
