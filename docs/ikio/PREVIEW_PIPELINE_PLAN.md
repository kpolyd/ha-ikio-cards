# Implementation plan: automated card previews

Status: proposed implementation handoff, 26 October 2026. This document is a plan only. It does not implement, deploy or release the pipeline.

Repository: https://github.com/kpolyd/ha-ikio-cards
Baseline: ikio-v0.6.0, main commit ae5bfea306a0af049243b4165328fb89d258ae1f. Start from current main and inspect changes made since this baseline.

## 1. Agreed outcome

Use the actual compiled Ikio cards with deterministic simulated Home Assistant data to generate an interactive HTML gallery and PNG screenshots. Generate previews on every PR update and on main changes. Publish immutable versioned previews for releases. Each tagged README must display screenshots from its own version, never a moving latest URL.

PR previews must be usable without deploying or releasing: downloadable CI artifacts containing a self-contained HTML gallery, screenshots and before/after comparisons. Hosted PR previews are optional future work, not required for the first implementation.

All eleven cards: Lights, Electricity, Vehicle, Alarmo, Server Monitor, Climate, Media, Camera, Vacuum, Appliances and Graph. IDs are custom:ikio-{lights,electricity,vehicle,alarmo,server-monitor,climate,media,camera,vacuum,appliances,graph}-card.

Preserve approved card layouts and behavior. Do not redesign cards while implementing the preview infrastructure. No real entities, credentials, service calls, household images or external media streams.

## 2. Existing code to extend

Read AGENTS.md, applicable card AGENTS.md files and docs/ikio/SPECIFICATION.md before work.

- .github/workflows/ci.yml: check runs tests, builds, verifies the HACS bundle and packages ZIP artifacts. A main-only release job currently depends on check and invokes publishRelease.
- scripts/publish-release.mjs: determines version from ikio/package.json, skips already published versions, validates bundle and tag identity, creates/resumes a draft and publishes it. Changelog headings must start with the version followed by a space. Preserve its identity and retry protections.
- scripts/build-hacs.mjs: produces dist/ha-ikio-cards.js with all eleven cards and editors, without external imports. The tracked root bundle must match it.
- dev/previews/collection.html: existing eleven-card gallery with simulated states.
- dev/previews/redesign.js and redesign.html, scripts/build-redesign-preview.mjs: existing seven-card standalone preview and mock interactions. Reuse useful fixtures, icons and local license notices, but converge on one canonical eleven-card harness.
- scripts/ikio-version.mjs and scripts/package-ikio.mjs: synchronized versions and packaging. Source packaging uses tracked files; stage new sources before testing packaging.
- packages/ikio-card-ui/tests/card-names.test.js: checks all card/editor names and stub rendering. Existing DOM tests do not establish browser layout correctness.

HACS releases MUST have zero attached assets. Store preview downloads as Actions artifacts, and permanent previews on GitHub Pages. Keep generated output out of the main source tree.

## 3. Proposed files and commands

Create or consolidate:

