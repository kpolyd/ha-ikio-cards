# Ikio Server Monitor

Install the full collection through the [HACS custom repository instructions](../../docs/ikio/INSTALLATION.md#hacs). All cards and editors share one HACS download and version.

Collection version: see [the shared version](../../ikio/package.json). Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.6.4` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-server-monitor-card.js`. Use only one route.

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

An optional **IP address sensor** selector supplies the current address shown faintly beside the server name, wrapping below it when space is limited. IPv4 and IPv6 values are displayed exactly as reported.

## Shared behaviour

Dark, light and follow-HA appearance use the same shared Ikio styles. Controls have at least 44 px targets; readings remain useful when another entity is offline. Native entity details open on hold. No service call is made in the editor preview. Backend errors remain visible. Optional entities may be omitted. See [full contract](../../docs/ikio/SPECIFICATION.md) and [collection status](../../docs/ikio/STATUS.md).

No external runtime CDN dependencies. esbuild MIT license is copied into the build output. Shared UI/graph code is bundled locally.


## Compact system overview (0.5.7)

CPU/RAM/disk use small mint rings with percentages inside and optional capacity details below. Fixed limits (warning 70, error 85) change rings to amber/error; missing values show a dash and no usage arc. System temperature sits in the header, independently of CPU, alongside uptime. Uptime chooses whole days/hours/minutes/seconds from a timestamp or a numeric duration with an explicit time unit. Offline/unavailable availability takes priority; invalid uptime falls back to status instead of inventing a duration.

Existing network receive/transmit entities supply Download/Upload labels and one shared 30-minute graph. Rate history is normalized to bytes per second (including bit and binary byte units); live labels retain source units. Total/cumulative sensors are not treated as rates. History is requested in one batch per minute while visible, bounded to five seconds, and ignores late replies after hiding/reconfiguration/disconnect. Missing history does not hide live speeds. Services remain expandable and restarts retain inline consent.


### Automatic setup and mock proportions

Select the uptime sensor directly; ISO timestamps, numeric durations with explicit units, simple duration text and H:MM:SS are detected automatically. Availability recognizes common online/offline values and problem-sensor semantics. The old Availability state and Uptime interpretation fields are no longer shown; legacy values are accepted but ignored. An unrecognized uptime format does not produce an invented duration.

Rings scale with card width to match the approved proportions. Services uses a chevron. Database remains accessible in the collapsed footer, without an extra overview row. RAM/disk accept used + remaining sensors without a total sensor: utilization is used / (used + remaining). Units are converted before adding, including MB/GB and MiB/GiB. A configured percentage remains authoritative, followed by used/total when a valid total is available. RAM/disk retain compact used / total captions: when no valid total sensor is available, total is derived from used + remaining before rounding. These captions and RAM/disk percentages display whole numbers. Calculations, ring geometry and warning thresholds retain full precision. Network min/max labels show at most one decimal; other readings keep their existing precision. A percentage alone cannot provide a capacity. Zero recorded network traffic correctly draws a flat trace. The network graph shows the visible combined minimum and maximum on a compact left axis, in readable B/s, kB/s, MB/s or larger units, with subtle dashed guides. Download and upload share the observed scale; constant traffic uses one label and guide. Missing data stays blank.


Metric thresholds are automatic too: warning starts at 70 and error at 85 (inclusive, above direction). These apply to utilization percentages and the selected temperature reading in its displayed unit. The threshold list is removed from the editor; existing threshold entries are accepted but ignored. Unknown measurements have no severity arc.

### Compact services

Expanded services use two compact tiles per row on mobile and three on cards with at least 480 px of content width. Each tile shows a status dot, name and optional icon-sized power/restart controls with 44 px touch targets. Running status is available to assistive technology without repeated visible text; stopped, unavailable, unknown, custom and error states retain visible text. The configured health entity takes precedence over the power switch, including when health is unavailable. Tap/hold the name to open native entity details. Restart retains inline confirmation, pending and unavailable controls remain disabled, and services with both actions have a second compact control row. The existing expandable Services section and service configuration remain unchanged.

### Extra readings

Add sensor/name rows with optional **Show name** and **Icon** settings in the visual editor's **Extra readings** list. Sensor is required; the name is optional and defaults to the entity name. Chips appear between the header and resource rings, in configured order, using the same compact renderer as the standalone Chip card/badge: 28 px visible height without names (default), 34 px with stacked names, a thin theme-aware border and 7 px corners. Each reading has an optional native icon override. Transparent touch targets remain 44 px. They wrap without adding a heading and open native details on tap/hold. The renderer is shared with the standalone Ikio Chip card.

Existing database_entity bindings migrate into a Database extra reading when the new list is absent. New-list configurations take precedence, including an explicitly empty list. The editor exposes and saves the migrated entry; removing it does not restore the old DB binding. Database readings no longer appear below services.

Select an optional IP address sensor to show its current IPv4 or IPv6 value beside the server name. Values update with Home Assistant; unavailable or missing sensors remain explicit. Legacy manual IP text remains visible until a sensor is selected. Extra reading names are shown by default; explicit `show_name: false` still hides them.
