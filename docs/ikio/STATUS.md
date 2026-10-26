# Ikio implementation status

Repository: `kpolyd/ha-ikio-cards`. Collection version: **0.4.0**, synchronized across eleven card workspaces and two internal packages.

## Implemented

All eleven cards are registered, separately buildable and available in the visual card picker. Each has an entity-based native-style editor, immutable configuration round-trips and dark/light/follow-HA appearance.

- **Lights:** compact buttons, area/location labels, switch support and native details on hold.
- **Graph:** numeric history, fixed normalized user palette, continuous value gradient, min/max colour configuration, multi-series legend and distinct line patterns, gaps and outlier handling.
- **Energy:** current power, cycle Day/Night/Total and costs above the graph; identically styled clickable device grid below; separate Untracked row and explanation for calculated readings. Forecast validity/age gates are optional.
- **Comfort:** independent room readings, climate/dehumidifier/fan selection, supported setpoints/modes and range targets, optional power.
- **Appliance:** switch, power/energy, existing backend timed-run script bindings and optional backend timer display.
- **Media:** supported icon controls, volume/mute, source, artwork and playback progress/seek.
- **Cleaning:** state-aware start/pause/resume/stop, relevant dock action, selected suction value, optional maintenance/mission scripts.
- **Security:** alarm state, presence/contacts/motion, supported modes, explicit Alarmo force-arm review with transient required code, visible bypass count. Code-required normal disarm uses native details.
- **Camera:** explicit on-demand native HA live view, close/visibility/disconnect cleanup, separately configured camera power, snapshot automation and script.
- **Drive:** fuel/range/odometer, three aggregate lock/door/window indicators, unknown-data handling and Google Maps link with location age.
- **System:** selected availability/host metrics, compatible-unit utilization, explicit thresholds, service health/power/restart bindings.

Common `@ikio/card-ui` supplies tokens, touch-sized controls, hold behaviour, keyed DOM reconciliation, action confirmation/errors and visual editor sections. `@ikio/graph` is shared by Energy and Graph. Shared code is bundled locally, with no separate HA resource installation or runtime CDN. Optional matching global HA theme YAML is included.

## Verification

- Card, editor, adapter, graph/history and interaction tests pass; collection packaging is checked separately.
- Root formatting checks, builds, synchronized-version check and collection packaging pass.
- Real Chromium fixture gallery checked at 280, 360, 390 and 520 px: eleven cards rendered, no horizontal page overflow and no JavaScript page errors. Dark/light screenshots inspected.
- Browser interactions verified: light heading, vacuum start/pause/resume transitions, media source selector and energy native sensor-details dispatch. Fixture icons substitute for HA's native icon component.
- Preview fixtures are simulated; no actual household device was operated.

## Remaining deployment verification

Energy distribution rings (0.5.12) have 24 passing Energy DOM/behaviour tests covering opt-in configuration, area grouping, conservation, invalid readings, aggregation, live selection, holds, keyboard access, resize cleanup and long-label wrapping. Browser geometry and native Home Assistant verification for this new graph remain outstanding; the earlier Chromium gallery checks do not cover this addition.

Cron billing cycles join the same release, bringing the Energy test suite to 34 passing tests. Numeric schedule evaluation, inclusive date labels, timezone/DST rules, short months/leap years, idle label rollover without changing sensor readings or forecast gates, lifecycle cleanup and legacy configuration round-trips have automated coverage. This does not add live Home Assistant verification.

Live Home Assistant verification is still required. Validate native HA form loading, real selectors/icons, camera streaming, recorder history permissions, actual device capabilities/actions, Alarmo code behaviour and assistive technology in the deployed HA frontend. Automated DOM tests simulate HA form components; browser fixtures simulate HA data and backend calls. Neither proves live integration compatibility.

HACS custom-repository support uses the tracked root bundle, `ha-ikio-cards.js`, downloaded from raw tagged source. CI validates main and publishes the collection version as a GitHub release. HACS default-catalog inclusion is not configured; it is a separate process.


