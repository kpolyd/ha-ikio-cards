# Ikio changelog

## 0.3.0 — public repository migration

- Rename Aethora to Ikio across all eleven cards, shared packages, theme, editors, bundles and documentation.
- Import the full collection into ha-ikio-cards with fresh history, generic examples and no 3D card or household bindings.
- Keep the compact layouts, energy graph refinements, automatic lock states and editor typing fix from 0.2.3.
- Breaking namespace change: migrate saved `custom:aethora-*-card` types to `custom:ikio-*-card` and use the Ikio resource URL.

## 0.2.3 — in development

- Fix interrupted typing in visual editors across all eleven cards, including Energy device names.
- Preserve focused fields when Home Assistant echoes configuration changes; continue applying external edits and list operations.

## 0.2.2 — in development

- Fix car lock indicators for HA binary lock sensors, including configurations saved with the previous locked/unlocked default.
- Automatically combine native locks and binary lock sensors; retain explicit inverted-binary mapping.
- Distinguish genuine unavailable/unknown/transitional/jammed states without changing door/window indicators.

## 0.2.1 — in development

- Make compact spacing the default throughout the collection: smaller padding, 4 px section gaps, 44 px reading targets and 24 px main values.
- Keep slider labels inline and combine related media, appliance, camera and location controls into rows without hiding readings.
- Use a plain Open location in maps link beside parking details.
- Reduce idle camera placeholder space and keep full native live-view sizing.
- Keep narrow-screen control rows usable rather than stacking every control.

## 0.2.0 — in development

- Replace light brightness bars and percentages with Home Assistant entity/device area labels; keep tap-to-toggle and native details on hold.
- Add optional location labels in the lights visual editor and refresh areas when registry metadata changes.
- Compact Home Energy header/totals while retaining 44 px interactive targets.
- Replace the energy graph footer with readable min/max vertical-axis labels from the displayed history window. Standalone Graph retains its footer.
- Version imported card resources so a new collection resource URL also refreshes its entry modules.

## 0.1.0 — in development

- Shared compact UI and native Home Assistant editor compatibility.
- Light Studio with mixed switches/lights, inline brightness, native details on hold.

- Implement the remaining ten cards: Graph, Energy, Comfort, Appliance, Media, Cleaning, Security, Camera, System and Drive.
- Add shared stable controls, native-style schema editors and optional matching HA dark/light theme.
- Add value-based graph gradients, billing-cycle totals, clickable circuit readings, Alarmo override confirmation and car status summaries.
