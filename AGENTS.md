# Ikio Cards — contributor guide

This guide applies to the whole repository. Read the applicable `cards/<card>/AGENTS.md` before changing a card. Preserve behaviour and appearance during refactors; keep redesigns separate. Do not operate real devices as incidental smoke tests.

## Structure

- Eleven cards live in separate `cards/ikio-*-card` npm workspaces.
- `packages/ikio-card-ui` and `packages/ikio-graph` provide shared code. Keep domain-specific capabilities in card adapters.
- The root lockfile is shared. Never introduce workspace lockfiles or runtime CDN imports.
- Edit source, then rebuild; generated `dist/` and `release/` output is ignored.
- Do not add household bindings, coordinates, camera images, credentials or the separate 3D card. Tests and previews use clearly simulated entities.
- `docs/ikio/SPECIFICATION.md` records decisions, with later sections overriding earlier ones. Keep all configuration available through visual editors; hold always opens native entity details.

## Checks

Use Node 24 from `.node-version` and its bundled npm. Keep `engine-strict` enabled. From the root run:

```sh
npm ci
npm test
npm run test:scripts
npm run format:check
npm run check:ikio-version
npm run build
npm run package:ikio
```

Run affected workspace checks for focused changes; run all workspaces after shared changes. Tests should protect observable behaviour, configuration preservation, lifecycle and missing-data handling. A jsdom test is not a browser/native-HA/device test. Report these validation categories separately. Never claim live installation or device outcomes without evidence.

## Versions and delivery

- `ikio/package.json` is the collection version authority. All eleven cards and both shared packages use the same Semantic Version and one changelog. Run `node scripts/ikio-version.mjs` after changing the authority; `--check` validates manifests and lockfile.
- Use `ikio-vX.Y.Z` release names. Do not overwrite tags. During 0.x, breaking changes bump the minor version.
- Keep installation URLs and documentation aligned with the current version. Use Conventional Commits.
- `npm run package:ikio` creates an installation folder and a ZIP containing compiled cards, lazy chunks, notices, theme, docs and reproducible tracked source. Stage new files before packaging. Keep source and design documents outside Home Assistant's public www directory.
- CI validates and uploads a build artifact. It does not publish releases or provide HACS support yet. Do not copy unrelated release automation into this repository.
- Commit or publish only when the user has authorized it. Do not add an original-source license without the owner's choice. Third-party notices apply to their respective dependencies.
