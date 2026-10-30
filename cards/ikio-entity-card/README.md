# Ikio Entity

One compact entity per card. Supports light, switch, input_boolean, sensor, person, binary_sensor, button and input_button. Select an entity, optional name/icon overrides and appearance in the visual editor. Ikio dark is the default; Ikio light and Follow Home Assistant are also available.

Lights reuse the Lights colour/state dot and capability-based brightness line. Switches/helpers have a power symbol; the whole card toggles. Sensors, people and binary sensors show HA-formatted values/states and open native details. Buttons/helpers invoke press. Holds and the keyboard-accessible details control always open native details. Icons come from the entity unless overridden. Unknown/unavailable entities cannot send commands; values are not fabricated. Actions wait for backend confirmation; editor previews never send commands.

Home Assistant Sections Layout controls width and height. Default is three grid columns and one row; the content fills the assigned space. Other dashboard layouts determine sizing themselves. No separate card sizing setting is added. Existing `grid_options`, `view_layout` and unknown HA metadata survive editor changes.

Install with the collection HACS bundle; standalone builds must retain the chunks directory. Build with `npm run build --workspace @ikio/entity-card`. Automated DOM/browser fixtures do not establish native HA or live-device outcomes.
