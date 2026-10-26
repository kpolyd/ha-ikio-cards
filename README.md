# Ikio Cards

<img src="https://raw.githubusercontent.com/kpolyd/ha-ikio-cards/main/assets/branding/ikio-logo.png" alt="Ikio: a house formed from four rounded dashboard tiles" width="160" height="160">

Compact, mobile-first Home Assistant cards with a consistent design and visual configuration editors.

Eleven independent cards share colours, typography, controls and one synchronized version. Use Ikio dark, Ikio light or your Home Assistant theme. Hold an entity control to open native Home Assistant details.

| Card | Purpose |
|---|---|
| [Lights](cards/ikio-lights-card/README.md) | Compact light/switch buttons with location labels |
| [Climate](cards/ikio-climate-card/README.md) | Room readings, climate, humidifier and fan |
| [Appliances](cards/ikio-appliances-card/README.md) | Power, energy and optional backend timed runs |
| [Media](cards/ikio-media-card/README.md) | Icon transport controls, source, volume and progress |
| [Vacuum](cards/ikio-vacuum-card/README.md) | State-aware vacuum actions and suction selection |
| [Alarmo](cards/ikio-alarmo-card/README.md) | Alarm, contacts, presence and optional Alarmo override |
| [Camera](cards/ikio-camera-card/README.md) | On-demand live view and optional snapshot controls |
| [Electricity](cards/ikio-electricity-card/README.md) | Current power, billing-cycle totals/costs and device breakdown |
| [Server Monitor](cards/ikio-server-monitor-card/README.md) | Host metrics, availability and service controls |
| [Vehicle](cards/ikio-vehicle-card/README.md) | Vehicle readings, locks/doors/windows and map link |
| [Graph](cards/ikio-graph-card/README.md) | History with value-based colours and expected min/max |

## Installation

For UI work, see the [Ikio design approach](docs/ikio/DESIGN_APPROACH.md) and [current design review](docs/ikio/DESIGN_REVIEW.md). Light, Energy, Drive and Security are the approved reference designs; the review proposes refinements for the other seven cards.

Current collection version: **0.6.2**. The source targets Home Assistant frontend 2026.10; live compatibility still requires verification. HACS custom-repository installation is supported; validated versions are published as GitHub releases.

### HACS (recommended)

1. Open HACS → ⋮ → Custom repositories.
2. Add `https://github.com/kpolyd/ha-ikio-cards` with type **Dashboard** (called Lovelace/Plugin in some HACS versions).
3. Find **Ikio Cards**, download the latest release, and reload your browser or Home Assistant app.
4. Edit dashboard → Add card → search **Ikio**, then choose entities in the visual editor.

HACS normally adds the JavaScript module resource automatically in storage mode. If it is missing, add `/hacsfiles/ha-ikio-cards/ha-ikio-cards.js` under Settings → Dashboards → Resources, type **JavaScript module**. Keep the HACS-generated `?hacstag=...` cache query when present.

All eleven cards and editors are included in one file, with one HACS version/update. Starting with 0.5.4, HACS downloads the bundle from raw tagged repository content to avoid GitHub’s release-redirect header issue; no HACS patch is needed. Remove old manual Ikio resource entries when switching to HACS, then fully reload so the current code registers. Version 0.6.0 renames card identifiers; update YAML types using the [migration table](docs/ikio/MIGRATION.md#060-card-identifiers). Aethora configurations need the one-time namespace migration below.

This is a HACS **custom repository**, not a default-catalog listing. The optional global theme is distributed separately in the source/ZIP; the cards include their own appearance settings.

### Manual installation

Download `ha-ikio-cards.js` from the tagged repository using the raw link in the latest GitHub release, copy it to `/config/www/ikio/`, and add `/local/ikio/ha-ikio-cards.js?v=0.6.2` as a JavaScript module. Alternatively the reproducible ZIP includes individual card builds and the original loader. Use only one resource installation route.

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

Run a focused workspace command with, for example, `npm test --workspace @ikio/electricity-card`. Format changed workspaces with `npm run format --workspace @ikio/card-ui`. Shared packages are bundled locally, with no separate HA resources or runtime CDN dependencies.

Serve the repository root after building and open `dev/previews/collection.html` for the simulated interactive gallery. It never operates real devices. Editable design SVGs are in `docs/ikio/design/`.

The collection version is stored in `ikio/package.json`. After changing it, run `node scripts/ikio-version.mjs`, update the changelog and installation URLs, then validate. All cards and internal packages share that version.

## Distribution and licensing

`npm run build` builds the individual cards and the single-file HACS bundle at `dist/ha-ikio-cards.js`. `npm run package:ikio` creates a reproducible installation folder and ZIP under `release/`. Run `npm run prepare:hacs` to update the tracked root bundle/notices, then commit them. CI rebuilds and checks that those files match source. After validation on `main`, CI publishes the current version as `ikio-vX.Y.Z` without attached assets, so HACS downloads the bundle from the selected tag through `raw.githubusercontent.com`. The ZIP remains available as the `ikio-cards` artifact of the successful CI run; theme and notices are also in the tagged source. Published releases/tags are never overwritten; increase the collection version to ship changes. Failed publication can be retried by rerunning CI on the same source commit.

Ikio was previously developed as Aethora. Version 0.3.0 introduces the Ikio namespace and retains the implemented features and fixes from 0.2.3. The 3D model card, household configuration and private repository history are excluded.

An original-source license has not yet been selected. Dependency notices are included in generated distributions and apply to their respective dependencies.

<!-- IKIO_PREVIEWS_START -->
## Card previews · 0.6.2

Actual compiled cards with simulated Home Assistant data. Click an image to open the interactive gallery.

### Lights

[![Lights](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/lights/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#lights)

### Electricity

[![Electricity](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/electricity/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#electricity)

### Vehicle

[![Vehicle](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/vehicle/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#vehicle)

### Alarmo

[![Alarmo](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/alarmo/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#alarmo)

### Server Monitor

[![Server Monitor](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/server-monitor/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#server-monitor)

### Climate

[![Climate](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/climate/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#climate)

### Media

[![Media](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/media/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#media)

### Camera

[![Camera](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/camera/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#camera)

### Vacuum

[![Vacuum](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/vacuum/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#vacuum)

### Appliances

[![Appliances](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/appliances/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#appliances)

### Graph

[![Graph](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/screenshots/graph/dark-360-normal.png)](https://kpolyd.github.io/ha-ikio-cards/previews/0.6.2/index.html#graph)
<!-- IKIO_PREVIEWS_END -->
