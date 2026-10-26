# Ikio Energy

Install the full collection through the [HACS custom repository instructions](../../docs/ikio/INSTALLATION.md#hacs). All cards and editors share one HACS download and version.

Collection version **0.5.14**. Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.5.14` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-energy-card.js`. Use only one route.

Add card → Ikio Energy. Configure all fields through the visual editor. No YAML required. No household entities are guessed.

## Visual editor fields

| Field | Setting |
|---|---|
| power_entity | Total power (required to operate) |
| day_entity | Billing-cycle day energy |
| night_entity | Billing-cycle night energy |
| total_energy_entity | Billing-cycle total energy (optional) |
| billing_period_label | Billing-cycle dates/label |
| billing_cycle_cron | Optional five-field numeric reset schedule, evaluated in Home Assistant's timezone; calculated dates are inclusive |
| same_cycle | Day and night entities cover the same billing cycle |
| cycle_start_entity | Billing-cycle start timestamp |
| cycle_end_entity | Billing-cycle end timestamp |
| accrued_bill_entity | Estimated/accrued bill |
| forecast_bill_entity | Forecast bill |
| forecast_valid_entity | Forecast validity |
| forecast_minimum_hours | Minimum forecast age (hours) |
| untracked_entity | Existing untracked-power sensor |
| show_untracked | Show calculated untracked power |
| non_overlapping | Selected circuits do not overlap |
| show_power_distribution | Show the optional labelled double-ring power diagram (default off) |
| distribution_max_devices | Number of individual devices to label before grouping smaller consumers into Other (1–20, default 8) |
| hours | Power history hours |
| expected_min | Expected minimum power |
| expected_max | Expected maximum power |

### Device power
Stable display order. Do not select both a parent circuit and its child.

- **Power sensor** (power_entity)
- **Device name** (name)

## Shared behaviour

Dark, light and follow-HA appearance use the same shared Ikio styles. Controls have at least 44 px targets; readings remain useful when another entity is offline. Native entity details open on hold. No service call is made in the editor preview. Backend errors remain visible. Optional entities may be omitted. See [full contract](../../docs/ikio/SPECIFICATION.md) and [collection status](../../docs/ikio/STATUS.md).

No external runtime CDN dependencies. esbuild MIT license is copied into the build output. Shared UI/graph code is bundled locally.

## Pending compact summary layout

On the feature branch, current power is the primary reading on the left. Day/Night/Total energy are stacked in the middle, with estimated bill and forecast stacked on the right in a quieter colour. Optional columns disappear when not configured. Tariff energy is normalized to kWh for the shared column heading; billing-period and forecast-validity safeguards remain in place.

Power readings display whole watts, including values supplied by kW/MW sensors. Only presentation is rounded: untracked calculations and plotted history retain full precision. The energy graph has faint dashed horizontal guides aligned with observed minimum, midpoint and maximum labels. A constant series has one guide; duplicate rounded midpoint labels are omitted. Expected min/max still control only the colour gradient. The standalone Graph card does not gain these guides.

Untracked occupies an ordinary slot in the device grid. A bound sensor has the same appearance and native details interaction as the other sensor readings. A calculated remainder is a plain read-only value with no fabricated entity or action button; unavailable/incompatible input and overlap warnings remain visible. The upper tariff figures use compact information rows; the main power and device entries retain their existing touch targets.

These changes ship in collection version 0.5.4.

Device power readings include compact sparklines beside their watt values without adding row height. They use the main graph's history window and automatically scale each device's visible minimum/maximum vertically. Colours use the main graph's expected min/max and full palette, so identical watts have identical colours; no per-device range configuration is needed. Sparkline strokes are 0.8 px, independent of the main graph line width. Untracked also has a sparkline, using either its configured sensor or total minus confirmed non-overlapping circuits. Missing history stays blank and unavailable samples create gaps.

In 0.5.4 the estimated bill and forecast labels/values align to the right edge of their column. Day/Night/Total each display exactly one decimal and a smaller kWh suffix. Compatible source units are converted before display; totals use unrounded inputs. Missing/incompatible data and billing-cycle safeguards remain.

Device sparklines hold each recorded value until its next update, then step to the new reading. This avoids a false diagonal ramp when a sensor stays unchanged for a long time. Missing data still breaks the line; no initial zero is invented.

## Optional live power distribution

Enable **Show labelled power distribution rings** in the visual editor to append the diagram below the existing device grid. All existing summary, history and grid content stays unchanged. It uses the configured Device power list and current total, with no additional history request or Energy dashboard setup. Confirm **Selected circuits do not overlap**; do not select a breaker together with its downstream devices.

The inner ring groups consumption by Home Assistant area (entity area takes priority over device area; missing assignments use Unassigned). The outer ring shows individual devices in shades of their area's colour. Segment angles use unrounded watts relative to the total. Untracked is the grey remainder, independently of whether the existing grid's calculated Untracked row is enabled. A configured untracked sensor must reconcile within 1 W; the graph conserves the exact total using the remainder.

Only device names and fine leader lines appear around the rings. Tap a device, its label or an area to replace the centre total with its current whole watts. Tap the same segment again or the centre to restore the total. Arrow keys explore areas/devices; Escape or Home restores total. Hold a bound device segment/label or the centre for native entity details. Area and calculated aggregate segments do not invent entities or operate devices. Selection survives live updates and resets when its segment disappears or configuration changes.

The diagram is normally 184 px tall plus a compact divider; it has no repeated heading or separate legend. Long names wrap at readable size, and only crowded labels expand the diagram enough to remain legible. The device limit retains the largest consumers and combines the rest into **Other (area)** within each original area, preserving all watts and area totals. Other contains measured devices; Untracked is a separate remainder. Zero-watt devices have no segment. Missing, incompatible, negative or non-reconciling data produces a short explanation instead of misleading shares; genuine zero total remains zero.

## Billing cycle from cron

Copy your Utility Meter reset expression into **Billing cycle cron** in the visual editor. For example, `0 0 20 * *` resets at midnight on the 20th each month. Timestamp entities are optional when cron is supplied. The card uses `hass.config.time_zone`, never the phone/browser timezone. The most recent reset is included in the current cycle; the next reset starts the following one.

Displayed bounds are **inclusive**: a midnight reset on the 20th shows **20 October–19 November**, not 20 October–20 November. Non-midnight cycles include times and end on the last covered minute. Cross-year labels include years. The cron value is used only for this label. Energy, bill and forecast values continue to come from the configured Home Assistant sensors. Cron does not change forecast-validity/age gates, reset meters, create sensors or recalculate bills.

Supported syntax is five numeric fields (`minute hour day month weekday`) with `*`, comma-separated lists, ascending ranges and steps. Sunday is 0 or 7. Day/weekday restrictions and fixed-time DST catch-up/repeated-hour behaviour follow current Home Assistant's CronSim scheduler. Month-end days are not clamped: day 31 skips months without a 31st. Special expressions (`L`, `#`, aliases/named days, seconds or year fields) are rejected clearly. Impossible dates and unavailable/invalid HA timezones produce an explanatory message instead of guessed dates. No external cron library or CDN is loaded.

Cron takes precedence over timestamp bindings only when choosing the displayed cycle label. Clearing it restores existing timestamp label behaviour. An optional label override still controls the caption. The header updates at the next reset even without a sensor change, pauses while hidden or disconnected, and recalculates on return and HA timezone changes. Existing forecast validity and minimum-age gates continue to use their original entity bindings. The existing card layout is preserved.
