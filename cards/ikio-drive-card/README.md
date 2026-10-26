# Ikio Drive

Install the full collection through the [HACS custom repository instructions](../../docs/ikio/INSTALLATION.md#hacs). All cards and editors share one HACS download and version.

Collection version **0.5.13**. Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.5.13` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-drive-card.js`. Use only one route.

Add card → Ikio Drive. Configure all fields through the visual editor. No YAML required. No household entities are guessed.

## Visual editor fields

| Field | Setting |
|---|---|
| image_entity | Optional image entity or sensor supplying a picture/URL |
| image | Optional native image upload |
| image_url | Optional image URL or /local/ path |
| license_plate | Optional license plate text |
| plate_country | Small outlined plate country section (default GR; empty to omit) |
| vin_entity | Optional VIN sensor |
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

## Pending compact layout and status icons

The feature branch uses two three-column rows: range/fuel/odometer above locks/doors/windows. All six readings have native HA MDI icons and remain labelled. Parking moves into the header; location age and the unboxed maps link share the footer. Optional metric bindings do not leave empty columns. There is no separate fuel progress row: when a compatible fuel volume and capacity are supplied, the Fuel value shows the calculated percentage; otherwise it preserves the sensor's units.

Secure states use the security card’s brighter green, Open/Unlocked amber, Jammed soft red, and Unknown/Unavailable/Not configured grey. Locking/Unlocking use the shared blue accent and a clock icon. Text always identifies the state; colour is supplementary. Unknown/unavailable inputs never appear secure, and the existing lock/binary-sensor interpretation is unchanged.

Metric and status controls open native HA entity details on tap or hold; the card sends no vehicle commands. An aggregate alert opens the member responsible for that state, rather than an unrelated secure member. Existing buttons retain focus during normal status updates. Invalid coordinates disable the maps link, and absent timestamps remain explicit.

These changes ship in collection version 0.5.4.

## Car image and identifiers

The header places the title and parking label on the left, optional license plate and VIN in two compact rows in the middle, and the optional car image on the right. Enter the plate as text and select the VIN sensor in the visual editor. VIN identifiers preserve their exact text, including leading zeroes, and open native sensor details on tap/hold. Unavailable VIN data remains explicit. Long identifiers wrap on narrow cards.

Use **Car image** to upload an image through Home Assistant, or **Car image URL** for a local `/local/` path or HTTP(S) URL. If both are set, the uploaded image takes precedence. Transparent cutouts work best. Images fit inside the compact header without cropping. Media-source images are resolved through Home Assistant, refreshed while visible and cleaned up on disconnect. Missing images show an inline message without hiding the readings. No household image or identifier is embedded in the collection.

Green matches the Security card for locked/closed states, with amber for unlocked/open, red for jammed, blue for locking/unlocking and grey for unknown/unavailable. Metrics remain in their compact three-column row, separated by subtle vertical dividers; status and location footer use the same arrangement as the approved mockup.

### Entity-provided image (0.5.4)

Select **Car image entity** for an `image`, `sensor`, `device_tracker` or `camera` entity. The card prefers its `entity_picture` attribute; otherwise it uses its state as the image URL. The configured entity takes precedence over uploaded/static images. Image and token changes update automatically, and unavailable entities show an inline unavailable message. Camera entities supply only their still picture; no stream is started.


### Minimal plate and larger icons (0.5.4)

The smaller license plate has a thin neutral outline and a country divider, with no coloured band or filled background. The plate and VIN share one horizontal centre. The country section defaults to GR and can be changed or omitted in the editor. VIN stays below the plate, with its native sensor details target intact.

Metric and status icons sit to the left of their label/value pair at 32 px, scaling to 24 px on narrow cards. Supporting labels are smaller than the values. The compact three-column layout, state colours, full readings and touch targets are retained.

### Smaller Drive details (0.5.4)

Metric/status icons are slightly smaller: 28 px normally and 22 px on narrow cards. The VIN displays only its value at 11 px; its accessible label and native details target remain. Plate text is 15 px normally and 13 px on narrow cards, with reduced padding around the plate and country section. Plate and VIN remain centred. **Plate country code** in the visual editor controls GR: enter another code or leave it empty to hide that section.

Version 0.5.4 reduces metric/status icons further to 24 px, or 20 px on narrow cards.


The next visual refinement uses softer palette mint (`#A4E4B8`) for locked/closed text and icons, with `#28613E` in light mode and HA’s success colour in HA appearance. Metric/status icons are 22 px (18 px on narrow cards); metric values are 18 px (15 px narrow), units 11 px and status values 13 px. Supporting labels stay 11 px and entity targets remain 44 px.
