# Ikio Lights

Install the full collection through the [HACS custom repository instructions](../../docs/ikio/INSTALLATION.md#hacs). All cards and editors share one HACS download and version.

Part of the Ikio collection, version 0.5.4 (in development).

Build from the root with `npm ci && npm run build`. For the collection installation layout run `npm run package:ikio`. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from `release/ikio-v0.5.4` to `/config/www/ikio`. Add `/local/ikio/ikio.js?v=0.5.4` under **Settings → Dashboards → Resources**, JavaScript module. Preserve the lazy `chunks/` directory. Alternatively install just this card's entire `dist` and add its `ikio-light-card.js` resource. Do not install both routes.

**Add card → Ikio Lights** opens the visual editor. Add/reorder light and switch entities, change names/icons, set an optional location override, and choose dark/light/follow-HA appearance. All implemented options are available visually. No entities are guessed or hardcoded. The card safely starts empty. HA 2026.10 frontend is the target; actual native-editor/browser validation remains outstanding.

Tap a light to toggle. The secondary line shows the assigned Home Assistant area, with an optional location override in the visual editor. Hold opens native HA entity details; keyboard users have a focusable Details button. Brightness/warmth/colour are adjusted in native details. No brightness slider is shown on the card; legacy control-mode settings remain accepted. Off/unknown/unavailable are distinguished; real HA state confirms actions. A pending action never fabricates a physical state. The editor preview cannot send service calls.

No runtime JavaScript dependencies beyond Home Assistant and locally bundled Ikio helpers. esbuild is the build tool (MIT); see its license in the source dependency distribution. Generated output is ignored. Full touch, theme, screen-reader and live device validation must be performed before release.

## Group by location (unreleased)

Enable **Group by location** in the visual editor to show compact area headings with the light buttons below. It is off by default. Location overrides take precedence over the entity/device area; missing areas use **Unassigned**. Groups follow the first appearance in the configured list, and lights keep their configured order within each group.

Rows have up to three light columns. Consecutive areas share a row if their combined light count fits: two plus one, or up to three single-light areas. Areas with more than three lights use their own section and wrap internally. Horizontal/vertical dividers distinguish categories. Singleton headings omit the redundant count; larger groups show their on/total count. Unavailable lights remain visible and disabled. Grouped badges omit repeated location labels.

Buttons use 44 px minimum touch height and tighter spacing. Tap toggles and hold opens native entity details. Area registry updates regroup existing controls; normal state changes update counts without rebuilding buttons. At very narrow widths, groups stack and use a two-column layout to retain usable controls.