| File | Responsibility |
| --- | --- |
| dev/previews/gallery.html | Gallery shell, version/commit display, card, theme, width and scenario controls |
| dev/previews/gallery.js | Load the actual bundle, mount cards, expose readiness and deterministic controls |
| dev/previews/mock-hass.js | Simulated hass states, registries, history, Alarmo messages and service responses |
| dev/previews/fixtures/*.js | One repeatable fixture definition per card, with normal and relevant exceptional states |
| dev/previews/assets/ | Local simulated images/icons and licenses |
| scripts/build-previews.mjs | Produce a self-contained HTML gallery from the exact built HACS bundle and fixture assets |
| scripts/generate-previews.mjs | Start a loopback server, run pinned Chromium, verify readiness, capture PNGs and manifest |
| scripts/compare-previews.mjs | Match head/base captures and produce before/after/difference images and a report |
| scripts/update-readme-previews.mjs | Generate/check only a marked README section using the authoritative version |
| scripts/publish-previews.mjs | Validate and publish an immutable version directory, preserving all previous versions |
| scripts/tests/* | Tests for manifests, comparison matching, README links and publication/retry rules |
| docs/ikio/PREVIEWS.md | Local commands, fixture authoring, CI artifacts and release troubleshooting |

Expose npm commands such as preview:build, preview:generate, preview:compare, preview:readme and preview:check. Commands should accept explicit output paths; comparison must accept separate source roots/bundles without modifying the primary checkout.

Use exact locked development dependencies for Playwright/Chromium tooling and PNG comparison. Keep runtime card bundles free of these dependencies. Support local and CI execution through the same scripts.

## 4. Rendering contract

The gallery must execute dist/ha-ikio-cards.js, not recreate card markup or independently bundle a divergent card implementation. Record its SHA-256 in the manifest. Build the harness separately and embed the exact card bundle into the downloadable HTML. Verify opening the artifact from file:// works, including editor lazy imports where supported; use local HTTP for automated captures.

The fake hass object should implement the capabilities the real cards use: states, locale/timezone, entity/device/area registries, history requests, Alarmo sensor responses, service responses and native-details events. Unknown API requests should fail visibly rather than silently returning invented success. Keep actions local to the mock state. Do not enable a generic card preview mode that suppresses history fetching or intended content.

Provide local HA component substitutes for icons and necessary controls, matching relevant dimensions and styling. Use real local icon paths with licenses. Native dialogs and the surrounding HA frontend are simulated: clearly label this limitation in the gallery and docs. A full HA integration test environment is a separate follow-up, not a prerequisite for these screenshots.

Freeze wall-clock time, locale, timezone, randomness, history windows and fixtures. Pin fonts locally with appropriate licenses. Reset state between captures. Disable screenshot-time transitions, blinking and animation; preserve interaction in the gallery. Wait for explicit fixture readiness, custom-element definition, mocked request completion, fonts and images, and stable layout. Do not rely on an arbitrary sleep or network-idle alone.

Capture the card itself, excluding gallery controls, at CSS widths 360px and 640px, device scale factor 1, in Ikio dark and light themes. Let card height follow its actual content. Use dark/360px/normal as each README image. Include browser version and dimensions in provenance.

Required scenarios:

- Every card: populated normal view and relevant unavailable/missing-data view.
- Electricity: known nonzero distribution with labelled rings, zero consumption and history gaps. Stable billing-period label.
- Server Monitor: zero/unknown alternation reproducing the fixed history bug, plus varying traffic.
- Alarmo: disarmed, open sensors, armed and frozen arming countdown.
- Lights: mixed states, grouping and unavailable entities.
- Vehicle: local image, mixed door/lock status and missing image.
- Vacuum: docked, cleaning, paused and unavailable states.
- Remaining cards: representative active/idle or selected states; all assets and streams simulated locally.

Smoke-test at least one meaningful interaction per card; validate expected local state changes. Native details may be represented by a labelled simulated panel. Detect uncaught errors, unexpected requests, missing custom elements, failed images, blank captures and horizontal overflow. Return nonzero on functional/render failures. Pixel changes alone are review evidence, not automatic failure.

## 5. Output and provenance

Produce dist/previews/ containing index.html, manifest.json, screenshots/<card>/<theme>-<width>-<scenario>.png and optional comparison/.

Manifest: schema version, collection version, actual checked-out source SHA, PR head/base identities where applicable, HACS bundle hash, fixture/harness hashes, browser/tool versions, fixed clock/timezone/locale, capture dimensions, scenario inventory and artifact hashes. Never label a checkout with a different requested SHA.

Artifact names should include the commit SHA. Retain PR artifacts for a documented finite period, e.g. 30 days. Versioned published previews are permanent. Include licenses and enough provenance to reproduce a capture.

## 6. PR and main workflow

Keep a stable required preview check. Run on PR opened/synchronize/reopened, pushes to main and explicit manual dispatch. A changes-detection job can skip rendering for unrelated docs, but the stable check must still complete successfully rather than remain pending. Treat card/shared code, fixtures, bundle, lockfile, build scripts, workflows, version files and README preview links as relevant. A release candidate always requires full rendering.

PR runs use read-only permissions and no secrets; never execute PR code through pull_request_target with write privileges. Normal PR checks can render the proposed merge checkout; record its actual SHA separately from head SHA. Compare against the pinned target-branch base SHA from that event. Main captures must use the exact merged main SHA.

Build base and candidate in isolated directories with their own lockfiles, using the same pinned renderer environment. Prefer the candidate fixture/harness against both bundles when compatible to isolate visual changes. Report fixture changes and incompatible schemas explicitly. Newly added cards have no baseline; removed cards are labelled removed. On initial adoption, build the base bundle and use the new harness where possible. Baseline failures must be visible in the report; they must not be silently reported as no difference. Candidate render failures always fail the check.

Report before/after/difference images for matching scenarios, including changed dimensions. Use documented antialias tolerance, not broad masking. PR output is a downloadable gallery and report linked from the Actions job summary. Do not post automatic PR comments unless separately authorized. Do not update README links or publish Pages from PR runs.

Main also generates artifacts for the exact merged commit. Never reuse a PR artifact just because its version matches: different SHAs require regeneration. Reuse within a workflow only after verifying SHA, bundle hash, fixture/harness hashes and capture configuration.

## 7. README and release sequence

Add a marked generated README section showing all eleven cards. Each PNG links to its version's gallery, optionally with a card selection fragment/query. Example:

https://kpolyd.github.io/ha-ikio-cards/previews/0.6.1/screenshots/electricity/dark-360-normal.png

Confirm the repository Pages base URL during setup. Do not assume hosting is already enabled.

Extend version preparation to update README links from ikio/package.json BEFORE the release source commit is created. CI checks the generated block is current and never edits main automatically. Check relative filenames locally before publication, not remote URLs that cannot exist yet. A tagged README then points permanently to its own version. Do not modify old published tags or backfill misleading screenshots for previous versions.

Release ordering:

1. Check version/README/changelog consistency; run all existing checks and capture exact-main previews.
2. Determine whether this version is already published. If so, skip version publication and leave existing previews untouched; ordinary main builds still retain their commit artifacts.
3. Validate complete preview manifest and all expected files against release SHA and built bundle.
4. Publish the version directory to Pages and wait for successful deployment. Verify manifest and representative image/gallery URLs, accounting for bounded propagation delays.
5. Only then create/publish the GitHub release using the existing script protections. Include the versioned gallery link in release notes. Preserve zero release assets.

Wire release dependencies so missing/failed preview publication blocks release. Avoid adding links in a commit after rendering: any changed release commit must be re-rendered.

## 8. Permanent hosting, concurrency and recovery

Recommended storage: a dedicated gh-pages branch containing only generated public previews and .nojekyll. Build and deploy a Pages artifact from the complete retained site tree so a new deployment does not delete old versions. Enable Pages through GitHub Actions if required. Separate publication/deployment permissions from all build/PR jobs. Never run untrusted generated code inside the publisher job; validate/copy files as data.

Serialize the complete publish-and-release sequence with cancel-in-progress false. The publisher reads the latest site state under that lock and preserves existing directories. Use least privileges for site-branch writes and Pages deployment; credentials never reach card/harness execution.

If a version directory exists, accept a retry only for identical source identity and artifact hashes. Refuse overwrites for different source/content. If Pages succeeds but GitHub release publication fails, retry from the same SHA. If that source must change, use a new version rather than overwrite the published directory. Existing release/tag identity checks remain authoritative. Keep the process idempotent and log which stage completed.

## 9. Implementation order

1. Consolidate fixtures/harness and produce an offline-capable gallery for all eleven actual built cards.
2. Add deterministic browser captures, readiness/error checks and manifest validation; inspect every card screenshot manually once at normal zoom.
3. Add base/head visual comparisons and artifact reports; test a deliberate style change.
4. Integrate PR/main jobs and prove behavior on an actual PR, including fork-safe permissions and documentation-only skip behavior.
5. Add versioned README generation and consistency checks.
6. Add immutable Pages publication and release gating with tested retry paths.
7. Update contributor/release documentation and demonstrate the complete flow on a new version only when release is authorized.

## 10. Acceptance criteria / handoff evidence

- All eleven real compiled cards render; dark/light and both widths produce valid captures with no unexpected browser errors or missing assets.
- Repeated runs of identical inputs in the pinned environment produce identical screenshots, or any narrowly justified nondeterminism is identified and removed/masked explicitly.
- The standalone artifact opens offline and supports documented simulated interactions.
- A deliberately introduced overflow/error fails the render check. A deliberate style change produces an understandable comparison without failing solely for different pixels.
- Sparse zero/unknown network history renders valid intervals and leaves actual gaps visible.
- PR updates regenerate artifacts without releasing, deploying Pages or changing source README. Report handles additions, removals and baseline incompatibility.
- Main generates its own exact-SHA artifacts. Publication rejects stale/missing/manipulated manifests and mismatched bundles.
- Tagged README contains exact-version URLs for every card and all published URLs resolve.
- A second version preserves the first version's files and links byte-for-byte.
- Publication retries are idempotent; different content cannot overwrite an existing version. Preview failure prevents the release becoming public.
- HACS release assets remain empty; existing build, unit, script, format, version, bundle and packaging checks still pass.
- Document browser simulation versus live HA verification honestly. Do not claim native HA integration has been tested by this harness.

The implementing agent should return the PR, commands/results, gallery artifact, representative comparisons, publication/setup status and any remaining blockers. This handoff authorizes planning only; the user will direct the other agent's implementation and release separately.
