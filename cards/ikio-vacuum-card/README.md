# Ikio Vacuum

A compact vacuum card with an entity-derived name, state and battery above a single row of cleaning, dock and suction controls. Its 28 px native Home Assistant entity icon gently moves with a small sparkle only while the device reports cleaning. The card uses the same Ikio dark/light palettes as the collection, with an option to follow the Home Assistant theme. Language follows Home Assistant.

Install the full collection through the [HACS instructions](../../docs/ikio/INSTALLATION.md#hacs). All thirteen cards and editors share one HACS download and the [collection version](../../ikio/package.json).

## Configuration

The visual editor has one required **Vacuum** selector (`vacuum.*`). Each card operates one vacuum; add more card instances for other devices. The standard Appearance selector offers Ikio dark (default), Ikio light and Follow Home Assistant. No YAML is required.

```yaml
type: custom:ikio-vacuum-card
entity: vacuum.robot
```

The entity supplies its friendly name/native icon, state, supported cleaning actions and fan-speed options. The card uses `battery_level` when it is a valid percentage, including zero. Missing or invalid battery data is hidden, and an unavailable vacuum's battery is unknown. A battery exposed only as a separate sensor is not automatically linked. The card uses the vacuum's own state instead of a separate supplemental status sensor.

During cleaning the primary action is Pause, or Stop when only stopping is supported. Paused devices offer Resume; docked/idle devices offer Start cleaning when supported. Return to dock is available when supported and relevant. Suction appears only with the device capability and actual options; integration-specific option names are preserved. Backend errors and pending actions stay inline, with bounded confirmation and no optimistic cleaning animation.

Animation stops when paused, returning, hidden, disconnected or in editor preview. Reduced-motion preferences disable animation. The icon occupies existing header space; normal docked/cleaning states keep the same compact height. Tap the name or hold an entity control for native HA details. Focus, selected values and HA layout/visibility metadata survive updates.

## Migration

This redesign removes More controls, maintenance readings, mission scripts and optional device configuration fields. Existing `entity`, `appearance` and HA metadata are retained; `name`, `battery_entity`, `status_entity`, `maintenance` and `missions` are removed from normalized editor output without mutating the supplied configuration. Rename the entity in HA to change the title; appearance uses the standard collection selector. Separately configured missions and maintenance sensors can be placed in their own dashboard controls/readings.

## Validation

Run `npm test --workspace @ikio/vacuum-card` for DOM/service/editor checks. After building, `npm run preview:build` and `npm run test:browser -- vacuum` exercise the compiled card with simulated HA data, themes, narrow widths, state changes, errors, missing battery, Greek text and reduced motion. The complete browser suite remains in CI. These checks do not certify native HA or live-device compatibility. No real devices are operated by tests or previews.
