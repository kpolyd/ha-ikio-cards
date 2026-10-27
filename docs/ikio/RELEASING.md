# Git and release automation

Use meaningful Conventional Commits on feature branches. CI checks every individual non-merge commit because this repository preserves merge commits on main. A conventional PR title alone does not fix unclear commit messages.

| Commit | Before 1.0 | Changelog |
|---|---|---|
| `fix(media): hide source while off` | Patch | Bug Fixes |
| `perf(graph): reuse history samples` | Patch | Performance Improvements |
| `feat(media): add artwork` | Minor | Features |
| `feat(media)!: replace configuration` | Minor | Features and breaking-change notes |
| `ci: improve validation`, `docs: clarify setup`, `chore: update tooling` | No release by themselves | Omitted |

Breaking changes can also use a `BREAKING CHANGE:` footer. During 0.x they do not trigger 1.0; promoting to 1.0 must be deliberate. From 1.x onward, breaking changes bump major. Describe the visible behaviour and include a migration note in the commit body when useful. Do not manually edit the collection version or changelog in ordinary feature/fix PRs.

## Automatic preparation

After CI succeeds on main, **Prepare release** uses the pinned Release Please library to scan all repository commits since the published tag. Its small Ikio strategy updates `ikio/package.json` and `ikio/CHANGELOG.md` without adding versions to the root or private workspace packages. The manifest file is Release Please bookkeeping; `ikio/package.json` remains the version authority.

The bot opens or updates one release PR. It runs `npm run release:prepare` to regenerate README preview links and the tracked HACS bundle/notices. It explicitly dispatches CI for that branch because writes made with GitHub's built-in token do not automatically start other workflows. This uses `GITHUB_TOKEN`; no personal access token is needed. Repository Settings → Actions → General → Workflow permissions must allow GitHub Actions to create pull requests. If organization policy disables this, a repository/organization administrator must allow it.

The existing CI remains the publisher. Release Please does not create tags or GitHub releases. Once publication succeeds, the next preparation run marks the merged release PR as tagged, allowing preparation of the next release. Failed publication leaves it pending and blocks the next release PR until the current publication is repaired. Run **Prepare release** manually to refresh a stale release branch or retry preparation.

## Publish when requested

After reviewing the release PR and receiving explicit authorization to release, open Actions → **Ship release** → Run workflow. Enter the release PR number and choose `release`. The default `status` option only reports the PR SHA and checks. CLI equivalent with an authenticated GitHub CLI:

```sh
gh workflow run ship-release.yml -f pr=NUMBER -f action=release
```

The workflow waits for `check` and `previews` on the current PR head, rejects stale or internally merged branches, and merges with GitHub's merge method and an expected-head guard. It dispatches main CI and branch cleanup explicitly, then waits for publication and verifies the release tag points at the merge commit with no attached assets. Its JSON summary includes release, CI and preview URLs. A failure after merging reports that fact; inspect or rerun publication CI instead of merging again.

Main CI tests all workspaces and scripts, checks formatting/versioning, rebuilds and validates the tracked HACS bundle, packages the collection, captures previews, and runs reusable browser interactions for Media, Climate, Dehumidifier and Vacuum. The preview job compares feature and release PRs against main. Reports/screenshots are retained as separate `previews-*` and `browser-checks-*` artifacts. These checks use simulated HA data and do not certify native HA or live device compatibility.

CI publishes immutable `vX.Y.Z` tags/releases, checks HACS stable-release ordering and verifies hosted previews. No release assets are attached; the ZIP remains a CI artifact so HACS uses raw tagged source. Existing versions are skipped, never overwritten.

## Local checks

Run affected workspace checks for focused changes and `npm run test:scripts` for automation edits. Use the full CI result instead of repeating all checks locally after it passes. New card source still needs `npm run prepare:hacs` before committing so the tracked bundle matches source; its version remains unchanged until the release PR.

```sh
npm run check:commits -- origin/main HEAD
npm run preview:build
npm run test:browser
```

The browser command needs compiled cards (`npm run build`) and Playwright Chromium (`npx playwright install chromium`). Extend its existing scenarios when behaviour changes. `npm run release:prepare` refreshes generated release files for the already selected version; it does not select a version, merge, tag or publish anything.