### 0.2.2 design refinement

Lights no longer show brightness bars or percentages. The secondary label resolves entity area before device area, with an optional visual-editor override. State remains available through colour, accessible labels and native details. Home Energy combines its title/current power into one compact header and tightens totals. Its graph now shows observed window minimum/maximum on the vertical axis rather than the footer row; the expected range still controls only colours.


### Collection-wide compact layout

Default spacing is now 10 px outer padding / 4 px section gaps, with inline ranges and grouped action rows. All configured readings remain visible. Media, camera, appliance and car footers use fewer stacked rows. The car map action is an unboxed text link labelled Open location in maps. Touch buttons and sliders remain at least 44 px.


#### 0.2.2 browser density check

Same simulated data at 360 px card width; all cards retain their readings/actions.

| Card | Before (px) | Compact (px) |
|---|---:|---:|
| Light | 125 | 90 |
| Comfort | 401 | 288 |
| Appliance | 286 | 198 |
| Media | 426 | 280 |
| Cleaning | 130 | 114 |
| Security | 272 | 232 |
| Camera | 424 | 252 |
| Energy | 520 | 460 |
| System | 420 | 330 |
| Drive | 398 | 256 |
| Graph | 328 | 268 |

112 JavaScript tests and four Python release-tool tests passed. Browser checks passed at 280/360/390/520 px with no horizontal overflow or page errors. Native-details hold, vacuum transitions, media source and energy entity links were checked again. Visible card buttons, ranges, selectors and entity hold targets were measured at least 44 px high at 280 px; the plain car navigation link intentionally follows inline text-link sizing.


### Lock indicator correction (0.2.2)

A confirmed mapping defect treated on/off binary lock sensors as unknown with the old unlocked default. Automatic lock interpretation now supports native locked/unlocked states and binary off/on, including existing configs. Explicit inversion remains available. Actual HA unavailable states remain unavailable. Regression tests cover mixed members, unknown data, transitions and unchanged door/window outputs. A genuinely unavailable source needs integration-side diagnosis.

Lock-fix validation: 115 JavaScript tests and four Python release-tool tests passed, plus builds/format/version checks. Chromium verified off/on/unavailable/unknown lock results while doors remained Closed and windows Open. These are simulated backend states, not a live connection to the car.


### Editor typing correction (0.2.3)

All eleven editors now retain their form elements when Home Assistant echoes an unchanged configuration after an edit. Previously that feedback rebuilt the entire form, dropping focus during typing. Actual external configuration changes and list add/remove/reorder operations still rebuild the editor. Regression tests reproduce the parent feedback cycle for every card, including Energy device names and Light names, and check focus, complete text, preserved configuration and external updates. Native HA selectors still require live verification.

Mobile Chromium checked continuous typing and insertion at the current cursor in the bundled Energy editor while a simulated parent synchronously echoed every config change. No page errors occurred. This browser check used a test form substitute, not native HA selectors.

Validation: 126 JavaScript tests and four legacy release-tool tests passed in the original repository, plus formatting, synchronized-version checks and production builds.


### Public repository migration (0.3.0)

Renamed the full collection to Ikio, including packages, elements, bundles, theme and documentation URLs. Imported only collection sources into a fresh repository; no original Git history, 3D card, geometry, household mappings or legacy release pipeline is included. The lockfile no longer includes Three.js. Earlier verification counts describe the original repository; migration-specific results are recorded after running checks here.

Migration verification: 74 card/shared-package tests and two independent packaging tests passed in the new repository. Formatting, synchronized versions, clean dependency installation and all eleven production builds passed. Chromium verified the renamed gallery at 280/360/390/520 px with no overflow/page errors, dark/light layouts, native-details touch hold, media source, vacuum transitions, energy links and editor typing with simulated parent feedback. These fixtures do not prove native HA selector or live-device compatibility.


### HACS distribution (0.3.1)

