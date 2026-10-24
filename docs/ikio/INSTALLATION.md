# Installing Ikio Cards

All eleven cards share the Ikio colour tokens, typography, spacing, controls and interaction helpers. Each is independently registered and has a full visual editor. The shared collection version is 0.3.2; this is not yet a live-device-verified release.

## HACS

1. In HACS open ⋮ → Custom repositories.
2. Add `https://github.com/kpolyd/ha-ikio-cards`, type **Dashboard** (older versions may call it Lovelace or Plugin).
3. Search for **Ikio Cards**, download the latest release, and fully reload your frontend.
4. Edit dashboard → Add card → Ikio. Select entities/settings in the visual editor.

HACS installs a single `ha-ikio-cards.js` file from the selected repository tag through raw.githubusercontent.com containing all eleven cards and editors, and manages updates under one version. It normally registers `/hacsfiles/ha-ikio-cards/ha-ikio-cards.js?hacstag=...` as a JavaScript module. If no resource appears, add `/hacsfiles/ha-ikio-cards/ha-ikio-cards.js` manually. In YAML dashboard-resource mode, manage that resource through your existing setup. Do not add a second resource if HACS already created one.

The repository must be added as a custom repository; it is not in the default catalogue. If switching from manual Ikio installation, remove the old manual Ikio resource entry and fully reload. Existing Ikio card configurations do not change. For Aethora types, see MIGRATION.md.

## Manual builds

1. From the repository root use the pinned Node version, then `npm ci`, `npm run build` and `npm run package:ikio`.
2. Copy only `ikio.js` and the eleven `ikio-*-card/` folders from `release/ikio-v0.3.2/` to `/config/www/ikio/`. Keep `source/` and design documents outside `www`. Preserve all card folders and their `chunks/` subdirectories.
3. In Home Assistant Settings → Dashboards → Resources, add `/local/ikio/ikio.js?v=0.3.2` as a **JavaScript module**. Advanced Mode may be needed to expose resource management.
4. Edit the dashboard → Add card → search **Ikio**. Select a card, then choose entities and settings in its visual editor. No manual card YAML is needed.
5. Every card offers Ikio dark, Ikio light or Follow Home Assistant appearance. For a consistent collection, choose the same setting for all cards. The optional `themes/ikio.yaml` can also be installed through your existing HA theme-loading setup; it is not required by any card. The global theme is optional and is not installed by the HACS Dashboard package.

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

## Download errors in HACS 2.0.5

Version 0.3.1 used release assets, which can fail when GitHub redirects contain headers above the default aiohttp limit. Version 0.3.2 stores the same bundle in the repository and publishes releases without attached assets, so HACS uses raw tagged content. Refresh repository information in HACS and select 0.3.2 or newer. This avoids modifying HACS itself. If a download still fails, the detailed HACS log is needed to identify a different network/filesystem error.
