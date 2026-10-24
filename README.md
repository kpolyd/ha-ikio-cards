# Ikio Cards

Compact, mobile-first Home Assistant cards with a consistent design and visual configuration editors.

Eleven independent cards share colours, typography, controls and one synchronized version. Use Ikio dark, Ikio light or your Home Assistant theme. Hold an entity control to open native Home Assistant details.

| Card | Purpose |
|---|---|
| [Lights](cards/ikio-light-card/README.md) | Compact light/switch buttons with location labels |
| [Comfort](cards/ikio-comfort-card/README.md) | Room readings, climate, humidifier and fan |
| [Appliance](cards/ikio-appliance-card/README.md) | Power, energy and optional backend timed runs |
| [Media](cards/ikio-media-card/README.md) | Icon transport controls, source, volume and progress |
| [Cleaning](cards/ikio-cleaning-card/README.md) | State-aware vacuum actions and suction selection |
| [Security](cards/ikio-security-card/README.md) | Alarm, contacts, presence and optional Alarmo override |
| [Camera](cards/ikio-camera-card/README.md) | On-demand live view and optional snapshot controls |
| [Energy](cards/ikio-energy-card/README.md) | Current power, billing-cycle totals/costs and device breakdown |
| [System](cards/ikio-system-card/README.md) | Host metrics, availability and service controls |
| [Drive](cards/ikio-drive-card/README.md) | Vehicle readings, locks/doors/windows and map link |
| [Graph](cards/ikio-graph-card/README.md) | History with value-based colours and expected min/max |

## Installation

Current collection version: **0.3.0**. The source targets Home Assistant frontend 2026.10; live compatibility still requires verification. HACS and automatic release publishing are not configured yet.

Build with Node 24, npm and Python 3:

```sh
npm ci
npm run build
npm run package:ikio
```

Copy `ikio.js` and all eleven `ikio-*-card/` folders from `release/ikio-v0.3.0/` into your Home Assistant `/config/www/ikio/` directory. Preserve the card folders and their `chunks/` subdirectories. Do not copy `source/` or design documents into `www`.

Add `/local/ikio/ikio.js?v=0.3.0` as a **JavaScript module** under Settings → Dashboards → Resources. Reload the dashboard, then Add card → search **Ikio** and select entities in the visual editor. No manual card configuration is required.

See the [installation guide](docs/ikio/INSTALLATION.md), [Aethora migration guide](docs/ikio/MIGRATION.md), [design specification](docs/ikio/SPECIFICATION.md) and [validation status](docs/ikio/STATUS.md).

## Development

The pinned Node major is in `.node-version`. The repository uses npm workspaces and one root lockfile:

```sh
npm ci
npm test
npm run test:scripts
npm run format:check
npm run check:ikio-version
npm run build
npm run package:ikio
```

Run a focused workspace command with, for example, `npm test --workspace @ikio/energy-card`. Format changed workspaces with `npm run format --workspace @ikio/card-ui`. Shared packages are bundled locally, with no separate HA resources or runtime CDN dependencies.

Serve the repository root after building and open `dev/previews/collection.html` for the simulated interactive gallery. It never operates real devices. Editable design SVGs are in `docs/ikio/design/`.

The collection version is stored in `ikio/package.json`. After changing it, run `node scripts/ikio-version.mjs`, update the changelog and installation URLs, then validate. All cards and internal packages share that version.

## Distribution and licensing

`npm run package:ikio` creates a reproducible installation folder and ZIP under `release/`. CI validates changes and uploads the ZIP as a build artifact; it does not publish a GitHub release or register the project in HACS.

Ikio was previously developed as Aethora. Version 0.3.0 introduces the Ikio namespace and retains the implemented features and fixes from 0.2.3. The 3D model card, household configuration and private repository history are excluded.

An original-source license has not yet been selected. Dependency notices are included in generated distributions and apply to their respective dependencies.
