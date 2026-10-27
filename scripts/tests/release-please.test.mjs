import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Manifest } from "release-please";
import { buildStrategy } from "release-please/build/src/factory.js";
import { parseConventionalCommits } from "release-please/build/src/commit.js";
import { Version } from "release-please/build/src/version.js";
import { TagName } from "release-please/build/src/util/tag-name.js";
import {
  releaseConfig,
  finishPublishedPullRequests,
} from "../release-please.mjs";
import { checkCommitMessage } from "../check-commits.mjs";
import { changelogSection } from "../publish-release.mjs";

async function candidate(messages, previous = "0.12.0") {
  const strategy = await buildStrategy({
    ...releaseConfig,
    github: { repository: { owner: "kpolyd", repo: "ha-ikio-cards" } },
    targetBranch: "main",
    path: ".",
  });
  const commits = messages.map((message, i) => ({
    sha: String(i).padStart(40, "a"),
    message,
    files: ["cards/ikio-media-card/src/card.js"],
  }));
  return strategy.buildReleasePullRequest(parseConventionalCommits(commits), {
    tag: new TagName(Version.parse(previous)),
    sha: "previous",
    notes: "",
  });
}

for (const [message, expected, previous] of [
  ["fix(media): hide the source while off", "0.12.1"],
  ["feat(media): add artwork", "0.13.0"],
  ["feat(media)!: replace backlight configuration", "0.13.0"],
  [
    "fix(media): migrate controls\n\nBREAKING CHANGE: remove old slots",
    "0.13.0",
  ],
  ["feat(media)!: replace configuration", "2.0.0", "1.2.3"],
])
  test(`Release Please versions ${message.split("\n")[0]} as ${expected}`, async () => {
    const pr = await candidate([message], previous);
    assert.equal(pr.version.toString(), expected);
    assert.equal(pr.headRefName, "release-please--branches--main");
    assert.deepEqual(pr.updates.map((update) => update.path).sort(), [
      "ikio/CHANGELOG.md",
      "ikio/package.json",
    ]);
    const json = pr.updates.find((update) =>
      update.path.endsWith("package.json"),
    );
    assert.deepEqual(
      JSON.parse(
        json.updater.updateContent(
          '{"name":"ikio","version":"0.12.0","private":true}',
        ),
      ),
      {
        name: "ikio",
        version: expected,
        private: true,
      },
    );
    const changelog = pr.updates.find((update) =>
      update.path.endsWith("CHANGELOG.md"),
    );
    const text = changelog.updater.updateContent(
      "# Ikio changelog\n\n## 0.12.0 — Previous\n\n- Old entry.\n",
    );
    assert.match(changelogSection(text, expected), /media/);
    assert.match(changelogSection(text, "0.12.0"), /Old entry/);
  });

test("merge history keeps individual fixes/features and ignores merge/chore messages", async () => {
  const pr = await candidate([
    "Merge pull request #42 from example/media",
    "feat(media): add artwork",
    "fix(media): preserve mute state",
    "chore(release): refresh generated files",
  ]);
  const notes = pr.body.toString();
  assert.equal(pr.version.toString(), "0.13.0");
  assert.match(notes, /add artwork/);
  assert.match(notes, /preserve mute state/);
  assert.doesNotMatch(notes, /refresh generated|Merge pull request/);
  assert.equal(
    await candidate(["ci: automate release preparation"]),
    undefined,
  );
});

test("manifest scans cards and shared packages after the published tag, preserving merge history", async () => {
  const github = {
    repository: { owner: "kpolyd", repo: "ha-ikio-cards" },
    async *releaseIterator() {
      yield { tagName: "v0.12.0", sha: "published", notes: "previous" };
    },
    async *mergeCommitIterator() {
      yield {
        sha: "merge",
        message: "Merge pull request #42",
        files: ["cards/ikio-media-card/src/card.js"],
      };
      yield {
        sha: "feature",
        message: "feat(media): show artwork",
        files: ["cards/ikio-media-card/src/card.js"],
      };
      yield {
        sha: "fix",
        message: "fix(ui): preserve focus",
        files: ["packages/ikio-card-ui/src/index.js"],
      };
      yield { sha: "published", message: "Merge pull request #31", files: [] };
      yield {
        sha: "old",
        message: "feat!: old breaking change",
        files: ["cards/old.js"],
      };
    },
  };
  const manifest = new Manifest(
    github,
    "main",
    { ".": releaseConfig },
    { ".": Version.parse("0.12.0") },
    { separatePullRequests: true },
  );
  const [pr] = await manifest.buildPullRequests();
  assert.equal(pr.version.toString(), "0.13.0");
  assert.match(pr.body.toString(), /show artwork/);
  assert.match(pr.body.toString(), /preserve focus/);
  assert.doesNotMatch(pr.body.toString(), /old breaking change/);
  assert.ok(
    pr.updates.some(
      (update) => update.path === ".release-please-manifest.json",
    ),
  );
});

test("changelog extraction retains subsections and accepts linked patch headings", () => {
  const log =
    "# Changes\n\n### [0.12.1](https://example.test) (2026-10-27)\n\n### Bug Fixes\n\n- Preserve mute.\n\n## 0.12.0 — Previous\n\n- Old.\n";
  assert.match(
    changelogSection(log, "0.12.1"),
    /### Bug Fixes\n\n- Preserve mute/,
  );
  assert.doesNotMatch(changelogSection(log, "0.12.1"), /Old/);
  assert.equal(changelogSection(log, "0.12.10"), undefined);
});

test("commit validation accepts conventional types and rejects unclear headers", () => {
  for (const message of [
    "feat(media)!: replace controls",
    "fix: preserve zero",
    "docs: describe installation",
    "ci(release): prepare changelog",
  ])
    assert.doesNotThrow(() => checkCommitMessage(message));
  for (const message of ["update", "feat:", "Fix: something", "feat(media): "])
    assert.throws(() => checkCommitMessage(message), /Conventional Commit/);
});

test("pending labels are cleared only for merged PRs of the published version", async () => {
  const calls = [];
  const github = {
    paginate: async () =>
      [1, 2, 3].map((number) => ({ number, pull_request: {} })),
    rest: {
      repos: {
        getReleaseByTag: async () => ({ data: { tag_name: "v0.12.0" } }),
        getContent: async ({ ref }) => ({
          data: {
            content: Buffer.from(
              JSON.stringify({ version: ref === "one" ? "0.12.0" : "0.11.0" }),
            ).toString("base64"),
          },
        }),
      },
      pulls: {
        get: async ({ pull_number }) => ({
          data: {
            number: pull_number,
            merged_at: pull_number !== 3,
            base: { ref: "main" },
            merge_commit_sha: pull_number === 1 ? "one" : "two",
          },
        }),
      },
      issues: {
        listForRepo: () => {},
        addLabels: async (payload) => calls.push(payload),
        removeLabel: async (payload) => calls.push(payload),
      },
    },
  };
  await finishPublishedPullRequests({
    github,
    context: { repo: { owner: "a", repo: "b" } },
    version: "0.12.0",
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.issue_number === 1));
});

test("bookkeeping manifest initially matches the collection version", async () => {
  const manifest = JSON.parse(
    await readFile(".release-please-manifest.json", "utf8"),
  );
  const pkg = JSON.parse(await readFile("ikio/package.json", "utf8"));
  assert.equal(manifest["."], pkg.version);
});
