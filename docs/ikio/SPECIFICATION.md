# Ikio cards — implementation specification

Design handoff · 24 October 2026 · version 3

## 1. Goal and deliverables

Implement a cohesive family of eleven compact, mobile-first Home Assistant custom cards. Each card provides direct controls or focused summaries using a shared visual system.

Editable SVG compositions are in `design/`; current interactive fixture previews are in `dev/previews/`. This document records the design decisions, with later sections overriding earlier proposals. All example readings are illustrative, not live measurements or evidence of device support.

The requested outcome is a functioning card family with full graphical editors. No required option may depend on YAML, templates, CSS snippets, entity IDs typed by hand, or browser developer tools. Installation of custom frontend resources is a separate one-time process and must be documented through Home Assistant's UI. Backend automations remain optional dependencies selected through pickers.

| Card name | Element / config type suffix | Primary purpose | Mockup |
|---|---|---|---|
| Light Studio | `ikio-lights-card` | Mixed light/switch control, selected-light detail | [SVG](design/compact-lights.svg) |
| Room Comfort | `ikio-climate-card` | Room readings, AC, dehumidifier or fan | [SVG](design/compact-comfort.svg) |
| Appliance Run | `ikio-appliances-card` | Switch, actual power and optional timed run | [SVG](design/compact-appliance.svg) |
| Media Session | `ikio-media-card` | Current media, transport, source and volume | [SVG](design/compact-media.svg) |
| Cleaning Mission | `ikio-vacuum-card` | Vacuum state and supported cleaning actions | [SVG](design/compact-cleaning.svg) |
| Security Readiness | `ikio-alarmo-card` | Alarm, open contacts, presence and motion | [SVG](design/compact-security.svg) |
| Camera Window | `ikio-camera-card` | On-demand camera, optional power/snapshot controls | [SVG](design/compact-camera.svg) |
| Energy Ledger | `ikio-electricity-card` | Power, tariff usage, costs and breakdown | [SVG](design/compact-energy.svg) |
| System Pulse | `ikio-server-monitor-card` | Host metrics, availability and optional services | [SVG](design/compact-system.svg) |
| Drive Brief | `ikio-vehicle-card` | Fuel, range, odometer and parking | [SVG](design/compact-drive.svg) |

| Graph | `ikio-graph-card` | Numeric history and value-based colours | [SVG](design/compact-graph.svg) |

Use `custom:` before each suffix in saved dashboard configuration. These are independent reusable cards, not a single monolithic dashboard. The monitoring cards need not invent actuator controls to qualify as useful cards.

## 2. Visual system

### Source of continuity

The shared colour system uses temperature `#a4e4b8`, humidity `#adcfff`, power `#f2d487`, fridge `#b9e6ff`, active device `#90caf9`, open contact `#f2c66d`, primary text `#e5e9e7` and secondary text `#a4adb2`. The dark surface is `#17282e` and selected toolbar colour is `#25564c`. Reuse those meanings. Use readable mobile typography for interactive controls.

The proposal introduces opaque teal card surfaces, subtle borders, a small icon tile, larger typography and distinct layouts for each task. No glass blur, animated glows, spinning fans, large empty circular gauges, photographic car cutouts or copied floor-plan layouts. Use Material Design icons through HA's icon component in production; the SVGs use simple original line drawings as placeholders.

### Tokens and sizing

- Card surface `#17282e`; nested surface `#21353b`; border `#34474d`; selected button `#25564c`; primary text `#e5e9e7`. Error accent `#f2a69b`.
- Card radius 16 px, nested panels 12 px, controls 10 px, status chips 7 px. Border 1 px; no heavy shadow.
- Padding 16 px, control gap 8 px, section gap 16 or 24 px. Touch targets at least 44×44 px, preferably 48 px. Slider track may be thin but its hit area must be 44 px high.
- Title 16 px semibold, body 14–16 px, secondary text at least 12 px, large reading 36–44 px. Use system/HA font; tabular numerals for dynamic readings. Small presentation captions in the mockups must become at least 12 px in production.
- Normal card design width 380 px; wide monitoring composition 520 px. Adapt to container width, not viewport width. At 280–359 px, stack crowded rows and wrap labels; never shrink touch targets. Two tariff tiles become one column below 400 px.
- Long names wrap to two lines; full accessible names remain available. Do not rely on hover. No horizontal scrolling for the whole card. More than four modes use a native select rather than cramped segments.
- Provide an Appearance choice: **Ikio dark** (the illustrated default), **Follow HA theme**, **Ikio light**. Light mode uses a pale neutral/teal surface, dark foreground and darker versions of semantic colours; do not paste pastel text onto white. Expose accent choice, density Normal/Compact and optional icon/name. Compact retains useful readings and actions; reduce spacing and visual hierarchy rather than hiding information. No arbitrary colour code entry required.
- Motion is limited to 140 ms state feedback. Respect reduced motion. Do not animate constantly when idle.

### Common control rules

The icon/name opens entity more-info, not a toggle. Dedicated power buttons toggle explicitly. Holding any entity control opens native HA more-info. No hold action opens custom settings. On lighting buttons, tap toggles and dragging the embedded track changes brightness; suppress click and long-press after a drag. A visible ellipsis opens details/settings available to the user; it never grants dashboard editing permission. Buttons carry descriptive accessible labels such as “Turn off entrance light”.

Use real buttons, labelled sliders and keyboard-operable selects. Give mode tabs appropriate selected semantics, focus outlines and arrow-key navigation. Do not communicate status only through colour. Measured values, target values and units must be unambiguous. A state chip that can act must have a full-size hit target; otherwise it is read-only. Announce action failures and meaningful state changes without reading every sensor update aloud.

## 3. Graphical configuration contract

### Home Assistant integration

Register each card in `window.customCards` with name, description, preview and documentation link. Supply `getStubConfig()`, `setConfig()`, a `hass` setter and a visual editor. Current HA documentation offers `getConfigForm()` for schema-only editors and `getConfigElement()` for custom ones; if both exist, the custom element takes precedence. Custom editors receive `hass` and `setConfig()` and emit `config-changed` with the complete config, bubbling across shadow boundaries. Use HA form selectors and controls. [S1]

Use a custom editor for the family because repeatable rows, capability warnings and dependent options are central. Keep it thin: compose reusable entity fields and sections; do not invent a second configuration framework. HA frontend elements are internal rather than a version-stable third-party API; isolate access in a compatibility module and test against the installed HA frontend. Verify the exact HA version before coding rather than inferring it from screenshot dates. [S2]

### User flow

1. Add card → search “Ikio” → select a named card.
2. Content section shows the required entity selector and useful optional selectors. Empty picker configuration shows an instructional preview, with controls disabled; no fake live entities.
3. Selecting an entity immediately updates the preview and capability notes. Use friendly name, entity ID and area in search results so similar names can be distinguished. Suggestions can prioritize the chosen area, but never silently bind a guessed entity.
4. Appearance and Actions sections expose every supported option. Editor changes are local until HA's Save action. The editor must not trigger devices, start streams or execute scripts while previewing.
5. Save and reopen: every field, list order and choice round-trips. Removing a configured entity from HA yields “Entity not found” without destroying the saved binding. The user can replace it in the picker.

A required field has inline validation. A temporary offline entity is allowed as a saved configuration. A domain mismatch is a configuration error, not an offline state. Optional selectors include a clear/remove action. Repeating lists support add, remove and accessible move up/down; drag-and-drop is optional. For long lists, the editor shows the same ordering as the card.

HA's selector vocabulary includes domain-filtered entity, select, number and icon inputs. Use selectors for values, not raw text entry of service payloads. Do not confuse an automation action sequence selector with dashboard action configuration. [S3]

### Shared internal schema (not a user editing requirement)

```ts
type BaseConfig = {
  type: string;
  schema_version: 1;
  name?: string;
  icon?: string;
  appearance?: {
    theme: 'dark' | 'ha' | 'light';
    density: 'normal' | 'compact';
    accent: 'auto' | 'blue' | 'mint' | 'amber';
  };
  details?: { mode: 'more-info' | 'navigate'; path?: string };
};
type EntityRow = { entity: string; name?: string; icon?: string };
type ExistingAction = { entity: string; label: string; confirm: boolean };
```

ExistingAction is an entity selected from `script`, `scene` or `button`, according to the particular field. It is not arbitrary JavaScript or an unvalidated service name. Dispatch the corresponding domain action. For optional navigation, provide a dashboard/view selector when available on the supported frontend; otherwise retain more-info as the complete default and expose a validated relative path text field as an optional advanced choice. Nothing requires a URL.

Preserve HA-owned keys such as layout and visibility metadata through editor changes. Version schemas from the first release. Never mutate an incoming config object. Normalize defaults consistently at runtime and editor boundaries. Unsupported future schema versions show a helpful message instead of silently discarding fields.

## 4. State and interaction model

Every actuator has a state adapter and an action adapter. Format locale-sensitive values with HA formatters or Intl using the user's HA locale. Raw states drive logic; translated labels are presentation only. Read units from entities; do not hardcode °C, kilometres, litres or euros globally. Decimal commas and locale-specific currency placement must work.

| Situation | Display | Behaviour |
|---|---|---|
| Normal off/idle | Neutral label; valid measurements remain | Appropriate start/on control |
| Normal active | Domain accent and actual activity | Appropriate stop/off/pause control |
| Awaiting action | Small pending indicator on affected control | Prevent duplicate identical requests |
| Service rejected | Clear error near the control | Keep actual HA state, allow retry |
| State not confirmed after 10 s | “No confirmation yet” | End spinner; do not claim failure or success |
| Unknown | “Unknown”; no fabricated reading | Disable actions requiring known capabilities |
| Unavailable | Offline message | Disable entity actions, allow details |
| Entity absent | “Entity not found” + name/ID in details | Allow editor replacement |
| Optional sensor unavailable | Em dash and unavailable label | Other controls continue |

A successful service response is not proof of the final physical state. Track the intended predicate (e.g. target temperature changed) until a relevant state update confirms it. Ignore late results from obsolete configuration or disconnected elements. Handle remote changes during a gesture: preserve the user's draft until release, then reconcile from HA. No optimistic fake sensor values.

Sliders show local feedback during drag and send one final request on pointer release/keyboard commit; optionally debounce repeated keyboard steps for 250 ms. Clamp to the advertised range and step. Do not send dozens of service calls while dragging. An off brightness-capable light shows “Off” plus its retained setting when known; brightness zero must not force an on/off-only light to appear off.

