# Ikio Media

A compact card for one `media_player.*` entity. Artwork is always enabled when available, behind the currently playing title, transport controls and progress bar, with a dark overlay for readable text. Missing, unsafe or failed artwork falls back to the normal surface. Power, volume, source and additional controls use the ordinary card surface. Install through the [collection instructions](../../docs/ikio/INSTALLATION.md).

## Visual configuration

| Setting | Default / behaviour |
| --- | --- |
| Media player | Required; one device per card |
| Card name | Optional; entity name by default |
| Show volume | On; joined minus / speaker-and-percentage / plus buttons |
| Volume step | 5 percentage points; whole number from 1 to 100 |
| Show source | On; integration-provided choices, hidden when off |
| Power sensor | Optional; supported power units converted to whole watts |
| Appearance | Ikio dark, Ikio light or Home Assistant |

**More controls** is an optional repeatable/reorderable list. Each entry has an **Entity** selector (`light`, `switch`, `scene` or `script`) and an optional **Name**, defaulting to the entity name. Lights/switches toggle; scenes/scripts activate. Each entry follows its own availability and pending state, independently of the media player. The section starts collapsed, uses the shared down/up chevron convention and is omitted when empty. Hold bound controls/readings for native HA details.

## Behaviour

- Playback actions, seeking, volume, mute, source and power follow actual device capabilities. Controls sit beside the playing title and wrap long text without clipping. Live/non-seekable sources never get an invented seek slider or duration.
- The speaker icon sits above the percentage inside the central mute button. After backend confirmation, muting shows the crossed-out speaker and **Muted**. Without mute support this centre is a read-only volume display.
- A configurable step uses `volume_set` when a known numeric volume is available. Step-only devices use their native `volume_up`/`volume_down`; the integration determines that native increment. Missing volume is **—**, never a fabricated zero. Zero and 100% disable their respective boundary button.
- Seeking previews locally, submits on commit and preserves focus/drafts across position ticks. Display elapsed/total times, including hours. Only valid playing positions run a one-second display timer, stopped while hidden, disconnected or in dashboard preview.
- Off hides artwork, playing information, transport, timeline, volume and source, removing the empty controls row. Optional independent power readings and More controls remain. Unavailable devices show an explicit message and disabled power action while independently available entities remain usable.
- Pending confirmation and backend errors remain visible. Dashboard preview never sends commands. English/Greek follow the HA language; mock galleries default to English.

## Migration

The old `show_artwork` option is removed; artwork is always enabled when provided. Existing `entity`, `name`, `show_volume`, `show_source`, `power_entity`, appearance and HA dashboard metadata remain.

When `more_controls` is absent, migrate `backlight_entity` as the first entry and append old `shortcuts` in their existing order, mapping `label` to `name`. Remove those legacy keys from normalized editor output. An explicitly supplied `more_controls`, including an empty list, takes precedence so removed entries do not reappear. No configuration mutation occurs on the supplied object. Existing cards work through normalization; saving the editor persists the new format.

Automated DOM tests and simulated browser previews do not establish live-device or native HA editor/icon compatibility. No external runtime JavaScript or artwork lookup service is added; artwork comes from the selected player's entity picture. The preview artwork is an original simulated illustration.
