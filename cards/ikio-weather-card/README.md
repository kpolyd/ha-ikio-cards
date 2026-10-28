# Ikio Weather

A compact weather card with current conditions above a combined temperature/rainfall forecast. Daily highs use a solid mint line; lows use a dashed blue line. Rainfall appears as subtle background bars with amounts below. Hourly and day/night forecasts use one temperature series. Appearance follows Home Assistant by default, with the standard Ikio dark/light choices.

```yaml
type: custom:ikio-weather-card
entity: weather.home
```

`entity` is the only required binding, a `weather.*` entity from your configured integration. No additional sensors, keys or template helpers are required. All options are available in the visual editor; the header opens native entity details on tap or hold. Switching forecast types reads data and never changes device state.

| Option | Default | Meaning |
| --- | --- | --- |
| `entity` | Required | Weather entity |
| `name` | Entity name | Optional card heading |
| `appearance.theme` | `ha` | `ha`, `dark` or `light` |
| `show_current` | `true` | Current temperature and condition |
| `show_feels_like` | `true` | Apparent temperature, when supplied |
| `show_humidity` | `true` | Current humidity |
| `show_wind` | `true` | Current wind speed and direction |
| `show_pressure` | `false` | Current air pressure |
| `show_forecast` | `true` | Forecast section |
| `forecast_type` | `daily` | `daily`, `hourly` or `twice_daily`; falls back to a supported type |
| `forecast_slots` | `7` | Entries to show, integer 3–7; fewer when the provider supplies fewer |
| `show_forecast_conditions` | `true` | Condition icons for each forecast entry |
| `show_temperature_graph` | `true` | Temperature lines; disabling shows temperature values instead |
| `show_precipitation` | `true` | Rainfall bars and amounts |
| `show_precipitation_probability` | `false` | Rain probability percentages |
| `show_forecast_wind` | `false` | Wind speed/direction for each entry |

The card discovers forecast support from the entity and uses Home Assistant's `weather/subscribe_forecast` WebSocket API. Only available types appear as switches; three supported types use a compact selector and a single type needs no switch. Current conditions remain usable when a forecast is absent or fails. A bounded loading state exposes Retry after errors/timeouts. Subscriptions stop while the card is offscreen, the document is hidden, the entity is unavailable, the forecast is disabled or the card is disconnected. Late callbacks from a previous entity, type or connection are ignored.

Temperature and rainfall use **separate scales**: the lines show the temperature trend; the bars are relative to the largest displayed rain amount, with exact amounts labelled below. Zero rainfall has no height. Unknown readings remain missing, never become zero, and temperature lines break across missing samples. Very narrow columns omit labels that cannot fit; individual SVG point descriptions retain their values. No forecasts are extrapolated, paired or fabricated. Twice-daily day/night entries are rendered separately.

Use the provider's units and Home Assistant number/language/time-zone preferences. Missing optional current readings are omitted. A missing forecast value is a dash if other entries provide that measurement; an entirely absent optional measurement is omitted. English and Greek labels are bundled locally. No production card uses preview weather data.

Validation: automated DOM and simulated browser checks cover subscriptions, reconnects, stale callbacks, timeouts, units, missing data, configuration, appearances and widths. These are not native Home Assistant or live-provider verification.
