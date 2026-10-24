# Ikio Energy

Collection version **0.3.0**. Native HA frontend target: 2026.10. This code has automated DOM/behaviour validation; native HA/device compatibility still needs live verification.

## Installation

From the root run `npm ci`, `npm run build`, `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from the generated collection to `/config/www/ikio` and add `/local/ikio/ikio.js?v=0.3.0` as a JavaScript module in Settings → Dashboards → Resources. Keep every module and lazy `chunks/` directory. Alternatively install this card’s complete `dist/` directory and register its own `ikio-energy-card.js`. Use only one route.

Add card → Ikio Energy. Configure all fields through the visual editor. No YAML required. No household entities are guessed.

## Visual editor fields

| Field | Setting |
|---|---|
| power_entity | Total power (required to operate) |
| day_entity | Billing-cycle day energy |
| night_entity | Billing-cycle night energy |
| total_energy_entity | Billing-cycle total energy (optional) |
| billing_period_label | Billing-cycle dates/label |
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
