# Ikio Chip

A standalone sensor chip with its native icon on the left, a small muted name above its value, a faint background and 8 px corners. The same component is used by Server Monitor's Extra readings.

Install the full collection through HACS. Add **Ikio Chip**, select a **Sensor**, optionally override its **Card name**, and choose dark, light or Home Assistant appearance. Values/units and icons follow the sensor. Tap or hold opens native Home Assistant entity details; no services are called. Missing/unknown/unavailable readings stay explicit. Long text wraps and touch targets remain at least 44 px.

```yaml
type: custom:ikio-chip-card
entity: sensor.example_database_size
name: Database
appearance:
  theme: dark
```

Collection version: see [the shared version](../../ikio/package.json). Automated DOM and compiled-fixture checks do not establish native HA/device compatibility.

## Dashboard badges

The same chip is available as **Ikio Chip** in Home Assistant's badge picker. Edit a dashboard view, add a badge, select Ikio Chip, then choose a sensor, optional name and appearance. It uses the existing Ikio resource, so no additional installation is needed. The badge and card share their visual editor, rendering and native details on tap/hold.

```yaml
badges:
  - type: custom:ikio-chip-badge
    entity: sensor.example_database_size
    name: Database
    appearance:
      theme: ha
```

The card type remains `custom:ikio-chip-card`. Use `custom:ikio-chip-badge` in a view's badges list.
