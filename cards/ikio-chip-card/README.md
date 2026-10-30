# Ikio Chip

A very compact sensor or person chip: 14 px icon and value inside a 28 px visible surface with 7 px corners and a subtle theme-aware border. **Show name** is on by default to place a quiet name above the value in a 34 px surface. Each chip retains a transparent 44 px touch target; long names/values can grow to fit. There is no title or outer card background. Server Monitor's Extra readings use the same compact renderer, border and per-reading name/icon settings.

Install the full collection through HACS. Add **Ikio Chip**, select a sensor or person **Entity**, set **Show name** (on by default), optionally override its **Card name** and **Icon**, and choose dark, light or Home Assistant appearance at the bottom. Values/units follow the sensor. Leave Icon empty to follow the native entity icon; clearing a custom icon restores that behavior. Tap or hold opens native Home Assistant entity details; no services are called. Missing/unknown/unavailable readings stay explicit. Long text wraps and touch targets remain at least 44 px.

```yaml
type: custom:ikio-chip-card
entity: sensor.example_database_size
name: Database
show_name: true
icon: mdi:database
appearance:
  theme: dark
```

Collection version: see [the shared version](../../ikio/package.json). Automated DOM and compiled-fixture checks do not establish native HA/device compatibility.

## Dashboard badges

The same chip is available as **Ikio Chip** in Home Assistant's badge picker. Edit a dashboard view, add a badge, select Ikio Chip, then choose a sensor or person, name visibility, optional name/icon overrides and appearance. It uses the existing Ikio resource, so no additional installation is needed. The badge and card share their visual editor, rendering and native details on tap/hold.

```yaml
badges:
  - type: custom:ikio-chip-badge
    entity: sensor.example_database_size
    name: Database
    appearance:
      theme: ha
```

The card type remains `custom:ikio-chip-card`. Use `custom:ikio-chip-badge` in a view's badges list.
