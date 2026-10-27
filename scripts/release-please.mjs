import { readFile } from "node:fs/promises";
import { GitHub, Manifest, registerReleaseType } from "release-please";
import { BaseStrategy } from "release-please/build/src/strategies/base.js";
import { Changelog } from "release-please/build/src/updaters/changelog.js";
import { GenericJson } from "release-please/build/src/updaters/generic-json.js";
import { Version } from "release-please/build/src/version.js";

// Scan the whole repository while keeping ikio/package.json as version authority.
// The built-in node strategy would add a version to the root manifest instead.
export class IkioStrategy extends BaseStrategy {
  async buildUpdates({ newVersion, changelogEntry }) {
    return [
      {
        path: "ikio/CHANGELOG.md",
        createIfMissing: false,
        updater: new Changelog({ version: newVersion, changelogEntry }),
      },
      {
        path: "ikio/package.json",
        createIfMissing: false,
        updater: new GenericJson("$.version", newVersion),
      },
    ];
  }
}
registerReleaseType("ikio", (options) => new IkioStrategy(options));

export const releaseConfig = {
  releaseType: "ikio",
  bumpMinorPreMajor: true,
  bumpPatchForMinorPreMajor: false,
  includeComponentInTag: false,
  includeVInTag: true,
  changelogPath: "ikio/CHANGELOG.md",
  skipGithubRelease: true,
};

// Merge bodies repeat the PR title, which Release Please can parse again.
// Keep merge SHAs so history still stops at the published tag; use leaf text.
export function useIndividualCommits(client) {
  const history = client.mergeCommitIterator.bind(client);
  client.mergeCommitIterator = async function* (...args) {
    for await (const commit of history(...args)) {
      yield /^Merge (?:pull request #|branch |remote-tracking branch )/.test(
        commit.message,
      )
        ? { ...commit, message: "" }
        : commit;
    }
  };
  return client;
}

// The existing publisher owns tags, release ordering, HACS and preview checks.
// Clear pending labels only after that publisher has succeeded for this version.
export async function finishPublishedPullRequests({
  github,
  context,
  version,
}) {
  const { data: release } = await github.rest.repos.getReleaseByTag({
    ...context.repo,
    tag: `v${version}`,
  });
  if (release.draft || release.prerelease)
    throw Error("Wait for the current stable release to finish publishing");
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo,
    state: "closed",
    labels: "autorelease: pending",
    per_page: 100,
  });
  for (const issue of issues.filter((item) => item.pull_request)) {
    const { data: pr } = await github.rest.pulls.get({
      ...context.repo,
      pull_number: issue.number,
    });
    if (!pr.merged_at || pr.base.ref !== "main") continue;
    const { data: file } = await github.rest.repos.getContent({
      ...context.repo,
      path: "ikio/package.json",
      ref: pr.merge_commit_sha,
    });
    const merged = JSON.parse(Buffer.from(file.content, "base64").toString());
    if (merged.version !== version) continue;
    await github.rest.issues.addLabels({
      ...context.repo,
      issue_number: pr.number,
      labels: ["autorelease: tagged"],
    });
    await github.rest.issues.removeLabel({
      ...context.repo,
      issue_number: pr.number,
      name: "autorelease: pending",
    });
  }
}

export async function prepareReleasePullRequest({ github, context, token }) {
  const { version } = JSON.parse(await readFile("ikio/package.json", "utf8"));
  await finishPublishedPullRequests({ github, context, version });
  const client = await GitHub.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    defaultBranch: "main",
    token,
  });
  const manifest = new Manifest(
    useIndividualCommits(client),
    "main",
    { ".": releaseConfig },
    { ".": Version.parse(version) },
    { separatePullRequests: true },
  );
  const results = await manifest.createPullRequests();
  // Unchanged PRs are omitted by Release Please; still refresh their artifacts.
  const prs = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    base: "main",
    state: "open",
    per_page: 100,
  });
  const pr = prs.find(
    (p) =>
      p.head.repo?.full_name === `${context.repo.owner}/${context.repo.repo}` &&
      p.head.ref === "release-please--branches--main" &&
      p.labels.some((label) => label.name === "autorelease: pending"),
  );
  return pr
    ? {
        number: pr.number,
        branch: pr.head.ref,
        sha: pr.head.sha,
        updated: results.length > 0,
      }
    : { skipped: true };
}