No dashboard background click should operate an entity. In preview mode all service actions and live media are disabled. Clean up observers, listeners, subscriptions, pending timers and media streams on disconnect. A remapped entity must immediately stop driving the old entity's UI.

## 5. Per-card designs and contracts

### 5.1 Light Studio — `ikio-lights-card`

**Use case:** living-room ceiling strip and TV glow; kitchen mixed switches; office strip; entrance, balcony and bedroom light. Group by room rather than one enormous whole-home lighting card.

**Layout:** compact per-light buttons, 76–88 px high. Name and state inside each button; an embedded bottom brightness track for capable lights. No selected-light well or shared lower controls.

**Editor:** `lights: EntityRow[]` (required, light/switch; default one empty picker); `controls: {brightness: auto|hide, colour: auto|hide}`; `show_group_power: boolean` default false; normal appearance fields. Reordering changes display order. Selecting a switch explains that only power is available. TV glow allows a per-row `control_mode: auto|power-only` override; set power-only through the editor for the known device below.

**Actions:** use `light.turn_on/off` for lights and `switch.turn_on/off` for switches. Brightness UI 0–100 maps to HA's brightness percentage action; zero intentionally switches off. Colour-temperature range comes from the entity, and use a supported Kelvin parameter on the target HA version. RGB/HS controls appear only for advertised colour modes. Do not send colour fields to on/off-only lights. [S4]

**Details:** warmth and colour are adjusted in native entity details, opened on hold. Optional explicit group power is editor-controlled; only configured members are affected.

**Acceptance:** `light.h66a0` remains on when HA state is on even if brightness/RGB attributes are zero. Kitchen switches have no fake sliders. Dragging brightness must not toggle the light. Partial availability does not disable the whole group.

### 5.2 Room Comfort — `ikio-climate-card`

**Use case:** living room AC plus dehumidifier; bedroom fan plus separate light card; balcony/bathroom read-only climate summaries. Do not place the bedroom fan in the living-room instance merely because it is shown on the same dashboard.

**Layout:** room measured temperature and humidity; tabs for configured actuators; target/setpoint panel and supported mode controls. When only one actuator is present, omit tabs. When no actuator exists, render a smaller room-reading card. Details include extra supported fan/preset/swing settings. Optional fridge reading uses a separate labelled ice-blue row, never replaces room temperature.

**Editor:** `temperature_entity?` (temperature sensor), `humidity_entity?` (humidity sensor), `climate_entity?`, `humidifier_entity?`, `fan_entity?`, `fridge_entity?`, `default_device?: climate|humidifier|fan`; `show_power` and optional power entity per actuator. Require at least one reading or actuator. Selectors are domain/device-class aware; custom sensors with suitable units may be chosen through “Show other sensors” with a compatibility warning.

**Actions:** climate uses `set_temperature`, `set_hvac_mode` and supported fan/preset/swing actions. Enumerate `hvac_modes`, bounds and target step. HVAC mode and actual activity (`hvac_action`) are different labels. Range targets need two setpoints; do not collapse them to a single number. [S5] Humidifier uses `turn_on/off`, `set_humidity` and supported `set_mode`; target humidity differs from measured humidity. [S6] Fan uses `turn_on/off`, `set_percentage`, `set_preset_mode`, `oscillate` and `set_direction` only when exposed. Percentage steps come from the device. [S7]

**Acceptance:** changing device tab does not turn it on; changing HVAC mode does not rewrite a target without user input; unsupported temperature range and mode are never offered. An unavailable bedroom fan still shows valid room temperature/humidity as in guide p9. Do not add automatic humidity-based control to the frontend.

### 5.3 Appliance Run — `ikio-appliances-card`

**Use case:** water heater or monitored plug. State, instantaneous W and optional elapsed/timed operation matter more than a decorative history graph.

**Editor:** `entity` (required switch/input_boolean); `power_entity?` (power sensor); `energy_entity?` (energy sensor); `timed_runs?: [{label, start_script, timer_entity?}]`; `stop_script?`; `confirm_manual_on` default false; `show_history` default false. Timed-run row uses an existing script selector and optional timer selector. Labels are editable; do not infer duration from a script's name. A duration display can be explicit informational metadata, with helper text stating it must match the script.

**Actions:** domain-specific turn_on/off. A timed run calls the selected script. The complete timed shutoff must already be owned by that script/backend automation. The card does not create helpers, promise shutoff based on a browser timer, or attempt to reverse engineer script internals. Normal power control works without timed runs. Explain this optional dependency inline and link to HA's native script editor; do not ask the user to write YAML.

If a timer is bound, render its reported activity/finish time; browser countdown is display only. On reconnection re-read the timer. “Stop run” calls a configured stop script; if absent, label the manual action “Turn off” and do not imply it cancels a backend schedule. In timed mode make the intended action prominent and manual turn-on secondary. Unknown/offline power does not mean 0 W.

**Acceptance:** closing the browser does not affect a backend timed run; selecting its script in the editor never executes it; timer cancellation and switch off are not conflated. A switch can be on while consuming 0 W.

### 5.4 Media Session — `ikio-media-card`

**Use case:** Chromecast or Samsung TV. One player per card; no assumed synchronisation between the TV and a separate Chromecast entity.

**Editor:** `entity` (media_player); `show_artwork` default true; `show_volume` default true; `show_source` default true; optional `power_entity` (sensor, for W), `backlight_entity` (light/switch); optional ordered `shortcuts` (existing script/scene). The same type may be instantiated twice.

**Layout:** artwork or simple fallback, title/subtitle, supported transport, volume; source in details. Idle shows source/power without an empty timeline. For live media or unknown duration, omit progress. Only enable seeking when supported. Use media artwork returned through HA; don't guess third-party album-art URLs.

**Actions:** media_play/pause, previous/next, volume_set/mute, select_source and turn_on/off according to supported features. Use current source list. [S8] TV glow is an explicitly bound separate power button in details, never an implicit consequence of play/pause. Unsupported mute, power or previous/next are hidden rather than faked.

**Acceptance:** volume 0 remains valid; live streams don't have a fake end time; media position interpolation runs only while playing and visible and uses the entity's update timestamp. Pause interpolation on hidden pages.

### 5.5 Cleaning Mission — `ikio-vacuum-card`

**Use case:** Roborock Q8 Max, currently shown docked with Quiet selected.

**Editor:** `entity` (vacuum); `battery_entity?` override; `status_entity?` supplemental status; optional `maintenance: EntityRow[]` (sensor); optional `missions: ExistingAction[]` restricted to existing scripts. Primary battery can use the vacuum attribute if supplied; don't require a second entity unnecessarily.

**Layout/state:** docked → Start cleaning; cleaning → Pause and Return; paused → Resume and Return; returning → Returning with only supported actions; error → visible error and Details. Fan/suction presets use the actual vacuum's list, not the sample Quiet/Standard/Max labels. Put maintenance in details unless one configured threshold is breached.

**Actions:** `vacuum.start`, `pause`, `return_to_base`, `stop`, `set_fan_speed` only when available. [S9] This release does not invent a room map or Roborock segment IDs. Optional named room missions invoke selected existing scripts with known behaviour. Native area-cleaning support can be a later capability adapter after it is verified on this device.

**Acceptance:** returning is distinct from docked; absent battery is not 0%; unavailable removes action affordances. Never offer a Resume service name that the integration doesn't expose—map to the verified supported action.

### 5.6 Security Readiness — `ikio-alarmo-card`

**Use case:** Alarmo, contact exceptions, presence and current motion. Complements the floor plan without duplicating it.

**Editor:** `entity` (alarm_control_panel); `persons: EntityRow[]`; `contacts: EntityRow[]` (binary sensors for door/window/opening); `motion: EntityRow[]` (motion/occupancy); `modes` (subset of supported Home/Away/Night/etc); `confirm_arm` default true; optional `show_recent_activity` default false. No PIN/code field exists in saved configuration.

**Layout:** state first; open/unavailable contacts as exception rows, expandable all-contacts list; arm/disarm controls. Presence is informational. If contacts aren't configured, say “No contacts selected”, not “All secure”. Distinguish armed, arming, pending, triggered, disarmed and unavailable. A triggered state is prominent and labelled; do not use a decorative pulsing effect.

**Action flow:** choose mode → if configured, review exception summary → use the appropriate alarm action. If a code is required, hand off to the native alarm more-info flow in v1; no home-grown PIN persistence. Code-free actions may be direct after review. Respect server errors and Alarmo logic, including open-sensor rejection; explicit force-arm is supported only through the reviewed override flow below; never automatic bypass. [S10]

**Recent activity:** baseline can show current states and “changed X ago” from entity timestamps. Label that as current state, not a complete security log. Optional recorder history may produce an actual limited timeline with explicit loading/unavailable states. Do not infer complete events from a card that was not open.

**Acceptance:** mere presence never arms/disarms; refresh never repeats the last action; a PIN appears in neither logs nor config; an unknown contact prevents a claim that all monitored openings are closed.

### 5.7 Camera Window — `ikio-camera-card`

**Use case:** living-room camera, optional smart-plug power and existing snapshot automation. Camera may legitimately be off while home.

**Editor:** `entity` (camera); `power_switch?` (switch); `snapshot_automation?` (automation); `snapshot_script?` (script); `default_view` fixed to still/on-demand in v1; `show_timestamp` default true. No required stream URL, credential, filename or NAS path.

**Layout:** 16:9 media region, state caption, explicit Live action while available. A known bound power switch off allows “Camera power is off”; without that evidence show generic “Camera unavailable”. A stored image must carry its actual capture time if known; entity last_changed is not necessarily an image capture timestamp. If capture time is unavailable, label it unknown rather than claiming freshness.

**Actions:** native camera viewing/stream infrastructure on demand; stop on close/disconnect. Turn camera on/off only for the selected power switch. Snapshot automation has explicit enable/disable using automation.turn_on/off. “Capture snapshot” appears only for a bound existing script. Do not call camera.snapshot with a guessed server filename. Camera support varies by integration. [S11]

**Acceptance:** browsing or editing a dashboard does not power a camera or start a stream; live viewing is not restarted by unrelated sensor updates; a camera failure does not change the snapshot automation state. Never expose access tokens in logs or exported config.

### 5.8 Energy Ledger — `ikio-electricity-card`

**Use case:** total draw, office/TV/AC/dehumidifier/heater breakdown, day/night energy and tariffs, today's cost, estimated/accrued bill and forecast.

