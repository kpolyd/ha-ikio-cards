# Ikio Climate

A compact card for one Home Assistant `climate.*` entity: AC, thermostat or heat pump. Add multiple card instances for multiple devices. Install through the [collection instructions](../../docs/ikio/INSTALLATION.md); the version is defined in [ikio/package.json](../../ikio/package.json).

The small semicircle emphasizes the target temperature. Drag to preview and release to send one command, use minus/plus, or focus the dial and use arrow keys. The selected mode colours the target and segmented toggle. Supported heat/cool ranges show two targets and preserve the other bound. Current readings remain visible while off; independent sensors remain visible when the climate entity is unavailable. Holds open native entity details.

## Visual configuration

| Field | Behaviour |
| --- | --- |
| Climate entity | Required; `climate.*` only |
| Name | Optional; entity name by default |
| Current temperature sensor | Optional override of the climate reading |
| Humidity sensor | Optional override; otherwise climate humidity if available |
| Power sensor | Optional |
| Temperature step | Empty = Auto; integration step, fallback 1°. Overrides use a larger whole multiple of the native step |
| Show fan / preset / swing / horizontal position / vertical position | Enabled by default; only supported/configured controls appear |
| Horizontal / vertical position entity | Optional `select.*` or `number.*`; options and numeric limits come from that entity |
| Appearance | Ikio dark (default), Ikio light, or Home Assistant |

Device settings start collapsed. Native climate swing controls and separately mapped exact positions retain the integration's real labels; the card does not invent angles, positions or relationships between separate entities. Unsupported controls are omitted. No service calls occur in dashboard preview; errors and unconfirmed actions remain visible.

## Migration

Existing climate/room-sensor bindings, name, appearance and dashboard metadata remain. `climate_power_entity` becomes `power_entity` unless the latter is explicitly set. Fridge, humidifier, standalone fan and initial-device fields are removed. Old cards configured only for humidifier/fan show the climate-entity prompt. A separate humidity card is being designed; it is not included in this change.

Automated DOM tests cover services, capabilities, target constraints, migration, editor preservation and unavailable states. Simulated previews are not native HA or live-device verification. No external runtime dependencies are loaded from a CDN.