Added a root hacs.json manifest, a self-contained bundle of all eleven cards/editors, and a CI release job that publishes only after validation. The installer needs one JavaScript file with no local chunks, external imports or runtime CDN. Published releases are immutable; draft uploads can be retried on the same source. Existing manual installation remains supported. HACS installs/updates the collection as one custom Dashboard repository. Live HACS installation on a user instance is not tested by the automated pipeline.

HACS-build verification: 74 workspace tests plus eight packaging/release tests passed. Browser checks loaded only the single HACS bundle while individual entry requests were stubbed out: all eleven cards rendered without overflow/page errors at 280/360/390/520 px; touch holds, media/vacuum/energy actions and editor typing passed with simulated HA data/forms. Native HACS installation on the user’s server remains unverified.


### Raw HACS downloads (0.3.2)

The 0.3.1 download URL reproduces the HACS/aiohttp header-limit error; increasing max_field_size allows the exact published SHA-256 bundle to download. The repository-side workaround stores the verified bundle at the repository root, sets content_in_root=true, and publishes tags/releases with no attached assets. HACS 2.0.5 then selects raw tagged content. Full ZIPs remain available in CI artifacts. CI checks tracked bundle/notices against a fresh build and the release publisher rejects drafts with assets.

Validation for 0.3.2: 74 workspace tests and ten package/release tests passed. Builds, formatting, version checks and tracked-bundle/notices comparisons passed. Unmodified HACS 2.0.5 filename selection, file gathering and download queue methods were exercised with a repository/release fixture: asset-free releases select raw tagged content; attached assets select release redirects. Chromium loaded all eleven cards and editors from the root bundle without page errors. Live installation still requires verification on the user’s HA instance.


### 0.4.0 — Location groups

Lights grouping is opt-in through a native boolean editor selector. Consecutive areas share a row when their combined light count is at most three; larger areas wrap independently. Area headings, dividers, stable ordering, live counts, Unassigned fallback and unavailable statuses follow the approved compact design. Buttons have a 44 px minimum height. Included in collection version 0.4.0.

Branch verification: 81 workspace tests plus ten packaging/release tests passed. Builds, formatting, synchronized-version checks and tracked HACS bundle verification passed. Chromium verified packed layouts and 44 px controls at 280/360/390/520 px without clipping or page errors, plus tap/count updates, native touch hold, grouping toggle, light appearance and long labels. These are simulated HA states/forms, not live device or native editor validation.


### 0.4.0 — Energy redesign

Implemented the approved three-column summary, whole-watt power formatting, subtle dashed min/mid/max guides and ordinary-grid Untracked reading. Calculations/history preserve precision, bound sensors retain native details, and computed Untracked is read-only. Tests cover mixed power/energy units, rounding, missing inputs, optional columns, forecast guards and guide positions. The same simulated mobile fixture measures 369 px high at 360 px width. Included in collection version 0.4.0.

Energy-change validation: 88 workspace tests and ten package/release tests passed, together with formatting, build, version and tracked-bundle checks. Chromium verified widths 280/360/390/520 px with no overflow or page errors, three-column layout, whole-watt labels, dashed guides aligned within 1 px, plain calculated Untracked, sensor details links, kW conversion and light appearance. Browser states/forms were simulated; native HA/device validation was not performed.


### 0.4.0 — Compact Drive card

Implemented the approved two-row layout, six labelled icons, state-based colours, header parking and footer age/maps link. Kept existing lock mappings, missing-data handling, native details and validated coordinates. No car commands are sent. Regression tests cover secure/alert/jammed/transitional/unknown tones, stable focused controls, the relevant aggregate member, fuel-capacity percentage and disabled maps. Validation: 94 workspace tests plus ten package/release tests passed, with formatting/build/version/HACS-bundle checks. Chromium verified 280/360/390/520 px layouts without clipping/page errors, 44 px targets, native tap/touch-hold dispatch, status tones, long values and light appearance. At 360 px, the fixture is 192 px high. Fixture icons are placeholders; real HA icon rendering and live vehicle integration still need deployment verification. Included in collection version 0.4.0.
