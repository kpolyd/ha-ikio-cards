# Ikio Drive

Install the full collection through the [HACS custom repository instructions](../../docs/ikio/INSTALLATION.md#hacs). All cards and editors share one HACS download and version.

Collection version **0.3.2**. Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.3.2` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-drive-card.js`. Use only one route.

Add card → Ikio Drive. Configure all fields through the visual editor. No YAML required. No household entities are guessed.

## Visual editor fields

| Field | Setting |
|---|---|
| fuel_entity | Fuel level |
| fuel_capacity | Fuel capacity (same volume unit as fuel sensor) |
| range_entity | Remaining range |
| odometer_entity | Odometer |
| tracker_entity | Car location |
| location_entity | Parking label (optional) |
| location_timestamp_entity | Location update timestamp |
| locks_active_state | Lock indicator means unlocked when state is |
| doors_active_state | Door indicator means open when state is |
| windows_active_state | Window indicator means open when state is |

### Lock status entities
Choose an aggregate entity or all relevant members. No individual names are displayed on the card.

- **Status entity** (entity)

### Doors status entities
Choose an aggregate entity or all relevant members. No individual names are displayed on the card.

- **Status entity** (entity)

### Windows status entities
Choose an aggregate entity or all relevant members. No individual names are displayed on the card.

- **Status entity** (entity)

## Shared behaviour

Dark, light and follow-HA appearance use the same shared Ikio styles. Controls have at least 44 px targets; readings remain useful when another entity is offline. Native entity details open on hold. No service call is made in the editor preview. Backend errors remain visible. Optional entities may be omitted. See [full contract](../../docs/ikio/SPECIFICATION.md) and [collection status](../../docs/ikio/STATUS.md).

No external runtime CDN dependencies. esbuild MIT license is copied into the build output. Shared UI/graph code is bundled locally.


## Lock interpretation

Automatic handles native `lock.*` locked/unlocked states and HA lock binary sensors (`off` = Locked, `on` = Unlocked). The earlier default `unlocked` setting also accepts these binary states, so existing configurations do not need manual edits. Choose the inverted binary mapping only when the integration uses `off` for unlocked. Explicit locked/unlocked text is recognized regardless of casing. Multiple members show Unlocked if any known member is unlocked; missing or unavailable members cannot produce Locked. Native transitional/jammed states remain distinct. Doors/windows retain their original open/close interpretation.

If a source entity itself is unavailable, the card cannot recover its state; check the entity in Home Assistant. Raw binary values and HA frontend labels differ: a lock binary sensor can display Locked while its actual stored state is off. Reference: https://www.home-assistant.io/integrations/binary_sensor/ .
