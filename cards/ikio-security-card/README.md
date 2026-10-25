# Ikio Security

Install the full collection through the [HACS custom repository instructions](../../docs/ikio/INSTALLATION.md#hacs). All cards and editors share one HACS download and version.

Collection version **0.5.1**. Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.5.1` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-security-card.js`. Use only one route.

Add card → Ikio Security. Configure all fields through the visual editor. No YAML required. No household entities are guessed.

## Visual editor fields

| Field | Setting |
|---|---|
| entity | Alarm panel (required to operate) |
| modes | Arming modes |
| confirm_arm | Review before arming |
| allow_override | Show Alarmo open-sensor override |

### Monitored openings
Add, remove and reorder rows in the editor.

- **Contact** (entity)
- **Name** (name)

### Current motion
Add, remove and reorder rows in the editor.

- **Motion / occupancy** (entity)
- **Name** (name)

## Shared behaviour

Dark, light and follow-HA appearance use the same shared Ikio styles. Controls have at least 44 px targets; readings remain useful when another entity is offline. Native entity details open on hold. No service call is made in the editor preview. Backend errors remain visible. Optional entities may be omitted. See [full contract](../../docs/ikio/SPECIFICATION.md) and [collection status](../../docs/ikio/STATUS.md).

No external runtime CDN dependencies. esbuild MIT license is copied into the build output. Shared UI/graph code is bundled locally.

## Alarm controls

The circular status icon and segmented mode selector follow the Alarmo layout. Armed states use prominent green styling; entry/exit delays and bypassed/open sensors use amber; triggered alarms use the error colour. Sensors appear as compact labels above the mode selector, using Home Assistant's state icons (including entity icon overrides). Presence rows are no longer displayed or offered in the editor; legacy configuration remains accepted.

When disarmed and open sensors are present, Alarmo's optional **Bypass open sensors** checkbox appears above the warning. It defaults off and resets after an arming attempt or alarm state change. It is available only when Alarmo's arm service is present and overrides are enabled. An inline review names the affected sensors before submitting forced arming; required codes and normal exit delay still apply. Confirmed bypasses are displayed from the panel's `bypassed_sensors` attribute, rather than inferred from the checkbox.

The masked PIN field and numeric keypad remain visible while armed, including armed-with-bypasses, triggered, and entry/exit delay states. Enter the code and press **Disarm**; merely selecting Disarmed focuses the field. Text codes can also be entered with the keyboard. Code-free panels allow disarming without a PIN. Arming reviews and required arming codes also appear inside the card. No action dialog is used. Codes are cleared after submission, state/configuration changes, hiding, and disconnect; they are never saved in configuration. Backend errors remain inline and the keypad stays visible until the panel confirms disarming.
