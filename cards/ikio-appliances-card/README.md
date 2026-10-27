# Ikio Appliances

Install the full collection through the [HACS custom repository instructions](../../docs/ikio/INSTALLATION.md#hacs). All cards and editors share one HACS download and version.

Collection version: see [the shared version](../../ikio/package.json). Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.6.1` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-appliances-card.js`. Use only one route.

Add card → Ikio Appliances. Configure all fields through the visual editor. No YAML required. No household entities are guessed.

## Visual editor fields

| Field | Setting |
|---|---|
| entity | Control entity (required to operate) |
| power_entity | Power sensor |
| energy_entity | Energy sensor |
| stop_script | Stop-run script (optional) |
| confirm_manual_on | Confirm manual turn-on |

### Backend timed runs
Select an existing HA script that schedules the complete run and shutoff. The card does not create a safety timer.

- **Run label (for example 30 minutes)** (label)
- **Existing timed-run script** (start_script)
- **Backend timer (optional)** (timer_entity)

## Shared behaviour

Dark, light and follow-HA appearance use the same shared Ikio styles. Controls have at least 44 px targets; readings remain useful when another entity is offline. Native entity details open on hold. No service call is made in the editor preview. Backend errors remain visible. Optional entities may be omitted. See [full contract](../../docs/ikio/SPECIFICATION.md) and [collection status](../../docs/ikio/STATUS.md).

No external runtime CDN dependencies. esbuild MIT license is copied into the build output. Shared UI/graph code is bundled locally.
