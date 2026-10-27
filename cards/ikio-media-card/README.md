# Ikio Media

A compact card for one `media_player.*` entity. Available artwork sits behind the currently playing title, transport controls and progress bar, softly fading into the card on all four edges. A theme-aware overlay and native text colours preserve readability in dark, light and HA themes. Missing, unsafe or failed artwork falls back to the normal surface. Wattage sits beside the power button in the header; volume and source retain the ordinary card surface. Install through the [collection instructions](../../docs/ikio/INSTALLATION.md).

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

More controls has been removed from the card and visual editor. Tap the wattage to open its sensor details, or hold bound controls/readings for native HA details. The power reading remains available independently of player power capabilities and availability.

## Behaviour

- Playback actions, seeking, volume, mute, source and power follow actual device capabilities. Controls sit beside the playing title and wrap long text without clipping. Live/non-seekable sources never get an invented seek slider or duration.
- The speaker icon sits above the percentage inside the central mute button. After backend confirmation, muting shows the crossed-out speaker and **Muted**. Without mute support this centre is a read-only volume display.
- A configurable step uses `volume_set` when a known numeric volume is available. Step-only devices use their native `volume_up`/`volume_down`; the integration determines that native increment. Missing volume is **—**, never a fabricated zero. Zero and 100% disable their respective boundary button.
- Seeking previews locally, submits on commit and preserves focus/drafts across position ticks. Display elapsed/total times, including hours. Only valid playing positions run a one-second display timer, stopped while hidden, disconnected or in dashboard preview.
- Off collapses to the header: hide artwork, playing information, transport, timeline, volume, source and the redundant Nothing playing message. Keep the optional independent wattage beside the power action. Unavailable devices show an explicit message and disabled power action; the sensor reading retains its own availability.
- Pending confirmation and backend errors remain visible. Dashboard preview never sends commands. English/Greek follow the HA language; mock galleries default to English.

## Migration

The old `show_artwork` option is removed; artwork is always enabled when provided. Existing `entity`, `name`, `show_volume`, `show_source`, `power_entity`, appearance and HA dashboard metadata remain.

Normalize away `more_controls`, `backlight_entity` and `shortcuts`, including malformed retired values. These extra entities are no longer rendered, operated or subscribed to by the card. The supplied object is not mutated; saving the editor persists the remaining media configuration. Extra entities can be placed in separate dashboard controls.

Automated DOM tests and simulated browser previews do not establish live-device or native HA editor/icon compatibility. No external runtime JavaScript or artwork lookup service is added; artwork comes from the selected player's entity picture. The preview artwork is an original simulated illustration.
