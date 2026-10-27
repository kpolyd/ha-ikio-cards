# Ikio Cards — contributor guide

This guide applies to the whole repository. Read the applicable `cards/<card>/AGENTS.md` before changing a card. Preserve behaviour and appearance during refactors; keep redesigns separate. Do not operate real devices as incidental smoke tests.

## Structure

- Eleven cards live in separate `cards/ikio-*-card` npm workspaces.
- `packages/ikio-card-ui` and `packages/ikio-graph` provide shared code. Keep domain-specific capabilities in card adapters.
- The root lockfile is shared. Never introduce workspace lockfiles or runtime CDN imports.
- Edit source, then rebuild; generated `dist/` and `release/` output is ignored. The root `ha-ikio-cards.js` and `licenses/` are intentionally tracked for HACS raw-file delivery. Update them with `npm run prepare:hacs` and verify with `npm run check:hacs`; do not edit the minified bundle by hand.
- Do not add household bindings, coordinates, camera images, credentials or the separate 3D card. Tests and previews use clearly simulated entities.
- `docs/ikio/SPECIFICATION.md` records decisions, with later sections overriding earlier ones. Keep all configuration available through visual editors; hold always opens native entity details.
- Before UI work, read `docs/ikio/DESIGN_APPROACH.md` and the relevant findings in `docs/ikio/DESIGN_REVIEW.md`. Light, Energy, Drive (Car) and Security are approved reference designs: preserve their layouts and interactions unless the owner explicitly requests changes. Scope shared-style changes so they do not redesign these cards indirectly.
- Use UI UX Pro Max as an advisory design-review reference, as described in the design guide. Prefer focused accessibility/interaction/layout queries; verify that results fit Home Assistant Web Components. The owner's preferences and repository decisions take precedence over generic skill recommendations. Do not regenerate Ikio's palette, add a framework or require a skill installation to make an ordinary fix.

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

Run affected workspace checks for focused changes; run all workspaces after shared changes. Tests should protect observable behaviour, configuration preservation, lifecycle and missing-data handling. A jsdom test is not a browser/native-HA/device test. Report these validation categories separately. Never claim live installation or device outcomes without evidence.

## Versions and delivery

- `ikio/package.json` is the only collection version definition. Private card and shared-package manifests must omit `version`; use local `file:` references for internal dependencies. Run `npm run check:ikio-version` to validate manifests and lockfile. Version selection is manual; Conventional Commits do not automatically bump it. Keep one collection changelog.
- Use `ikio-vX.Y.Z` release names. Do not overwrite tags. During 0.x, breaking changes bump the minor version.
- Keep installation URLs and documentation aligned with the current version. Use Conventional Commits.
- `npm run package:ikio` creates an installation folder and a ZIP containing compiled cards, lazy chunks, notices, theme, docs and reproducible tracked source. Stage new files before packaging. Keep source and design documents outside Home Assistant's public www directory.
- CI validates and publishes one versioned GitHub release on main. HACS installs the tracked root `ha-ikio-cards.js` named in `hacs.json` from raw tagged content. Releases must have no attached assets: HACS 2.0.5 would prefer the release-download route if any assets exist. ZIPs remain in CI artifacts. Individual builds remain available in the ZIP. Never add required external imports to the HACS bundle; never overwrite published releases/tags. Keep unrelated release automation out of this repository.
- Commit or publish only when the user has authorized it. Do not add an original-source license without the owner's choice. Third-party notices apply to their respective dependencies.

## Pull request merge policy

- The owner prefers visible merge commits on main. Merge PRs using GitHub's `merge` method; do not squash or rebase unless the owner explicitly requests an exception. Preserve existing published history.
- Delete the source branch after a successful merge. The merged-branch cleanup workflow handles repository branches whose current head exactly matches a PR merged into main. Keep main, gh-pages, protected branches, unmerged work and branches with commits added after merging.
