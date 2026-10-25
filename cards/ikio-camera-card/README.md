# Ikio Camera

Install the full collection through the [HACS custom repository instructions](../../docs/ikio/INSTALLATION.md#hacs). All cards and editors share one HACS download and version.

Collection version **0.5.7**. Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.5.7` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-camera-card.js`. Use only one route.

Add card → Ikio Camera. Configure all fields through the visual editor. No YAML required. No household entities are guessed.

## Visual editor fields

| Field | Setting |
|---|---|
| entity | Camera (required to operate) |
| power_switch | Camera power switch |
| snapshot_automation | Snapshot automation |
| snapshot_script | Existing snapshot script |
| capture_timestamp_entity | Image capture timestamp (optional) |

## Shared behaviour

Dark, light and follow-HA appearance use the same shared Ikio styles. Controls have at least 44 px targets; readings remain useful when another entity is offline. Native entity details open on hold. No service call is made in the editor preview. Backend errors remain visible. Optional entities may be omitted. See [full contract](../../docs/ikio/SPECIFICATION.md) and [collection status](../../docs/ikio/STATUS.md).

No external runtime CDN dependencies. esbuild MIT license is copied into the build output. Shared UI/graph code is bundled locally.
