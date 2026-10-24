# Ikio changelog

## 0.4.0 — Compact mobile controls

- Compact Drive into two rows with icons for range/fuel/odometer and locks/doors/windows.
- Add state-based secure/alert/error/unknown colours and native sensor details on status tap/hold.
- Move parking into the header and preserve a plain maps link beside location age.

- Reorganize Energy into a left-focused current-power reading, stacked Day/Night/Total column and quieter estimated/forecast bill column.
- Show whole watts without rounding calculations or history; add faint dashed min/mid/max graph guides and aligned labels.
- Place Untracked alongside device readings; calculated Untracked is read-only rather than an action button.

- Add an optional Lights visual-editor toggle to group by location, packing compatible consecutive areas into three-light rows.
- Use 44 px light buttons, clear area headings/dividers, live counts and an Unassigned group without repeated location labels.
- Keep native details on hold, stable controls during state updates and visible unavailable statuses.

## 0.3.2 — HACS download compatibility

- Serve the tracked, verified collection bundle from raw tagged repository content to avoid oversized GitHub release-redirect headers in HACS 2.0.5.
- Publish releases without attached assets so HACS falls back to repository files; retain full ZIPs in CI artifacts.
- Verify that the tracked HACS bundle/notices exactly match a fresh build before publishing. No changes to card configuration or functionality.

## 0.3.1 — HACS support

- Add HACS custom Dashboard repository support with a single self-contained bundle containing all eleven cards and editors.
- Publish validated GitHub releases with the HACS asset, reproducible ZIP and dependency notices.
- Preserve manual installation and existing Ikio card configuration; document migration to HACS-managed resources.

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