**Editor:** required `power_entity`; optional `today_energy_entity`; `tariffs: [{label, price_entity?, energy_entity?, cost_entity?}]`; `today_cost_entity?`; `accrued_bill_entity?`, `forecast_bill_entity?`; editable `billing_period_label`; `circuits: [{name, power_entity}]`; `show_untracked` default false; `history: {enabled:false, hours:6|12|24}`. Include a clear checkbox confirming listed circuits are non-overlapping before enabling the remainder. Currency is inferred from cost units, with a currency dropdown only if metadata is incomplete; warn on mixed currencies.

**Layout:** current W is the hero. Above the graph show billing-cycle dates, Day kWh, Night kWh and their Total, followed by estimated/accrued cost and forecast cost. Under the graph show sub-device power in a compact two-column grid, including zero readings and valid untracked power. Tariff prices are optional secondary details. These values are billing-cycle totals, not today's totals. Add explicit cycle-start/end fields and billing-cycle day/night energy selectors; never relabel daily sensors as cycle sensors. Total = day + night only when both valid, compatible and from the same cycle; otherwise show unavailable, not a partial sum. Prefer a verified total entity when provided.

**Calculations:** prefer existing HA sensors for costs, usage totals and forecasts. Today’s cost, accrued billing-cycle cost and full-cycle forecast are distinct quantities. Never derive a bill by multiplying today's energy by the current price. No browser-maintained energy accumulators or new financial model in v1. If there is no total-today sensor, display separate tariff usage rather than silently summing periods that might differ.

**Early-cycle forecast:** preserve the user’s requirement to avoid unreliable estimates immediately after a billing reset. Prefer an existing forecast sensor that already applies its minimum-hours rule. If a separate validity entity is available, expose `forecast_valid_entity` in the editor and show “Gathering enough data” when false. An optional UI-configured age gate may bind a cycle-start timestamp (or the verified utility-meter `last_reset` attribute) and `forecast_minimum_hours` (default 24, editable including 2). It only hides the displayed estimate until enough time has passed; it does not calculate or repair the bill. Missing/future cycle start shows “Forecast validity unknown”, not an estimate. Without validity metadata, label the number as a supplied forecast and do not claim its stability has been checked.

For untracked, convert compatible power units to a common unit, require valid total and all selected circuits, and compute total minus selected circuits. Do not include a parent circuit and its child simultaneously. If materially negative, show “Measurements do not reconcile” and the discrepancy; do not hide it with clamping. A small tolerance may default to 1 W and is explicitly documented. Asynchronous reading times can create a discrepancy even with correct wiring. Unknown measurements make the remainder unavailable.

**History:** request the selected power series only, using the target HA version's supported authenticated connection/history mechanism. Limit chart samples, preserve spikes and gaps, label range/unit and provide a textual current-value alternative. Never connect across unavailable gaps as though measured. No history service = live card still works. This is an optional visualization, not a prerequisite for switching appliances.

**Acceptance:** W versus kWh is never mixed; 0 is distinct from missing; thresholds/percentages cannot divide by zero; locale formatting preserves tariff precision (up to five decimals) while money totals normally show two. Billing periods are explicit, not assumed to be the calendar month.

### 5.9 System Pulse — `ikio-server-monitor-card`

**Use case:** HA host uptime, CPU, RAM, disk, database, temperature and network. Reusable for another host by changing entities.

**Editor:** all explicit optional metric bindings, requiring at least one: `availability_entity`, `uptime_entity`, `cpu_entity`, `temperature_entity`, `ram_used_entity`, `ram_total_entity`, `ram_percent_entity`, `disk_used_entity`, `disk_total_entity`, `disk_percent_entity`, `database_entity`, `network_rx_entity`, `network_tx_entity`. Availability entity includes an `online_state` choice to avoid assuming whether on/off means healthy. Uptime includes interpretation selector: duration with unit, or timestamp for boot time. Percent readings take precedence for bars; used/total supplies readable capacity. Missing metrics collapse cleanly.

Optional `thresholds` use per-metric warning/critical numeric fields with units and direction. Optional `services: [{name,status_entity?,control_entity?,restart_action?}]` bind HA entities explicitly. Restart actions are selected existing scripts/buttons and always confirmed. Switch power and actual application health are displayed separately. No direct Docker/NAS API calls.

**Behaviour:** don't invent a composite health score. If a user supplies a score sensor later, display its exact value and label without implying the card computed it. Validate compatible storage units before deriving percentages. Network rate entities show rates; cumulative-byte sensors show totals with an appropriate label, or are rejected from rate fields. No differencing of sparse counters in the browser. An availability-only Online label must not imply all services are healthy.

**Acceptance:** don't compare bytes and gigabytes without conversion; values over 100% produce an explanatory warning, not a deceptive full bar; uptime updates at most once per minute while visible. Show RAM/disk used/total independently if percentage cannot be computed.

### 5.10 Drive Brief — `ikio-vehicle-card`

**Use case:** Vehicle fuel, estimated range, odometer and parked location. This is a read-only status card with navigation to details.

**Editor:** `fuel_entity?`, `range_entity?`, `odometer_entity?`, `tracker_entity?`, `location_entity?`, `location_timestamp_entity?`, `name`; require at least one. Fuel percent is a 0–100 bar only for a percentage sensor. A volume sensor displays volume and needs a configured capacity before any percentage is calculated; that capacity is optional numeric input with unit. Tracker and textual location may be separate.

**Layout:** range hero, fuel bar, odometer, parking label and last-known location age. “Home” is based on the selected entity, not hardcoded coordinates. Open location opens Google Maps using the selected tracker’s valid latitude and longitude, through a standard Maps URL. Never guess coordinates. Native more-info remains the hold action. Without a tracker, the button opens the available location entity's details; without either, omit it. Do not ship a third-party map or location service in v1.

**Acceptance:** no car lock/remote-start action is assumed; last location update and last fuel update remain distinct. A stale location is marked last known, not current. Never interpret a tracker name as an address.

## 6. Entity bindings

All entity IDs must be selected in the visual editor. The public collection contains no household entity map or device bindings. Preview and test IDs are simulated examples only. Confirm each entity’s units, capabilities and billing period before using it.

## 7. Suggested placement

- **Overview:** add compact room lighting, bedroom comfort/fan, media and cleaning around/below it according to available screen space. Drive Brief can sit below them. Do not squeeze all eleven cards into the first screen.
- **Energy:** full-width Energy Ledger, then Appliance Run for water heater and any useful monitored plug. Circuit details expand only when needed.
- **Security:** Security Readiness, Camera Window, then the existing spatial security view if still useful. Avoid showing duplicate contact timelines by default.
- **Server:** System Pulse, with optional service rows or a second instance for another machine.

These placements are suggestions, not a requirement to replace existing dashboard content. Card design does not depend on a particular dashboard layout.

## 8. Repository and runtime architecture

Read the root and applicable `AGENTS.md`, preserve unrelated work, and follow the pinned Node version, root lockfile and synchronized collection version.

Each card has its own package, custom-element name and bundle filename under `cards/ikio-*-card/`. Shared source packages provide tokens, accessible controls, value formatting, action state and editor fields. There is no 3D rendering dependency.

Suggested per-card structure: `src/card.ts`, `src/editor.ts`, `src/config.ts`, `src/adapter.ts`, `src/styles.ts`, behaviour tests, README and build script. Shared helpers stay domain-neutral; climate/vacuum/alarm capabilities belong in their adapters. Use the repository's established build tooling where practical. A modest Lit dependency is acceptable if pinned locally; avoid runtime CDN imports or borrowing a private Lit class from another custom card.

Each card bundle should register only its own card and lazy-load its editor where the supported build allows. An optional distribution loader may import all eleven local bundle files for one resource registration; it must ship those files and preserve standalone bundles. Document either route clearly and avoid duplicate registration if both are loaded. Do not promise HACS installation before the repository's publishing support exists.

Use `ha-card` for the shell, scoped CSS custom properties for Ikio appearance, and HA more-info for native entity details. `getCardSize()` supplies Masonry size; `getGridOptions()` supplies Sections sizing. Start with full section width and automatic height, then allow compact widths only where controls remain usable. Do not copy an unrelated/older layout method from existing code without checking the target frontend. HA updates `hass` frequently; update only affected UI. [S2]

For updates, compare configured entity objects and relevant attributes; avoid serialising every state in the house. Recompute subscriptions only when bindings change. Current states come from HA, not custom REST polling. Optional history is cached by entity/time range, deduplicated across instances where practical and cancelled/ignored when obsolete. The documented authenticated WebSocket API is a starting point; confirm the actual history command against the supported frontend rather than guessing an endpoint. [S12]

Use a visibility observer and document visibility to suspend position/countdown animation and history refresh. Still reconcile actual entity state immediately when visible again. Limit history to approximately 240 display samples per series while preserving peaks/gaps. No recurring render loop for static cards. Lazy-load camera and chart functionality only when used. Resolve and revoke any created media resources on disconnect. Include dependency/license notices in releases.

## 9. Validation and definition of done

### Automated behaviour checks

Cover the user-observable boundaries: entity missing/unknown/unavailable, config remapping, editor round-trip, immutable config handling, capability gating, correct action payloads, pending/confirmation/error states, switch-only lights, HVAC range targets, zero volume, unsupported vacuum modes, partial contact availability, camera disconnect cleanup, power-unit conversion and invalid remainder, stale tracker information, and timer display after reconnect.

Do not write tests that merely restate CSS constants. Mocked DOM tests are not live Home Assistant validation. Add a fixture harness for deterministic screenshots, with conspicuous fixture status and disabled backend actions. It must never ship fake readings as a live fallback.

### Visual and interaction checks

Check all eleven cards at 280, 360, 390 and 520 px container widths and in an actual Sections and Masonry dashboard. Inspect dark, light and HA-theme modes; long translated names; decimal comma locale; 200% zoom; keyboard-only operation; screen-reader names; mobile tap/drag and reduced motion. Ensure focus is not lost on normal HA updates. Verify nested controls do not trigger the card's more-info action.

In a real HA browser, add every card through the picker, configure it entirely with the visual editor, save, reload and reopen. Verify no “visual editor not supported” escape hatch is required. Check actual service outcomes for each configured domain. Device-affecting tests must use explicit authorized fixtures/devices; avoid arming security, power-cycling a camera or starting a heater as incidental smoke tests. A design review is not authorization to operate live devices.

### Repository checks

