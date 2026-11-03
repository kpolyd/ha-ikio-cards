# Migrating from Aethora to Ikio

Ikio 0.3.0 retains the card behaviour and configuration fields from Aethora 0.2.3. Card identifiers, bundles, package names, resources and theme names now use `ikio`. This is a one-time namespace migration; loading the new resource does not automatically rewrite saved dashboards.

1. Back up your dashboard configuration.
2. Install the Ikio loader and card folders in `/config/www/ikio/` (or `/homeassistant/www/ikio/` when that is your editor's configuration path).
3. Change the JavaScript module resource to `/local/ikio/ikio.js?v=0.3.0` and fully reload the frontend.
4. For each existing card, replace its type prefix `custom:aethora-` with `custom:ikio-`. For example, `custom:aethora-energy-card` becomes `custom:ikio-electricity-card`. Entity selections and all other fields stay the same. The new cards also offer full visual editors if you prefer to recreate them through Add card → Ikio.
5. If using the optional global theme, install `ikio/themes/ikio.yaml` through your existing theme setup and select Ikio and your preferred dark/light mode. Card-level `appearance.theme` values (`dark`, `light`, `ha`) do not change.
6. Remove old Aethora resource entries once no dashboard uses the old card types. Keep the old files until you have verified your migrated dashboard.

There is no automatic alias registration for Aethora types. Do not register both the collection loader and individual Ikio bundles; choose one installation route. Keep every card's lazy chunks beside its entry module.

All eleven suffixes are retained: `light-card`, `comfort-card`, `appliance-card`, `media-card`, `cleaning-card`, `security-card`, `camera-card`, `energy-card`, `system-card`, `drive-card`, and `graph-card`.

## Switching manual Ikio installations to HACS

Install Ikio Cards through the HACS custom Dashboard repository, verify its `/hacsfiles/ha-ikio-cards/ha-ikio-cards.js` resource, remove the old `/local/ikio/...` resource, and fully reload. Existing `custom:ikio-*-card` types and all entity selections stay unchanged. HACS manages subsequent version updates. Aethora types still need the one-time rename described above.

## 0.6.0 card identifiers

Replace the YAML `type` values below. Update individual bundle resource filenames to match; the HACS collection resource `ha-ikio-cards.js` stays the same. No legacy aliases are registered. Other configuration keys stay the same.

| Old type | New type |
| --- | --- |
| `custom:ikio-light-card` | `custom:ikio-lights-card` |
| `custom:ikio-energy-card` | `custom:ikio-electricity-card` |
| `custom:ikio-drive-card` | `custom:ikio-vehicle-card` |
| `custom:ikio-security-card` | `custom:ikio-alarmo-card` |
| `custom:ikio-system-card` | `custom:ikio-server-monitor-card` |
| `custom:ikio-comfort-card` | `custom:ikio-climate-card` |
| `custom:ikio-cleaning-card` | `custom:ikio-vacuum-card` |
| `custom:ikio-appliance-card` | `custom:ikio-appliances-card` |


## 0.12.0 Media configuration

The locked Media redesign always displays available artwork as a background behind the playing title, transport and timeline. `show_artwork` is removed. Volume becomes a compact minus/mute-and-percentage/plus control; `volume_step` defaults to 5 percentage points, used for known numeric volume with volume-set support. Native step-only players retain their integration's native step. Existing player/name/volume/source/power/appearance bindings and dashboard metadata remain. Source and volume are hidden while off.

Replace the fixed `backlight_entity` and `shortcuts` with the new repeatable `more_controls` list of `{ entity, name? }` entries. Accept light/switch/scene/script entities. If the new list is absent, normalization puts the old backlight first and then old shortcuts in their existing order, mapping each shortcut `label` to `name`. An explicitly configured new list, including `[]`, wins. Saving the visual editor removes legacy keys without mutating the input object. No manual migration or new resource is needed.


## Removal of Appliances and Camera

The collection now contains sixteen cards. Remove or replace any dashboard uses of `custom:ikio-appliances-card` and `custom:ikio-camera-card` before upgrading to a release containing this removal. Those card/editor registrations are no longer included. Other card identifiers are unchanged. Graph keeps existing entity lists, names, colour ranges, `show_legend`, history duration, actions and native layout metadata. New Graph configurations use automatic colour ranges unless overridden.

## 1.0.0 stable configuration

Card types and the collection resource URL remain unchanged. Fully reload browsers after updating. Future breaking changes increment the major version; features increment minor and fixes increment patch.

- Electricity migrates saved Day/Night energy bindings to ordered `energy_readings` entries with labels and optional colours. Its settings are grouped into Power, Billing cycle, Power history, Device power and Power distribution. Configure `billing_cycle_cron` for cycle dates or use `billing_period_label` for a manual caption. `cycle_start_entity`, `cycle_end_entity` and `forecast_minimum_hours` are retired and ignored/removed when configurations are normalized. Forecast values come from the selected sensor; any saved forecast-validity binding remains supported.
- Actions has Tap/Hold only. Supported actions use the pressed light or the card's primary entity; alternate entity/service targets cannot redirect commands. Use a compatible service for that entity. Missing primary bindings block commands. Dedicated controls retain their native behaviour.
- Electricity, Router, Server Monitor, Batteries, Graph, Vehicle, Alarmo and Home 3D have no configurable card-wide Actions section; old custom header action keys are inert. Recreate a separate Entity/Chip card if you need an independent action target.
- Lights location overrides, Vehicle parking-label/timestamp bindings, Alarmo extra opening/motion rows and Electricity validity/untracked-sensor bindings are no longer offered in their editors. Saved sensor bindings remain supported; Alarmo normally discovers its sensors automatically.
- Mini Graph has numeric secondary history, configurable sampling and optional static colour. Alarmo can display people at home with an ignored-person list. Both retain their existing primary entity bindings.

Use the visual editor to review and save migrated configurations. No Home Assistant devices are operated as part of the update itself.
