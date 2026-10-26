# Ikio Server Monitor

Install the full collection through the [HACS custom repository instructions](../../docs/ikio/INSTALLATION.md#hacs). All cards and editors share one HACS download and version.

Collection version **0.6.3**. Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.6.3` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-server-monitor-card.js`. Use only one route.

Add card → Ikio Server Monitor. Configure all fields through the visual editor. No YAML required. No household entities are guessed.

## Visual editor fields

| Field | Setting |
|---|---|
| uptime_entity | Uptime |
| cpu_entity | CPU utilization |
| temperature_entity | CPU temperature |
| ram_used_entity | RAM used |
| ram_free_entity | RAM remaining / available |
| ram_total_entity | RAM total (optional with remaining) |
| ram_percent_entity | RAM utilization |
| disk_used_entity | Disk used |
| disk_free_entity | Disk remaining |
| disk_total_entity | Disk total (optional with remaining) |
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


## Compact system overview (0.5.7)

CPU/RAM/disk use small mint rings with percentages inside and optional capacity details below. Fixed limits (warning 70, error 85) change rings to amber/error; missing values show a dash and no usage arc. System temperature sits in the header, independently of CPU, alongside uptime. Uptime chooses whole days/hours/minutes/seconds from a timestamp or a numeric duration with an explicit time unit. Offline/unavailable availability takes priority; invalid uptime falls back to status instead of inventing a duration.

Existing network receive/transmit entities supply Download/Upload labels and one shared 30-minute graph. Rate history is normalized to bytes per second (including bit and binary byte units); live labels retain source units. Total/cumulative sensors are not treated as rates. History is requested in one batch per minute while visible, bounded to five seconds, and ignores late replies after hiding/reconfiguration/disconnect. Missing history does not hide live speeds. Services remain expandable and restarts retain inline consent.


### Automatic setup and mock proportions

Select the uptime sensor directly; ISO timestamps, numeric durations with explicit units, simple duration text and H:MM:SS are detected automatically. Availability recognizes common online/offline values and problem-sensor semantics. The old Availability state and Uptime interpretation fields are no longer shown; legacy values are accepted but ignored. An unrecognized uptime format does not produce an invented duration.

Rings scale with card width to match the approved proportions. Services uses a chevron. Database remains accessible in the collapsed footer, without an extra overview row. RAM/disk accept used + remaining sensors without a total sensor: utilization is used / (used + remaining). Units are converted before adding, including MB/GB and MiB/GiB. A configured percentage remains authoritative, followed by used/total when a valid total is available. Capacity captions retain the compact used / total format; when no total sensor is available, total is calculated as used + remaining before rounding. Values are displayed as whole numbers, except network min/max labels which show at most one decimal; utilization, plot positions and threshold checks retain full precision. A percentage alone cannot provide a capacity. Zero recorded network traffic correctly draws a flat trace. The network graph shows the visible combined minimum and maximum on a compact left axis, in readable B/s, kB/s, MB/s or larger units, with subtle dashed guides. Download and upload share the observed scale; constant traffic uses one label and guide. Missing data stays blank.


Metric thresholds are automatic too: warning starts at 70 and error at 85 (inclusive, above direction). These apply to utilization percentages and the selected temperature reading in its displayed unit. The threshold list is removed from the editor; existing threshold entries are accepted but ignored. Unknown measurements have no severity arc.