Run the pinned-runtime workspace tests, formatting check and build from the repository root. Run broader checks when shared packages or release configuration change. Verify produced module URLs and lazy editor imports from a local HA resource path with no CDN access. Report browser/live-device checks separately from build and mocked tests.

### Delivery gates

1. Shared tokens and one complete Light Studio + visual editor vertical slice.
2. Comfort, Appliance, Media and Cleaning, each with capability tests and editor coverage.
3. Security, Camera, Energy, System and Drive, each with useful missing-data states.
4. Optional history and backend-script bindings; finish responsive/theme/accessibility checks.
5. README with UI-only setup, supported HA version, exact per-card bundles, optional dependencies and known limitations. Preserve SemVer/release metadata rules. Commit/PR only when the implementation task authorizes it.

The family is done when all core actions exposed by the chosen entities work, every required configuration has a graphical control, all eleven designs behave responsively, and unverified capabilities are disclosed rather than simulated.

## 10. Official reference links

Reviewed 24 October 2026. These establish HA integration contracts; the layouts and product choices above are original design proposals. Recheck compatibility against the exact deployed frontend when implementing.

- **S1** [Card editor and picker](https://contributors.home-assistant.io/frontend/custom-ui/card-editor/)
- **S2** [Custom cards, lifecycle, sizing and helpers](https://contributors.home-assistant.io/frontend/custom-ui/card/)
- **S3** [Selectors](https://www.home-assistant.io/docs/blueprint/selectors/)
- **S4** [Light integration](https://www.home-assistant.io/integrations/light/)
- **S5** [Climate integration](https://www.home-assistant.io/integrations/climate/)
- **S6** [Humidifier integration](https://www.home-assistant.io/integrations/humidifier/)
- **S7** [Fan integration](https://www.home-assistant.io/integrations/fan/)
- **S8** [Media player integration](https://www.home-assistant.io/integrations/media_player/)
- **S9** [Vacuum integration](https://www.home-assistant.io/integrations/vacuum/)
- **S10** [Alarm control panel integration](https://www.home-assistant.io/integrations/alarm_control_panel/)
- **S11** [Camera integration](https://www.home-assistant.io/integrations/camera/)
- **S12** [Authenticated WebSocket API](https://contributors.home-assistant.io/core/internals/websocket-api/)

No live Home Assistant instance, physical device or editor implementation was tested during this design-only task.


## 11. Consolidated V3 mobile contract (authoritative)

This section replaces all older spacious layouts and any conflicting interaction examples. The family now contains eleven cards, including the standalone graph. Retain functional capability checks and visual configuration for every card. Default mobile padding is 12 px; body 13–14 px, secondary at least 12 px, main readings 22–30 px. Keep 44 px interactive hit targets. Do not hide readings merely to reduce height. Containers grow when translated labels wrap. No fixed-height clipping. Old SVG mockups are superseded by the compact-* assets.

### Lighting
Every light is an independent button. Tap toggles, drag its embedded bottom track adjusts brightness, and hold always opens native HA entity details. No shared brightness/warmth section and no select-first workflow. The line can reflect current warmth/colour; those settings are adjusted in native details. Power-only entities have no track. Keep the bottom drag target distinct from the upper tap/hold area; cancel tap and hold on drag initiation, allow vertical page scrolling, and commit brightness on release. Provide keyboard-accessible brightness input and an accessible Details action equivalent to hold. Unknown/offline controls cannot operate the entity. No user-defined hold remapping.

### Media and vacuum
Media uses familiar MDI icons for previous, play/pause, next, volume/mute and supported power. Labels remain accessible; tooltips are supplementary. Vacuum is two rows: name/state/battery, then primary action icon, relevant dock icon and selected suction value such as Quiet with dropdown indicator. Remove Ready to clean and the redundant Suction label/row. Primary action: docked/idle → start; cleaning → pause; paused → resume using the device's verified action; returning → state indicator; error/unavailable → disabled with readable status. Do not assume every device supports pause or docking. Holding entity controls opens native details.

### Alarmo override
Offer Arm anyway when open sensors prevent arming. Review the affected sensor names and selected arm mode before confirmation. Dispatch alarmo.arm with entity_id, mode and force=true; preserve normal exit delay and required arming code. Required codes are transient, masked, never logged or stored; use a dedicated accessible code prompt when the native details flow cannot submit force=true. Do not claim native alarm more-info implements this custom override. Cancel clears transient data. Only expose this action when Alarmo support is verified. On success read bypassed_sensors from Alarmo and show an amber count with tappable names. Clear the local force option after every attempt. Backend bypass status is authoritative. Ordinary arming remains force=false. Reference: https://github.com/nielsfaber/alarmo#services .

### Car summaries and maps
Add three separate indicators in one row: locks Locked/Unlocked, doors Closed/Open, windows Closed/Open. Visual editor fields accept an aggregate entity or an explicit entity list for each category. Define domain-aware active states (lock locked/unlocked; binary opening off/on), with a UI state mapping for nonstandard aggregate sensors. Any known unlocked/open member wins; otherwise any absent/unknown/unavailable member yields Unknown; only all known secure members yield Locked/Closed. Empty configuration is Not configured, not secure. Do not display per-door or per-window detail in the card. Neutral secure states, amber exceptions. Use Google Maps URL https://www.google.com/maps/search/?api=1&query=LAT,LON with validated, encoded numerical coordinates from the tracker. Keep location update age visible. No coordinates means disabled location action; no invented home position. Hold still opens native entity details.

### Standalone graph — ikio-graph-card
New independent workspace/card/editor. Title and current value, compact historical line, optional multi-entity legend with current readings. Required entity list; graphical optional name, time range, legend toggle. Share the graph renderer and history lifecycle with Energy Ledger. Each displayed series has only Expected minimum and Expected maximum for colour configuration, in its display unit. No palette selector, colour picker, threshold rows, logarithmic option or user-written configuration. Multiple entities must use compatible units on a shared axis; reject incompatible combinations with an editor explanation. Use markers/dash patterns and labels to distinguish series because colour communicates value, not identity. Holding an entity legend/value opens its native details; a multi-entity plot has no guessed default entity. Axis and expected colour range are separate.

### Exact shared colour algorithm
Use the user's fixed palette as normalized stops. For each numeric value v in a consistent display unit and expected range [min,max], calculate u = clamp((v-min)/(max-min),0,1). Require finite min < max, with inline editor validation. Stops are (position, hex):

| Position | Colour |
|---|---|
| 0 / 3500 | #6ff7b3 |
| 100 / 3500 | #64f564 |
| 200 / 3500 | #00ff00 |
| 380 / 3500 | #ffff00 |
| 500 / 3500 | #ffc800 |
| 700 / 3500 | #ff8000 |
| 950 / 3500 | #ff5100 |
| 1500 / 3500 | #ff4000 |
| 2200 / 3500 | #ff0000 |
| 3500 / 3500 | #d400ff |

Find adjacent stops enclosing u, compute t=(u-stopLow)/(stopHigh-stopLow), and interpolate each encoded sRGB channel linearly, rounding to the nearest integer. This deliberately reproduces the supplied palette; it is not logarithmic, percentile based or automatically normalized to visible history. Split line segments at crossed colour stops (and at min/max crossings) so long intervals traverse the full palette smoothly, not merely endpoint colours. A vertical SVG gradient aligned to the current numeric y-axis mapping is an equivalent implementation if stop coordinates are correctly transformed and clamped. Gradient orientation follows value, not time. If fill is shown, use the same colour with low opacity. Do not bridge missing-data gaps. Outliers stay visible with endpoint colour. Changing history range must not change the colour assigned to the same value. Include tests for every exact stop, midpoint interpolation, min/max/outliers, negative configured minimum, invalid ranges, gaps, unit conversion and long segments crossing multiple stops.

Energy Ledger uses the same Expected minimum/maximum fields and renderer. Current total power comes first, billing-cycle Day/Night/Total and costs above the graph, circuit power below it. Default home-power range 0–3500 W matches the supplied palette, but is editable. Other sensors need sensible validated ranges, never watts hardcoded into their UI.


## 12. Final architecture and energy interaction decisions

Collection name: Ikio. All cards and internal packages share one version, one changelog and ikio-vX.Y.Z releases. Each card owns a cards/ikio-*-card workspace; packages/ikio-card-ui and packages/ikio-graph hold reused code. One root lockfile. One installation package may contain individual standalone bundles; shared modules require no separate HA installation.

Energy device readings are equally styled, self-contained items in a stable two-column grid, names above values. Narrow containers/large text fall back to one column. Untracked occupies its own full-width row after a divider. Tap or hold a device item opens the bound power sensor native details. Existing untracked sensor opens native details; computed untracked opens an explanation of total minus tracked circuits, without inventing an entity. Native hold actions require an entity; computed-only elements are explicitly labelled calculations.

Implementation starts with shared foundations and a complete Light Studio vertical slice, then graph/energy, media/vacuum/comfort/appliance, security/camera/drive/system. No placeholder cards should appear as implemented in the picker. Validate capability, interaction, editor round-trips, cleanup and formatting/build. Report live HA/device verification separately.


## 13. Installed-dashboard refinement (0.2.0, overrides previous light layout)

Remove all light brightness tracks and percentage labels. Use the HA entity area, then device area, as the secondary device location. An optional location text override is available in the visual editor; missing area reads No area assigned. Tap toggles, hold opens native details for brightness/colour. Preserve existing card configuration.

Home Energy removes the graph footer row. Show the actual displayed-window minimum and maximum on its vertical axis; constant data gets a single accurate label. Axis scaling and observed extrema are independent of configured colour min/max. The title and current draw share a compact header; totals use tight rows with 44 px tap targets. Keep device readings and Untracked interaction unchanged. Standalone Graph retains its existing footer.


## 14. Collection-wide compact default (0.2.1)

Use 10 px card padding, 4 px section gaps, 6 px control gaps, 24 px main readings and at least 12 px supporting text. Retain 44 px buttons/sliders/readings that operate an entity. Inline range captions share their slider row. Combine media volume/mute, playback time/seek, timed appliance actions and camera icon controls. Keep all configured information visible; do not use hidden details to achieve compactness. The energy device grid retains identical styles and a separate Untracked row. Compact graphs are 84 px high; live camera aspect ratio remains native. Car parking/update age and an unboxed Open location in maps text link share a footer row. Native details on hold and existing action semantics remain unchanged.


## 15. Public Ikio repository (0.3.0)

The collection is named Ikio and lives in `kpolyd/ha-ikio-cards`. All eleven cards, shared packages, tests, theme, previews and design documents are included. The 3D card, household bindings and legacy release automation are excluded. Public element names, package scopes, bundle names and resources use `ikio`. See INSTALLATION.md for the one-time migration from Aethora. The 0.2.x changelog records earlier collection work; 0.3.0 is the first Ikio namespace version.


## 16. HACS distribution (0.3.1)

HACS custom Dashboard repository support is now part of the collection. The root hacs.json selects `ha-ikio-cards.js` from a published release. A build without code splitting combines all eleven cards and their editors into that single self-contained asset; individual lazy builds remain available for manual installation. One shared version controls HACS updates. CI validates before publishing a draft with all assets, then publishes only after every upload succeeds. Published releases/tags are not changed. No submission to the default HACS catalogue or license selection is implied.


## 17. HACS raw-file compatibility (0.3.2, overrides release-asset packaging)

Track the generated collection bundle at root `ha-ikio-cards.js` and set `content_in_root: true`. Publish versioned releases without any attached assets; HACS 2.0.5 otherwise selects release downloads before raw files. CI rebuilds and compares the tracked bundle and notices before publishing, protecting against stale generated code. Keep full ZIPs in CI artifacts. The resulting HACS resource and card configuration do not change. This avoids oversized GitHub release-redirect headers without modifying HACS.


## 18. Optional Lights location grouping (unreleased)

Provide a Group by location toggle, off by default. Use the existing location override or HA entity/device area; missing locations form Unassigned. Maintain first-occurrence group order and configured light order within groups. Pack consecutive areas into three-column rows when their combined light count is at most three (2+1 or 1+1+1). Larger areas use a full-width section and wrap internally. Do not reorder areas to fill gaps. Separate shared-row areas with subtle vertical dividers and rows with horizontal dividers. Show an on/total count for groups larger than one; omit the redundant singleton count. Hide repeated area labels on grouped buttons, but retain unavailable status. Use 44 px minimum buttons, readable 12 px labels and tight gaps. At very narrow widths, stack groups and use two columns. Hold always opens native details; changing entity states must not recreate buttons or lose focus. No release/version change is authorized yet.


## 19. Energy summary redesign (unreleased, overrides earlier Energy layout)

Current power is the dominant left column. Stack Day/Night/Total in a compact middle column headed Energy · kWh; normalize compatible energy units. Stack estimated/accrued bill and forecast in a quieter right column. Remove unconfigured columns. Keep cycle dates in the header and all forecast/period safeguards. Tariff rows are compact information entries; power/device readings retain touch-sized entity details targets.

Display all power readings as whole watts, converting compatible source units before rounding. Never round inputs before computing Untracked or plotting history. Keep currency/energy precision. The energy graph uses faint dashed min/mid/max guides aligned with left labels from the observed history scale, with power labels in whole watts. Constant series have one guide; a midpoint with a duplicate rounded label is omitted. Colour thresholds remain independent of axis range. Standalone Graph does not change by default.

Untracked is an ordinary device-grid reading with matching typography, not a separate action button or separator row. A configured sensor retains its native sensor-details interaction. Computed Untracked is read-only, has no fake entity, and retains warnings for missing/incompatible/overlapping inputs. No release/version bump is authorized yet.


## 20. Compact Drive card (unreleased)

Use two three-column rows: range/fuel/odometer, then aggregate locks/doors/windows. Add native HA icons beside metric labels and state-dependent icons beside status text. Use muted mint for known secure states, amber for open/unlocked, soft red for jammed, grey for unknown/unavailable/unconfigured, and blue for locking/unlocking. Do not infer secure from unavailable data or introduce car commands. Preserve aggregate mappings and explicit unit handling.

Move parking to the header and keep location age plus the plain Open location in maps link in one wrapping footer. Retain 44 px entity targets, readable labels and full values on narrow widths. Remove the separate fuel bar; a configured compatible fuel capacity can still convert the Fuel metric into percentage. Metric/status taps and holds open native HA details; aggregates select the member explaining an alert. Main/version/release are unchanged until the owner asks to publish.

## 21. Device power sparklines (0.5.0)

Place an 18 px sparkline beside each device's whole-watt value, beneath the unchanged name. Preserve row height, grid layout and native sensor details. Use the main graph's time window and batched history request. Each sparkline derives its vertical and colour range from its visible minimum/maximum, with no configuration; this overrides fixed colour thresholds for device sparklines only. Reuse the main palette's green/yellow/orange/red stops, ending at red for the observed maximum. Constant consumption is flat and green, including zero at the bottom. Omit axes, captions and guides. Missing history leaves the reserved space empty; missing states break the line.

Include configured Untracked sensor history, or compute Untracked history from time-aligned total minus non-overlapping device readings with unit conversion and missing-data gaps. Computed Untracked stays read-only and existing warnings remain. No release/version bump or publication is authorized.

## 22. Alarmo-style Security card (0.5.0)

Use a 58 px circular status emblem with a 38 px icon, title and alarm status. A single segmented selector shows Disarmed then supported/configured Away, Home and other modes. Prominent green identifies armed states and the active mode; amber marks delays and sensor warnings; triggered uses the error colour. Retain native entity details on hold.

Place the sensor area above the mode selector. Use compact wrapping sensor labels and HA state icons, including icon overrides. Show open/active/unavailable sensors and confirmed Alarmo bypassed sensors. Unknown data must never imply all sensors are clear. Remove user location/presence from the card and editor, while accepting legacy configuration.

The Alarmo bypass checkbox defaults off and is offered only while disarmed with open sensors, overrides enabled and the Alarmo service available. Position it above the sensor warning. Apply selection to the next explicitly reviewed arming attempt; clear it on submission, state/configuration changes, hiding and disconnect. Preserve required codes, normal exit delays and force-arm semantics. After arming, display confirmed bypass status from the backend instead of the checkbox.

Show a masked PIN field and numeric keypad inside the card whenever armed, including with bypassed sensors, and during triggered/entry/exit delay states. No initial tap is required. Codes may also be typed, including text codes. Selecting Disarmed focuses this field; submitting Disarm sends the code and awaits backend state confirmation. Code-free panels permit an empty code. Hide the keypad after confirmed disarming. Required arming codes and arming confirmation also use inline controls, without action popups. Clear codes after submission, alarm state/config changes, hiding and disconnect. Keep errors inline, preserve preview/pending/unavailable guards, and never save codes in configuration. No release/version bump is requested.

## 23. Drive image, identifiers and matching security colours (0.5.0)

Match Security's brighter green for Locked/Closed, including light/HA appearance handling. Keep amber Open/Unlocked, error-colour Jammed, blue transitional states and muted unknown/unavailable. Retain the existing state aggregation, native details interactions and read-only vehicle behaviour. Use the approved layout: title with parking beneath on the left, optional license plate and VIN in two compact rows in the centre, and an optional contained car image on the right. Keep the metric/status rows compact with subtle column dividers and a separated location footer.

Expose optional `license_plate` text and `vin_entity` sensor through the visual editor. Preserve the VIN’s exact identifier text and leading zeroes, with no numeric formatting. VIN tap/hold opens sensor details. Omit unconfigured rows and allow long text to wrap.

Expose optional `image` through HA's native media selector with image upload, plus `image_url` for local/HTTP(S) images. The selected upload takes precedence. Resolve media-source URLs through HA; deduplicate loading, ignore stale results after reconfiguration/disconnect, refresh resolved URLs while visible and stop timers when hidden/disconnected. Show inline image failures without losing readings. Preserve transparent cutouts with object-fit contain. Do not embed household images or identifiers in the collection. No version bump or release is requested.


## 24. Release 0.5.0

The owner authorized merging and releasing sections 21–23, superseding their earlier publication restrictions. Release this synchronized collection as `ikio-v0.5.0`, preserving asset-free HACS delivery and the documented live-verification limits.

## 25. Drive image entities and approved plate/icon refinement (0.5.1)

Expose `image_entity` in the visual editor for an image, sensor, tracker or camera entity. Prefer its `entity_picture` attribute, otherwise its URL state. An explicitly selected entity takes precedence over upload/static URL configuration. Follow source/token changes, clear obsolete image errors and show unavailable state without substituting another car image. Do not start camera streams.

Use the final approved smaller plate mockup: transparent interior, thin neutral outline and country divider, with no coloured band, stars, bevel or shadow. Centre both the plate and its VIN row on the same horizontal axis. Expose optional `plate_country` text (default GR; empty omits the country section). Preserve the registration and VIN text, wrapped when needed, and native VIN details interactions.

Move metric/status icons to the left of their label/value pair. Use 32 px icons with 11 px supporting labels and prominent values, reducing icons to 24 px on narrow cards. Keep the three-column groups, full values, state colours and 44 px details targets. Implementation is authorized; publication of this follow-up has not been requested.


## 26. Release 0.5.1

The owner authorized publishing the section 25 car-card follow-up. Release the synchronized collection as `ikio-v0.5.1`, retaining asset-free HACS delivery and live-verification limits.


## 27. Consistent Energy sparkline colours (0.5.2)

Device and Untracked sparklines use the main graph's configured expected minimum/maximum colour thresholds and the identical full palette. The same wattage must therefore map to the same colour in every graph. This supersedes section 21's per-device colour normalization. Vertical scaling still uses each device's observed visible min/max, including constant-series handling, independently of colours. Use a 1 px non-scaling stroke for sparklines while preserving the main graph's 2 px stroke, row height, history batching, missing-data gaps and unit conversion. The owner authorized implementation and release as `ikio-v0.5.2`.

## 28. Smaller Drive details (0.5.3)

Reduce metric/status icons to 28 px, or 22 px on narrow cards. Remove the visible VIN label while retaining its accessible label and native details interaction. Reduce VIN font from 12 to 11 px. Reduce plate font from 16 to 15 px, or from 14 to 13 px on narrow cards, and tighten the plate/country padding to shrink the outlined visual. Preserve shared centre alignment. Keep the existing visual-editor `plate_country` setting: GR by default, custom text supported, empty omits the country section. Implementation is authorized; no follow-up release is requested yet.

## 29. Finer device sparklines (0.5.3)

Reduce only the device and Untracked sparkline stroke from 1 px to 0.8 px, retaining non-scaling strokes, shared colour thresholds and automatic vertical scaling. Keep the main graph line at 2 px. This supersedes section 27's sparkline width. No release is requested yet.


## 30. Release 0.5.3

The owner authorized publishing sections 28–29 together as `ikio-v0.5.3`, superseding their earlier publication restrictions. Retain asset-free HACS delivery and documented live-verification limits.

## 31. Automatic Alarmo sensors, direct arming and smaller Drive icons (0.5.4)

Discover enabled sensors from read-only `alarmo/entities` and `alarmo/sensors` requests, scoped to the selected Alarmo area or the master's known areas. Do not require card sensor configuration. Retain optional manual rows as extras/fallback. Update from HA states, subscribe to Alarmo configuration changes, periodically refresh and clean up subscriptions/timers/late requests on configuration, hiding, disconnect or connection changes. Prefer full friendly/device names rather than abbreviated generic entity labels; retain native HA state icons. No sensors or failed discovery must not look like a green all-clear.

Home/Away arms with one tap when no code is required. The unchecked-by-default bypass checkbox supplies explicit bypass consent, followed by one mode tap; remove the separate arming review and ignore legacy `confirm_arm` values. Remove that editor field. Required codes still use the inline PIN pad and an Arm action; preserve exit delay and backend authority. Listen for this panel's `alarmo_failed_to_arm` event to clear pending timers and display the real rejection reason immediately. Detect fresh blocking-sensor attributes as an event fallback. Never mark a command successful on a failure or send device actions while testing.

Reduce Drive metric/status icons to 24 px, or 20 px on narrow cards, retaining labels, values and touch targets. These fixes are authorized; no release is requested yet.


## 32. Energy billing alignment and per-value units (0.5.4)

Right-align estimated bill and forecast labels and amounts within their existing column. Show Energy as the column heading; show Day/Night/Total with exactly one decimal and a smaller muted kWh suffix per numeric value. Convert source units and calculate totals before rounding; preserve currency precision, missing/incompatible-data messages and billing-cycle safeguards. The owner authorized implementing and releasing these changes together with section 31 as `ikio-v0.5.4`, superseding its earlier publication restriction. Retain asset-free HACS releases and documented live-verification limits.

## 33. Sparse device history (0.5.4)

For device and Untracked sparklines, hold each recorded sample until the next timestamp and step to the new recorded value. Do not draw diagonal interpolation across unchanged periods with sparse recordings. Keep gaps for missing/unavailable samples and do not invent an initial zero. Preserve shared value colours, 0.8 px strokes and existing main/standalone graph paths. Include this rendering correction in the authorized 0.5.4 release.

## 34. Security discovery lifecycle and smaller shield (unreleased)

Reduce the status shield from 38 to 32 px within the unchanged 58 px circle. Retain automatic Alarmo discovery: its read-only entities/sensors endpoints identify enabled sensors belonging to the selected panel; live sensor values come from HA states. Do not substitute all household binary sensors or require manual configuration.

Keep the discovered list and its status in card memory across visibility changes and temporary disconnects. Restore subscriptions and refresh timers on return, immediately render current HA states, and restart interrupted initial discovery without waiting for another HA state update. Refresh stale discovery in the background; discard cached membership on panel/configuration or connection changes. Bound discovery requests to five seconds, report unavailable status instead of indefinite loading, retry through periodic refresh, ignore late replies and clean up cancelled request timers. Unknown/discovery failure must never imply a green all-clear. Live countdown/ring and coral delay colours remain proposals, outside this change. No commit or release has been requested.


## 35. Live Security countdown and release 0.5.5

Implement the approved countdown mock with the smaller 32 px shield: show remaining seconds beside the status and a shrinking ring around the shield within the existing header dimensions. Use coral #f08072 for arming/entry-delay icon, status, seconds and ring, with a darker coral #b7473b on the light appearance. Keep sensor warnings amber, confirmed armed states green and triggered states in the error colour. Respect reduced-motion preferences; avoid announcing each second through a live region. Remove the redundant configured-delay note.

Use the selected panel's read-only alarmo/countdown response (delay and remaining), tick locally against a deadline once per second, and resynchronize every 15 seconds while visible and on return or a new delay state. Do not restart a full configured delay on card opening. Bound requests to five seconds, ignore stale responses, clear requests/timers on hiding, configuration, disconnect or delay-state changes, and retain the PIN pad and native alarm controls. Missing/invalid timing data shows the actual state without fabricated seconds or a progress arc. A zero timer does not imply armed: only backend state confirmation changes the card to green. Validate with simulated HA state and websocket responses; no real alarm operations are authorized for testing.

The owner authorized implementing and releasing this section with section 34 as ikio-v0.5.5, superseding its proposal/publication restrictions. Preserve synchronized versions and asset-free HACS release delivery.

## 36. Collapsible Security sensor details (unreleased)

Collapse individual alert sensor names/icons by default behind the live sensor status/count summary. Make the summary a keyboard-accessible toggle with a chevron, aria-expanded and aria-controls when sensor details exist. Keep the bypass checkbox above the summary and the inline PIN pad independently visible. Include open, active, unavailable and bypassed sensor details in the same disclosure; preserve HA icons and native details interactions when expanded. Keep expansion through live state/countdown updates; reset on reconfiguration or when every alert clears. An all-clear/loading/no-data summary has no empty disclosure. Implementation is authorized; no new release or commit has been requested.


## 37. Release 0.5.6

The owner authorized committing, merging and releasing section 36 as ikio-v0.5.6, superseding its publication restriction. Retain synchronized versions, asset-free HACS delivery and live-verification limits.


## 38. Softer Drive green and smaller readings (unreleased)

Reduce Drive metric/status icons from 24 to 22 px, or 20 to 18 px at narrow widths, and resize their grid columns to match. Reduce range/fuel/odometer values from 19 to 18 px, or 16 to 15 px at narrow widths; units from 12 to 11 px; status values from 14 to 13 px. Keep readable supporting labels at 11 px and retain 44 px native-details targets. Header, plate and VIN sizing remain unchanged.

Use Ikio’s existing temperature/accent mint #a4e4b8 for secure locked/closed text and icons, replacing #6ef0a6 in Drive only. Use matching palette green #28613e in light mode and continue honoring the HA success colour in HA appearance. Preserve warning/error/pending/unknown colours and status aggregation. Security colours do not change. The owner authorized committing these changes on the feature branch; do not merge or release yet.

## 39. Design approach and review of remaining cards

The owner identified Light, Energy, Drive/Car and Security as approved reference designs to preserve, including the committed unreleased Drive refinement. Record the established preferences in DESIGN_APPROACH.md, use UI UX Pro Max as an advisory review reference and add this guidance to AGENTS.md for future work. DESIGN_REVIEW.md records source-informed findings and proposed directions for Comfort, Media, Cleaning, Appliance, System, Camera and Graph. These proposals do not authorize changing the four reference cards or automatically applying generic skill defaults. Review and document first; no remaining-card runtime redesign, version bump, merge or release is included in this work.

## 40. Remaining-card redesign implementation and mocks (unreleased)

The owner authorized implementing the findings and redesigned layouts for Comfort, Media, Cleaning, Appliance, System, Camera and Graph, with a mock for each. This supersedes section 39's proposal-only implementation scope. Preserve the four approved reference cards and committed Drive refinements; no merge or release requested.

Use opt-in `.ikio-refined` presentation so the approved cards receive no new styles. Add visible select labels, compact icon/name/status headers, primary-action emphasis and persistent native disclosures. Comfort distinguishes room/humidity/fridge and separates advanced settings; Media ranks title/artist and transport, keeping source/volume accessible and extra controls disclosed; Cleaning gives its state-dependent primary action a visible label and keeps maintenance/missions disclosed. Appliance keeps direct timed-run scripts and replaces configured manual-on modal consent with inline review. System groups utilization values/bars/capacities, puts secondary host readings after resources, discloses services and uses inline restart review. Camera keeps explicit on-demand streaming, groups its open action/automation and bounds helper loading to eight seconds with late-response cleanup. Graph adds line-pattern samples to a compact legend without changing shared plot mathematics or Energy rendering.

Keep existing capability gates, units, timer/script semantics, manual-off schedule warning, missing-data states and native entity interactions. No real device operations are used for testing. `dev/previews/redesign.html` and `redesign.js` supply simulated fixtures; `node scripts/build-redesign-preview.mjs [output.html]` builds a self-contained seven-card preview. Preview icon stand-ins use attributed MDI SVGs; no preview fixture or third-party icon assets enter the runtime bundle. The generated gallery is a mock, not a claim of live HA compatibility.

## 41. Compactness correction after mock review (unreleased)

The owner rejected the first seven-card mock set as too spacious and restated that compactness must preserve readability and functionality. Revise the opt-in layouts using 16 px headers/18 px header icons, 6 px section gaps and inline visible field labels. Keep 11–12 px supporting labels, ordinary value sizes, wrapping, semantic colours, all existing capabilities and 44 px touch targets. Never force shorter cards with clipped content or fixed heights.

Group Comfort's primary mode/target controls in a wrapping task row, use short unambiguous measurement labels and show activity in the header instead of a duplicate line. Group Media's volume/source and power/extras into wrapping rows; Cleaning's main action/suction into one wrapping group; Appliance's power/energy/timer readings and distinct run/manual control groups into shared rows. Put System utilization in a compact three-column strip with supporting reading pairs. Remove Camera's large decorative placeholder and pair capture/automation information. Label a single Graph hero with its series name rather than repeating the same reading in a legend. Reflow groups at narrow widths; preserve direct controls and collapsed secondary settings. Keep the four approved reference cards unchanged. Update the seven-card mock gallery; no release is requested.

## 42. Approved System rings/header/network and release 0.5.7

Implement the approved compact System mock: 48 px CPU/RAM/disk usage rings with measured percentages centred, muted tracks, soft mint arcs and labels/capacities below. Unknown has a dash and no arc; clamp only the drawn fraction for out-of-range measurements and retain their warning/raw value. Configured threshold levels control ring warning/error colours; never introduce fixed severity limits.

Move the configured general system temperature to a small thermometer/value target in the header, independently of CPU. Replace Online with adaptive Up for X days/hours/minutes/seconds when a valid numeric duration with an explicit supported unit or start timestamp is supplied. Remove the duplicate uptime/temperature rows; offline/unavailable availability takes priority. Do not infer online state from uptime alone. Preserve native details for both readings and responsive header wrapping.

Use the existing network RX/TX bindings as Download/Upload live readings beside solid blue/dashed mint samples and a shallow shared 30-minute history graph. Normalize byte/bit and SI/binary rate units to bytes per second for the common zero-based scale; preserve source units in live labels and gaps for unavailable/unsupported historical states. Do not reinterpret totals as rates. Batch both sensors, bound history loading to five seconds, deduplicate between renders, refresh each minute while visible and discard stale replies on configuration/connection/hide/disconnect. Loading/empty/failure states retain live speeds; no synthetic history. Keep database readings, capacity math, thresholds, native details and inline service consent.

The owner authorized releasing all accumulated branch changes together as ikio-v0.5.7: committed Drive sizing/green refinement, design guidelines, seven compact card redesigns, mocks and this System implementation. Supersede earlier no-release restrictions for this release. Keep Light, Energy and Security unchanged, retain the approved Drive changes, synchronize all package versions and preserve asset-free HACS delivery. DOM tests do not claim fresh browser geometry/native-HA verification.

## 43. System mock fidelity and automatic configuration (0.5.8)

The owner reported that the released card differed from the approved mock. Size utilization rings proportionally to card width (16 container percent, bounded 48–76 CSS px), increase ring text to 14 px and ring stroke to match the mock, use Disk title case, and replace the disclosure plus with a native chevron. Keep database information accessible in the collapsed footer's System details subsection rather than an extra overview row; the Services count continues to count services only. Capacity captions require actual configured used/total readings; never invent them from percentages. Genuine zero network history stays flat.

Remove online_state and uptime_mode from the visual editor and new stubs. Existing keys are accepted as legacy data but no longer control interpretation. Recognize ISO start timestamps, numeric durations with explicit units, simple duration text and H:MM:SS automatically. Never infer a unit for a bare number. Detect common online/offline state values and invert binary problem semantics; unknown/custom status text must not imply healthy. Offline/unavailable status retains priority over uptime. All existing entity bindings remain in the editor. Preserve other cards. Publish this correction as ikio-v0.5.8 under the owner’s prior instruction to release the completed System changes; preserve synchronized versions and asset-free HACS delivery.


## 44. Fixed System metric thresholds (0.5.8)

Before the corrective release published, the owner requested removing Metric thresholds from configuration and always using warning 70/error 85. Remove the list and stub entries, ignore legacy threshold overrides, and use inclusive above limits for CPU/RAM/disk percentages and the selected numeric temperature (in its displayed unit). Keep missing values neutral, retain visible warning/error text and existing raw/out-of-range handling. Include this steering in the same 0.5.8 release. This supersedes configurable threshold rules in earlier sections.

## 45. System network label and expanded details cleanup

Remove the redundant Last 30 min heading above the network legend; retain the graph's −30 min and Now axis labels. The footer uses one native chevron in both collapsed and expanded states, suppressing the shared plus/minus decoration in both states. Do not repeat System details inside the expanded body. Database-only details show the reading directly beneath the summary; retain a separator before database information when services precede it.

Remove the System Availability entity selector from the visual configuration. Preserve existing availability bindings for compatibility; new configurations do not need one. Keep the uptime selector and automatic uptime display.

## 46. System history loading and uptime-based status

Request the complete recorded network history for the previous 30 minutes on first display, explicitly including the initial state and disabling significant-only and minimal-response filtering so repeated rate samples and attribute changes remain available. Preserve bounded batched loading, unit conversion, unknown gaps and cancellation. Do not fabricate earlier data if Recorder returns no samples. A recorded initial zero rate may span the full window.

When no legacy availability binding exists, use a valid uptime value for the green online dot and adaptive uptime text. An unavailable uptime sensor shows Offline with a red error-colour dot; missing, unknown or invalid uptime shows Unknown without a status dot. Explicit offline/unavailable legacy availability states also use the red dot. Existing explicit availability bindings retain priority. This owner decision supersedes the earlier prohibition on deriving status from uptime. Sensor availability is the status signal, not an independent reachability probe.


## 47. Ikio brand logo

Use the approved original option B: four asymmetric rounded dashboard tiles forming a house, referring to Greek οικία and the card collection. Preserve the original artwork in assets/branding/ikio-logo.png and display it in the root README for GitHub and HACS repository details. HACS dashboard listings use a generic category icon; do not add unsupported logo manifest keys or change the repository category.

## 48. Optional Energy distribution rings (0.5.12)

Implement the owner's approved compact double-ring diagram with direct device labels and fine external leader lines, appended below the existing Energy card device grid. Keep the existing card's summary, history, grid and interactions unchanged. The visual-editor switch `show_power_distribution` defaults off. Reuse existing total/device/untracked sensors and confirm non-overlapping circuits; no Energy dashboard configuration or extra history request is required.

Inner ring: Home Assistant areas, resolving entity area before device area, with Unassigned as fallback. Outer ring: individual devices, with a different shade of the area's base colour. Angles show each measured consumer's unrounded share of total current watts. The centre initially shows total power; tapping a device, its label or an area shows that segment's watts. Tapping it again or the centre returns to total. Support keyboard selection, native entity details on hold for bound segments/centre, and selection persistence across live updates. Reset stale selection when a segment disappears or configuration changes; never operate real devices for tests.

Keep the normal diagram to 184 px plus its compact separator; omit a duplicated heading, legend, area captions and external watt/percentage labels. Wrap long labels rather than shrinking or clipping them. Expand height only when needed to avoid label collisions. `distribution_max_devices` (visual editor, integer 1–20, default 8) retains the largest devices and groups smaller ones into an Other segment within their own area, conserving each area total. Untracked is a distinct grey remainder. Validate missing/unit/negative/duplicate/overlapping and non-reconciling readings; do not mask bad sensors as zero. Genuine zero has a neutral empty ring and a zero centre. Native floor/source flows and historical energy are not part of this approved two-level consumption view.

The owner subsequently authorized committing, merging and publishing this change as ikio-v0.5.12. Synchronize all package versions and preserve asset-free HACS delivery. Automated DOM/behaviour checks do not constitute browser geometry or native Home Assistant/device verification.

## 49. Cron billing cycle and inclusive dates (0.5.12)

Before publication the owner added `billing_cycle_cron` to the pending release. Accept standard five-field numeric cron with wildcards, lists, ascending ranges and steps. Use Home Assistant's configured IANA timezone, never the browser timezone. Resolve previous reset at or before now and next reset strictly after now. Match current HA/CronSim day/weekday wildcard semantics and fixed-time DST catch-up/first-occurrence behaviour; frequent wildcard schedules follow chronological time. Preserve month lengths and leap years; do not clamp a 31st to month end. Reject unsupported special expressions clearly and bound impossible-schedule searches.

Show inclusive ranges in the existing header: midnight on the 20th to the following month's midnight on the 20th displays 20 October–19 November. Internally use exact [start, next reset) bounds. Non-midnight labels include times through the last covered minute; cross-year labels include years. The owner clarified that cron is for the period label only: do not use the computed start for forecast minimum age or alter energy, bill, forecast or validity calculations. All numeric readings and existing forecast gates retain their original Home Assistant entity inputs. Cron takes precedence only for the displayed period; clearing it restores timestamp labels, and the label override remains compatible.

Schedule a bounded timer for label rollover only so an idle header updates without entity changes. Stop it while hidden/disconnected and recalculate on return, configuration and HA timezone changes. Keep the existing layout and the approved distribution rings unchanged. Include this addition in the already authorized ikio-v0.5.12 release; never overwrite a published tag.

## 50. Energy overall/device separator (0.5.13)

Add a thin theme-aware horizontal divider between the main power history and individual device readings within the same card. Match the existing devices-to-distribution separator exactly: 1 px solid var(--ae-border), 4 px top margin and 4 px top padding. Apply it to a non-empty device grid only. Add no heading or standalone empty row; preserve all readings, sparklines, distribution rings and interactions. The owner authorized committing, merging and releasing this visual adjustment as ikio-v0.5.13, with synchronized manifests and asset-free HACS delivery.

## 51. System network history gaps (0.5.14)

Preserve each known interval through the timestamp where its state becomes unknown or unavailable. Split at gaps before downsampling, preserving segment endpoints; keep actual unknown intervals blank. This fixes isolated recorded zeros becoming invisible move-only SVG paths. Retain current scale, layout and linear connections within known runs. The owner authorized fixing and releasing this as ikio-v0.5.14.

## 52. Complete card renaming (0.6.0)

The owner requests complete renaming, including YAML identifiers, editors, workspace packages, directories and individual bundles, without compatibility aliases. Use Lights, Electricity, Vehicle, Alarmo, Server Monitor, Climate, Media, Camera, Vacuum, Appliances and Graph. Preserve entity/configuration keys and behavior; require explicit YAML migration as documented in MIGRATION.md. Release as a breaking 0.6.0 minor version.

## 53. Approved chart palette

The owner approved the softer Electricity preview and requested implementation everywhere. Centralize mint/green/yellow/amber/coral/red/orchid hues in the shared graph package for Electricity history, device/Untracked sparklines and Graph. Retain all ten normalized stop positions, expected min/max, sRGB interpolation, line widths, scaling, missing-data handling and interactions. Light appearance uses the approved deeper equivalents; HA appearance follows HA darkMode, including live theme changes. Server Monitor traffic uses mint download and orchid upload with matching legend keys, preserving solid/dashed series identity, scaling and gaps. Categorical distribution rings and resource-status meanings stay unchanged. No configuration migration is needed. The owner subsequently authorized merging with a merge commit and publishing ikio-v0.6.2, followed by deletion of the merged source branch.

## 54. Server storage inputs and network extrema

Accept optional ram_free_entity and disk_free_entity in the visual editor as remaining/available storage sensors. Percentage readings retain precedence; used/total remains supported. Without a valid total, calculate utilization from used / (used + remaining), normalizing compatible decimal/binary storage units before adding. Missing, incompatible or negative readings and zero inferred capacity must not create invented utilization. Display actual used/free capacities with explicit labels when no total is configured, and retain native entity details and live updates.

Add a compact left axis for the combined visible 30-minute download/upload minimum and maximum, using readable byte-rate units and faint dashed guides. Both series share the observed scale; constant traffic has one label and guide, and zero retains a visible flat line. Preserve solid/dashed series identity, approved palette, bounded sampling and known/gap boundaries. Simulated fixtures must exercise used/remaining inputs. The owner subsequently authorized a merge commit and release as ikio-v0.6.3, followed by deletion of the merged source branch.

## 55. Server storage captions and graph-label precision

The owner confirmed two changes together: retain the previous compact RAM/disk used / total caption, deriving total from used + remaining if no valid total sensor exists, and show those capacity figures and RAM/disk percentages as whole numbers. Add compatible storage units before rounding the displayed result. Keep utilization, thresholds and ring geometry at full precision. Network min/max graph labels show at most one decimal. CPU, temperature, live traffic, database and other readings retain their existing precision and behavior. The owner subsequently authorized merging with a merge commit and releasing ikio-v0.6.4, followed by source-branch cleanup.

## 56. Compact Alarmo area groups

Group the existing expandable sensor alerts by Home Assistant entity area, falling back to device area and then Unassigned. Do not use Alarmo panel/security areas as physical rooms. Keep a quiet area label on the left and wrapping sensor chips on the right; multiple sensors share a line when they fit. Use a faint existing well background without borders, neutral text and error-colour native sensor icons. Within each area order doors, windows, other openings, motion and other sensors, then label. Preserve full names, native icons, tap/hold entity details, touch targets, collapsed defaults, live updates, bypass consent and current alert membership; keep bypassed/unavailable statuses explicit. Do not add type headings or repeat normal open status. The owner authorized implementation and a commit in a new Alarmo branch, with further Alarmo changes to be committed on the same branch before any merge or release.

## 57. Optional Alarmo activity timeline

Add an off-by-default show_activity visual-editor toggle and optional activity_hours (1–168, default 24). When enabled show a compact, always-visible timeline at the bottom of the card, with no collapse control. Automatically include the panel and all monitored sensors, not just currently open sensors. Read recorded Logbook events, newest first, grouped by local date using HA timezone and timestamps with seconds. Retain historic states, current entity/area labels, native icons and entity details. Display actor names and linked person avatars from recorded context_user_id; use a person icon when a photo is unavailable and Unknown user when the identity cannot be resolved. Never assign users to unattributed events. Request the user directory only for admin viewers and tolerate denial. Use one-minute visible refresh, a ten-second request timeout, cancellation on lifecycle/configuration changes, generation checks for stale results, explicit loading/empty/error states, and a maximum of 200 rendered events with a truncation notice. Activity disabled means no activity requests. No alarm service calls or state changes are made by this feature. Commit separately on the existing Alarmo branch; no merge or release is authorized.
## 58. One collection version definition

Define the release version only in ikio/package.json. Private card and shared-library workspaces omit version fields and reference internal dependencies through local file links. The lockfile records workspace links without independent release versions. The version script validates this structure without copying or modifying versions. Card documentation links to the shared authority instead of maintaining current-version captions. Historical changelog and migration versions remain historical; versioned preview links and compiled release metadata remain generated from the authority. Version selection remains manual, with automated publication after CI; Conventional Commit messages do not calculate version bumps.

The owner subsequently authorized merging and publishing these changes as ikio-v0.7.0, including the single-version cleanup. Rebase onto the latest main before creating a visible merge commit; delete the merged branch after success.

## 59. Scrollable incremental Alarmo activity

The owner requests roughly 5–6 visible activity entries and batches of 20 (superseding the interim 6–8/25 request). Use an always-visible, keyboard-accessible activity region capped at 288 px with a subtle scrollbar and natural short-list height. Scroll near the bottom to append up to 20 older entries, without a collapse or Show more button. HA Logbook get_events has time-range filters but no server event-count limit/cursor; start with a five-minute query and progressively search older ranges, widening sparse ranges up to six hours, buffering excess response entries. Do not prefetch the whole history window; end at activity_hours. Deduplicate inclusive query boundaries, retain chronological order and exact timestamps, and prevent concurrent loads. Minute refreshes query only newer time ranges, retain loaded entries and preserve the visible row/offset while reading older events. Cache history during temporary visibility pauses; cancel pending work and ignore stale results on hide, disconnect or configuration/connection changes. A ten-second timeout bounds each batch/search. Preserve actors, avatars, native icons, entity details and explicit errors/empty/end/loading states. Remove the former 200-entry cutoff. No new configuration is required.

The owner authorized merging with a semi-linear merge commit and publishing ikio-v0.7.1, followed by deletion of the merged source branch.

## 60. Compact Server Monitor service grid

Implement the owner-approved mock: two services per row on mobile and three at 480 px card-content width, with faint well surfaces, status dot/name and a small power action retaining 44 px hit targets. Remove repeated Health labels and full-width action rows. Omit visible Running text; expose it through the accessible name, with exception text for stopped/unavailable/unknown/custom/error readings. Derive health from the explicitly configured status entity, otherwise the control switch, and never mask missing status with a healthy control. Binary problem sensors invert on/off health meaning. Preserve status detail tap/hold, pending/availability guards, optional controls and inline restart confirmation. Both controls use a secondary compact row when configured together. Keep the existing disclosure, database section, metrics, network graph and configuration. The owner authorized implementation and a commit on a new branch, with another Server Monitor change to follow on the same branch before merging or releasing.

## 61. Shared sensor chips and Server Monitor Extra readings

Add a standalone Ikio Chip card (ikio-chip-card) and reuse its shared renderer/styles for Server Monitor's repeatable Extra readings list. Configuration: required sensor entity and optional name; the standalone card additionally has the standard appearance selector. Use a native sensor icon on the left, small muted name above stronger value/unit, faint existing well surface, no border and 8 px corners. Keep 44 px touch targets, natural wrapping, native details on tap/hold and explicit missing/unknown/unavailable states. The standalone card has exactly one chip with no extra title or outer card background. Extra readings appear without a heading between server header and CPU/RAM/disk rings. Remove the dedicated DB Size selector and migrate database_entity to a Database reading only when extra_readings is absent; an empty new list remains empty. Migrate editor input without mutating the supplied config and remove the obsolete key on edits. Extend HACS/manual packaging, registration, README and preview inventory to all twelve cards. Base-branch preview comparisons must tolerate the newly added card. The owner authorized implementation on the existing Server Monitor branch and release as ikio-v0.8.0, including the separately committed compact service grid; preserve semi-linear merge commits and delete the merged branch.

## 62. Live Alarmo activity

Replace normal one-minute recent-history polling with a filtered logbook/event_stream subscription over HA's existing connection, including the selected panel and monitored sensors. Keep the 20-entry incremental history loader and configured rolling window. Coalesce incoming events for 100 ms, deduplicate live/history/replay boundaries and avoid rerendering duplicate-only batches. Preserve reader position and actor/icon data. On reconnect, explicitly resubscribe from the last covered timestamp with a two-second overlap, disabling the connection library's automatic stale-start resubscription. Stop subscriptions, event listeners, timers and pending event batches when hidden/disconnected/disabled or configuration changes; close late subscription acknowledgements and ignore stale callbacks. Bound subscription setup to ten seconds, and use one-minute incremental polling/retry only when streaming is unavailable. The normal minute timer may expire old rows locally without downloading history. Do not subscribe to unfiltered entity traffic or simulate logs from current state changes. No new configuration or release is requested by this implementation.

## 63. Mandatory design agreement and Climate redesign

For all future new cards and redesigns, obtain explicit owner agreement on both the visual mock and configuration before implementation. The owner requests a from-scratch Climate redesign; discard the unapproved device-list implementation draft and restart design. Retain the requested direction of removing the fridge temperature selector and allowing multiple devices without fixed one-per-type slots as inputs to the configuration proposal, not as an approved final design. The separately committed live Alarmo activity change remains available for review.

## 64. Generic cards as a standing design requirement

Every card must be generic and reusable rather than built around the owner’s personal use case. Household examples must not dictate fixed entity slots, cardinalities, names or defaults. Design configuration around general tasks and actual HA entity capabilities, using repeatable lists where appropriate and explicitly identifying real supported-domain limits. Apply this principle together with the requirement to agree on both mock and configuration before implementing new cards or redesigns.

## 65. Chip as a dashboard badge

Expose the already approved sensor chip in Home Assistant’s badge picker as Ikio Chip, type custom:ikio-chip-badge, alongside the existing custom:ikio-chip-card. Reuse its renderer, visual editor, sensor/name/theme configuration, native icons and tap/hold details without a new design or additional resource. Use a distinct custom-element subclass to register the badge and remove inline-size containment so it can size to content in a badge row. Keep the card registration and twelve-card package inventory intact. This explicitly requested reuse does not authorize the Climate redesign or a release.

## 66. Approved focused Climate card

The owner locked the compact semicircle mock and approved the complete configuration, then authorized implementation, commit and push of all pending work. No merge or release was requested.

One `climate.*` entity per card; any number of card instances. Target temperature is the focus inside a small semicircle, with 44 px minus/plus buttons beside it. Arc dragging previews locally and submits once on release; keyboard range controls submit on change. Follow device limits and target_temp_step (fallback 1); optional temperature_step requests a larger increment rounded up to a multiple of the native step. Preserve heat_cool dual targets and the opposite bound. Current temperature, humidity and optional power are a quiet secondary strip. Modes are a segmented toggle, ordered Off, Cool, Heat, Heat/cool, Auto, Dry, Fan where supported. Use blue for cool, coral for heat, mint for auto/heat_cool, humidity colour for dry, mint for fan and neutral for off. Device-confirmed state determines selection, colour and readings; service failures/timeouts remain visible. Retain independent readings when off or unavailable.

Configuration: required climate_entity; optional name, temperature_entity, humidity_entity, power_entity, temperature_step and standard appearance. show_fan/show_preset/show_swing/show_horizontal/show_vertical default true but controls require actual capabilities. Native fan, preset, swing and horizontal swing values come from the integration. Optional horizontal_position_entity and vertical_position_entity accept select/number domains; use their options/min/max/step and native services without guessed positions. Separate position entities are explicitly selected, never inferred by matching names or device IDs. Do not guess whether native swing values imply an axis is moving when controlling independently mapped position entities. Device settings start collapsed and retain disclosure/focus across ordinary updates.

Remove fridge and fixed humidifier/fan slots from this card. Existing climate_entity, name, room sensors, appearance and HA dashboard metadata carry over; climate_power_entity migrates to power_entity unless the latter is explicitly set. Obsolete slots are removed from normalized editor output. Configurations containing only a former humidity/fan device show a prompt to choose a climate entity; the dedicated humidity card needs its own approved mock and configuration before implementation.


## 67. Release 0.9.0 authorization

The owner authorized releasing the completed Climate redesign, Alarmo live activity and Chip badge work, deferring the humidity/dehumidifier card design. Bump the minor version for the Climate configuration/domain change. Merge with a visible semi-linear merge commit, publish ikio-v0.9.0 through CI, and remove the merged source branch.
