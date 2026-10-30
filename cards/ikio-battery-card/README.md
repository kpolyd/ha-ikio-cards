# Ikio Batteries

Automatically finds battery devices, sorts lowest first and summarizes the replacement batteries needed. Add **Ikio Batteries** from the dashboard card picker: no entity list or required configuration.

| Visual editor setting | Default | Meaning |
|---|---|---|
| Low battery threshold (%) | 25 | Readings at or below this value count as low and contribute to Replace. |
| Collapse batteries above (%) | 80 | Readings above this value appear under Show all. Exactly 80% stays visible by default. |
| Ignored devices | Empty | Native searchable multi-device selector; excludes the selected devices from rows, counts and replacement totals. |
| Appearance | Ikio dark | Ikio dark, Ikio light or Follow Home Assistant; always last. |

An optional card name is also available. Expanding shows all non-ignored readings in ascending order. Unavailable readings stay visible with an explicit label. Tap or hold a row opens native HA entity details; the card never sends device commands.

## Discovery and battery information

Uses Home Assistant's current states and entity/device/area registries. Finds `sensor` entities with `device_class: battery`, `binary_sensor` low-battery indicators, and numeric `battery_level` / `battery` attributes on other entities. Only numeric percentages in 0–100 are accepted. Binary indicators show Low/Normal, never an invented percentage. One device gets one row: a usable percentage sensor takes precedence, then a legacy battery attribute, then binary status. Entities without a registry device remain independent rows. Unavailable and invalid values are never shown as healthy.

Shows the device name, native entity icon, area and last-updated age. Names wrap on narrow screens. Battery type is used only when actually exposed by the integration through `battery_type` / `battery_size` attributes or companion entities on the same registered device with a `battery_type` / `battery_size` entity-ID suffix or translation key. Counts similarly use `battery_quantity` / `battery_count`. Renamed companion entities work when their registry translation key is present. No external device database or model-name guessing is used.

The Replace line groups matching types and counts individual cells: `2 × AAA` on two low devices becomes `4 × AAA`. Embedded `2xAAA` / `2 × AAA` forms are supported. An explicitly reported quantity overrides the embedded count; a bare type defaults to one cell. Invalid reported counts and missing types are flagged as unknown in the summary. Explicitly rechargeable types (`Li-ion`, `Li-po`, `Lithium-ion`, `Rechargeable`) or `battery_rechargeable: true` are excluded from replacement purchases, while their low reading remains in the list/count. Battery type is not universally exposed by HA integrations, so some rows will have none.

No history requests, polling or extra registry subscriptions. HA updates discover new/removed devices and metadata; a visible-card-only minute timer refreshes relative ages. English and Greek follow the HA language. Simulated DOM/browser fixtures do not establish native HA/device compatibility.

```yaml
type: custom:ikio-battery-card
low_threshold: 25
collapse_threshold: 80
ignored_devices: []
appearance:
  theme: dark
```
