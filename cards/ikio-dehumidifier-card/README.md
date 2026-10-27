# Ikio Dehumidifier

A compact card for one Home Assistant `humidifier.*` dehumidifier per instance. Its target-humidity semicircle, secondary readings and segmented modes follow Ikio Climate. Install through the [collection instructions](../../docs/ikio/INSTALLATION.md).

Drag the arc to preview a humidity target and release to submit one command, use minus/plus, or focus the dial and use arrow keys. Follow the integration's min/max humidity and target humidity step (fallback 1). Off preserves measurements and disables the target dial. Target/mode selection waits for backend confirmation; pending, failure and timeout feedback remain visible. Hold entity controls for native HA details.

## Visual configuration

| Field | Behaviour |
| --- | --- |
| Dehumidifier entity | Required; `humidifier.*` |
| Name | Optional; entity name by default |
| Humidity sensor | Optional override; otherwise device `current_humidity` |
| Power sensor | Optional; converts supported power units to whole watts |
| Tank-full sensor | Optional `binary_sensor.*`; warnings remain visible outside device settings |
| Tank-full state | On by default; choose Off for inverse polarity |
| Humidity step | Empty = Auto; an override requests a larger whole multiple of the integration step |
| Show mode | Enabled by default; modes require the native feature and actual available options |
| Fan-speed entity | Optional `select.*` or `fan.*`; controls follow its options or supported speed/preset capabilities |
| Appearance | Ikio dark (default), Ikio light or Home Assistant |

There are no fixed mode names, fabricated readings or fan/tank auto-discovery. Native integration mode labels and values are preserved. Off is always available; when no native modes are shown an On button is provided. Selecting a native mode while off explicitly calls turn-on before set-mode, since changing a mode alone does not guarantee power-on. Hiding/reconfiguring/removing the card cancels an unsent follow-up. The header reports the device's actual action (On when none is supplied), with tank-full warnings from the configured sensor. An unknown/unavailable tank sensor is never shown as empty.

Device settings start collapsed and retain expansion/focus during ordinary updates. Valid independent readings remain visible while the main device is unavailable. Dashboard preview sends no commands. All built-in labels and editor fields follow the Home Assistant language, currently English/Greek with English fallback; simulated galleries default to English.

This is a new card with no automatic migration from Climate. Existing Climate cards retain their configuration; add Dehumidifier separately through the card picker. Multiple devices use multiple card instances.

Automated DOM tests and simulated browser previews do not establish live-device or native HA integration compatibility.
