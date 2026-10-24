# Ikio development installation

All eleven cards share the Ikio colour tokens, typography, spacing, controls and interaction helpers. Each is independently registered and has a full visual editor. The shared collection version is 0.3.0; this is not yet a live-device-verified release.

1. From the repository root use the pinned Node version, then `npm ci`, `npm run build` and `npm run package:ikio`.
2. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from `release/ikio-v0.3.0/` to `/config/www/ikio/`. Keep `source/` and design documents outside `www`. Preserve all card folders and their `chunks/` subdirectories.
3. In Home Assistant Settings → Dashboards → Resources, add `/local/ikio/ikio.js?v=0.3.0` as a **JavaScript module**. Advanced Mode may be needed to expose resource management.
4. Edit the dashboard → Add card → search **Ikio**. Select a card, then choose entities and settings in its visual editor. No manual card YAML is needed.
5. Every card offers Ikio dark, Ikio light or Follow Home Assistant appearance. For a consistent collection, choose the same setting for all cards. The optional `themes/ikio.yaml` can also be installed through your existing HA theme-loading setup; it is not required by any card. HACS distribution is not configured.

| Card | Entity type / purpose |
|---|---|
| Lights | Light and switch controls, location labels and native details on hold |
| Comfort | Room sensors, climate, humidifier, fan |
| Appliance | Switch, power and existing backend timed-run scripts |
| Media | Media player, icon controls and volume |
| Cleaning | Vacuum, status-aware controls and actual suction options |
| Security | Alarm panel, presence, contacts and optional Alarmo override |
| Camera | On-demand native HA live view, optional power/snapshot bindings |
| Energy | Current power, billing-cycle usage and costs, graph and circuits |
| System | Explicitly selected host metrics and service controls |
| Drive | Fuel/range/odometer, aggregate locks/doors/windows and Google Maps |
| Graph | Numeric history with expected minimum/maximum colour range |

Entity bindings are explicit and reusable; no card knows household IDs. For unavailable entities the cards preserve valid independent readings. A hold opens native HA entity details wherever an entity is bound. Calculated untracked power opens its explanation instead of inventing an entity.

## Optional backend dependencies

Timed appliance runs require an existing script that schedules the full shutoff and optionally a timer for countdown display. Snapshot capture likewise binds an existing script. No browser countdown is responsible for safety or backend scheduling. Alarmo override appears only when its arm service is advertised and requires a deliberate confirmation; arming codes remain transient.

Graph history uses the authenticated HA recorder WebSocket interface. It reports missing/unavailable history while retaining live readings. Camera live view uses native HA picture-entity support and stops when closed, hidden or disconnected. Car coordinates only open Google Maps after a click; there is no embedded third-party map.

## Validation boundaries

Automated tests cover card/editor contracts, state transitions, action payloads, number/unit handling, colour math, history gaps and cleanup. The fixture gallery at `dev/previews/collection.html` uses simulated entities/actions and can be served from the repository root after building. It does not establish real HA integration, native icon rendering or hardware behaviour. Validate the native editor, actual device capabilities, browser touch/accessibility and real service outcomes on a test dashboard before wider use.


## Upgrading from Aethora

The Ikio namespace requires a one-time change to existing card types and the resource URL. See [MIGRATION.md](MIGRATION.md).
