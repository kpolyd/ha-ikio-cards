# Ikio Cards — contributor guide

This guide applies to the whole repository. Read the applicable `cards/<card>/AGENTS.md` before changing a card. Preserve behaviour and appearance during refactors; keep redesigns separate. Do not operate real devices as incidental smoke tests.

## Structure

- Seventeen cards live in separate `cards/ikio-*-card` npm workspaces.
- `packages/ikio-card-ui` and `packages/ikio-graph` provide shared code. Keep domain-specific capabilities in card adapters.
- The root lockfile is shared. Never introduce workspace lockfiles or runtime CDN imports.
- Edit source, then rebuild; generated `dist/` and `release/` output is ignored. The root `ha-ikio-cards.js` and `licenses/` are intentionally tracked for HACS raw-file delivery. Update them with `npm run prepare:hacs` and verify with `npm run check:hacs`; do not edit the minified bundle by hand.
- Do not add household bindings, coordinates, camera images, credentials. Tests and previews use clearly simulated entities.
- `docs/ikio/SPECIFICATION.md` records decisions, with later sections overriding earlier ones. Keep all configuration available through visual editors; hold always opens native entity details.
- Home 3D is now included by explicit owner request. It takes three external configuration files; personal model/configuration data must stay outside this public repository.
- Every card must be generic and reusable across households. Do not structure cards, entity slots, labels, limits or defaults around the owner’s personal setup. Prefer configurable, repeatable devices/readings and derive controls from supported HA capabilities. Use household examples only to illustrate a general design; state genuine technical/domain limits explicitly.
- Before implementing a new card or redesign, obtain the owner’s explicit agreement on BOTH the visual mock and the complete configuration proposal. Agreement on only one does not authorize implementation. Iterate on both first; keep implementation, merging and release as separate authorized stages. This is a standing owner requirement for all future card design work.
- Before UI work, read `docs/ikio/DESIGN_APPROACH.md` and the relevant findings in `docs/ikio/DESIGN_REVIEW.md`. Light, Energy, Drive (Car) and Security are approved reference designs: preserve their layouts and interactions unless the owner explicitly requests changes. Scope shared-style changes so they do not redesign these cards indirectly.
- Use UI UX Pro Max as an advisory design-review reference, as described in the design guide. Prefer focused accessibility/interaction/layout queries; verify that results fit Home Assistant Web Components. The owner's preferences and repository decisions take precedence over generic skill recommendations. Do not regenerate Ikio's palette, add a framework or require a skill installation to make an ordinary fix.

## Translations

All Ikio UI strings and editor labels use the shared catalogs in `packages/ikio-card-ui/src/translations`. Follow `docs/ikio/TRANSLATIONS.md`, use complete messages with placeholders/plurals, and never translate configuration keys, service data, entity names or arbitrary integration values. Keep demos explicitly English. Run `npm run check:translations` after adding UI text.

## Checks

Use Node 24 from `.node-version` and its bundled npm. Keep `engine-strict` enabled. From the root run:

```sh
npm ci
npm test
npm run test:scripts
npm run format:check
npm run check:ikio-version
npm run build
npm run check:hacs
npm run package:ikio
```

Run affected workspace checks locally for focused changes and script tests for automation changes. CI runs the full workspace suite, formatting, builds, packaging, preview captures and browser scenarios; do not repeat the full suite locally after successful CI unless a new change or unresolved failure justifies it. For UI changes, reuse `npm run preview:build && npm run test:browser` and extend `scripts/browser-checks.mjs` for new interactions instead of writing temporary browser scripts. Tests should protect observable behaviour, configuration preservation, lifecycle and missing-data handling. A jsdom or simulated-browser test is not a native-HA/device test. Report these validation categories separately. Never claim live installation or device outcomes without evidence.

## Versions and delivery

- `ikio/package.json` is the only collection version authority. Private card and shared-package manifests must omit `version`; use local `file:` references for internal dependencies. Run `npm run check:ikio-version` to validate manifests and lockfile. Release Please calculates versions and generates `ikio/CHANGELOG.md` from individual Conventional Commits across the whole repository. `.release-please-manifest.json` is bot bookkeeping, updated together with the authoritative version; do not use it as an independent version source. Do not manually bump versions or write release changelog entries in ordinary feature/fix PRs.
- Use `vX.Y.Z` release names. Do not overwrite tags. During 0.x, breaking changes bump the minor version.
- Keep installation URLs and documentation aligned with the current version. Use clear Conventional Commits: `feat` adds features, `fix` fixes behaviour, `perf` improves performance, and `ci`/`chore`/`docs` describe maintenance. CI validates individual non-merge PR commits, not just PR titles. Mark incompatible changes with `!` or a `BREAKING CHANGE:` footer; until 1.x these bump minor, just like features, rather than triggering 1.0. Maintenance-only commits do not initiate a release.
- After successful main CI, Prepare release updates a reviewable release PR, refreshes README preview links and the tracked HACS files, and explicitly dispatches CI for the bot branch. No extra token/secret is required. Keep GitHub Actions allowed to create pull requests in repository Actions settings.
- Release preparation is automatic; merging a release PR is a separate, explicitly authorized stage. After the owner asks to release, use the Ship release workflow with the release PR number and action `release`. Its default `status` action is read-only. It waits for exact-head checks, enforces semi-linear history, merges with a SHA guard, explicitly starts publication CI and cleanup, and reports the published release identity. Read its compact JSON/summary instead of repeatedly inspecting individual API responses. If main has moved, run Prepare release to refresh the branch; do not bypass checks. See `docs/ikio/RELEASING.md`.
- `npm run package:ikio` creates an installation folder and a ZIP containing compiled cards, lazy chunks, notices, theme, docs and reproducible tracked source. Stage new files before packaging. Keep source and design documents outside Home Assistant's public www directory.
- CI validates and publishes one versioned GitHub release on main. HACS installs the tracked root `ha-ikio-cards.js` named in `hacs.json` from raw tagged content. Releases must have no attached assets: HACS 2.0.5 would prefer the release-download route if any assets exist. ZIPs remain in CI artifacts. Individual builds remain available in the ZIP. Never add required external imports to the HACS bundle; never overwrite published releases/tags. Keep unrelated release automation out of this repository.
- Commit or publish only when the user has authorized it. Do not add an original-source license without the owner's choice. Third-party notices apply to their respective dependencies.

## Pull request merge policy

- The owner prefers visible merge commits on main. Keep semi-linear history: rebase the PR branch onto the latest main before merging, verify main is an ancestor and the PR range contains no merge commits, then use GitHub's `merge` method. Do not squash or use GitHub's rebase merge method. Preserve existing published history.
- Delete the source branch after a successful merge. The merged-branch cleanup workflow handles repository branches whose current head exactly matches a PR merged into main. Keep main, gh-pages, protected branches, unmerged work and branches with commits added after merging.
