# Ikio System

Collection version **0.3.0**. Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.3.0` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-system-card.js`. Use only one route.

Add card → Ikio System. Configure all fields through the visual editor. No YAML required. No household entities are guessed.

## Visual editor fields

| Field | Setting |
|---|---|
| availability_entity | Availability |
| uptime_entity | Uptime |
| cpu_entity | CPU utilization |
| temperature_entity | CPU temperature |
| ram_used_entity | RAM used |
| ram_total_entity | RAM total |
| ram_percent_entity | RAM utilization |
| disk_used_entity | Disk used |
| disk_total_entity | Disk total |
| disk_percent_entity | Disk utilization |
| database_entity | Database size |
| network_rx_entity | Network receive rate |
| network_tx_entity | Network transmit rate |
| online_state | Availability state meaning Online (default on) |
| uptime_mode | Uptime interpretation |

### Metric thresholds
Add, remove and reorder rows in the editor.

- **Metric** (metric)
- **Warning threshold** (warning)
- **Critical threshold** (critical)
- **Threshold direction** (direction)

### Service status and controls
Add, remove and reorder rows in the editor.

- **Service name** (name)
- **Service health/status** (status_entity)
- **Service power switch** (control_entity)
- **Existing restart action** (restart_action)

## Shared behaviour

Dark, light and follow-HA appearance use the same shared Ikio styles. Controls have at least 44 px targets; readings remain useful when another entity is offline. Native entity details open on hold. No service call is made in the editor preview. Backend errors remain visible. Optional entities may be omitted. See [full contract](../../docs/ikio/SPECIFICATION.md) and [collection status](../../docs/ikio/STATUS.md).

No external runtime CDN dependencies. esbuild MIT license is copied into the build output. Shared UI/graph code is bundled locally.
