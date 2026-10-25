# Ikio Security

Install the full collection through the [HACS custom repository instructions](../../docs/ikio/INSTALLATION.md#hacs). All cards and editors share one HACS download and version.

Collection version **0.5.7**. Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.5.7` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-security-card.js`. Use only one route.

Add card → Ikio Security. Configure all fields through the visual editor. No YAML required. No household entities are guessed.

## Visual editor fields

| Field | Setting |
|---|---|
| entity | Alarm panel (required to operate) |
| modes | Arming modes |
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

## Automatic Alarmo sensors and direct arming (0.5.4)

Select the Alarmo panel; no sensor list is required in this card. Read-only `alarmo/entities` and `alarmo/sensors` requests discover its enabled sensors, scoped to the selected area or all areas for the master panel. HA state changes keep their status and native icons current. Alarmo configuration updates refresh the list, with a periodic fallback and lifecycle cleanup. Sensor labels include full friendly/device names so multiple devices are not all called Opening. Optional manual rows remain as extra/fallback bindings.

Home/Away now arm immediately when no code is required. Checking **Bypass open sensors** is the explicit bypass choice; tapping a mode submits that choice without an additional confirmation screen. A required code still opens the inline PIN pad and needs submission; normal exit delays remain. Legacy `confirm_arm` settings are accepted but no longer add a review step. Alarmo failure events display the rejection reason and cancel the pending timeout immediately. Fresh blocking-sensor attributes provide fallback feedback if events are unavailable. Discovery failures and an empty configuration never show a green all-clear.

API references: [Alarmo websocket handlers](https://github.com/nielsfaber/alarmo/blob/main/custom_components/alarmo/websockets.py), [failure events](https://github.com/nielsfaber/alarmo/blob/main/custom_components/alarmo/event.py).

Discovery is retained in memory while the card is hidden; returning immediately renders current HA sensor states and restores subscriptions. An interrupted initial load restarts on return. Discovery requests time out after five seconds and show an unavailable warning instead of indefinite loading; periodic refresh retries failures. An unavailable list never implies that every sensor is clear. The status shield is 32 px inside the unchanged 58 px circle.


## Live countdown (0.5.5)

During exit/entry delay the header shows remaining seconds and a shrinking coral ring around the smaller shield. Open-sensor warnings remain amber; the armed state turns green only after confirmation from Alarmo. Timing comes from `alarmo/countdown`, with local one-second ticks and a background resync every 15 seconds. Returning to the card resyncs the actual remaining time. If timing is unavailable the state and PIN controls remain usable without invented seconds. The static configured-delay note is removed. Reduced-motion settings disable ring transitions.

Sensor names and icons are collapsed by default. Tap the sensor count/status row to expand or collapse the details. Alert counts and the bypass checkbox remain visible, and the PIN pad stays independent of the disclosure. Expansion persists during live updates and resets after all alerts clear or the card is reconfigured.
