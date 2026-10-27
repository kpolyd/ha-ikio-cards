import { test } from "node:test";
import assert from "node:assert/strict";
import { shipRelease, checkedHead } from "../ship-release.mjs";

function fixture({
  changedHead = false,
  failed = false,
  stale = false,
  mergeCommit = false,
  assets = false,
} = {}) {
  const calls = [];
  let reads = 0;
  const checks = ["check", "previews"].map((name, i) => ({
    id: i,
    name,
    status: "completed",
    conclusion: failed ? "failure" : "success",
    html_url: "checks",
  }));
  const github = {
    rest: {
      pulls: {
        get: async () => ({
          data: {
            number: 1,
            state: "open",
            draft: false,
            base: { ref: "main" },
            head: {
              sha: changedHead && reads++ > 0 ? "changed" : "head",
              ref: "release-please--branches--main",
              repo: { full_name: "a/b" },
            },
            labels: [{ name: "autorelease: pending" }],
          },
        }),
        merge: async (payload) => {
          calls.push({ merge: payload });
          return { data: { merged: true, sha: "merged" } };
        },
      },
      checks: { listForRef: async () => ({ data: { check_runs: checks } }) },
      repos: {
        getBranch: async () => ({ data: { commit: { sha: "main" } } }),
        compareCommitsWithBasehead: async () => ({
          data: {
            merge_base_commit: { sha: stale ? "older" : "main" },
            total_commits: 1,
            commits: [{ parents: mergeCommit ? [{}, {}] : [{}] }],
          },
        }),
        getContent: async () => ({
          data: {
            content: Buffer.from('{"version":"0.13.0"}').toString("base64"),
          },
        }),
        getReleaseByTag: async () => ({
          data: {
            html_url: "release",
            draft: false,
            prerelease: false,
            assets: assets ? [{}] : [],
          },
        }),
      },
      actions: {
        createWorkflowDispatch: async (payload) =>
          calls.push({ dispatch: payload }),
        listWorkflowRuns: async () => ({
          data: {
            workflow_runs: [
              {
                id: 1,
                status: "completed",
                conclusion: "success",
                html_url: "ci",
              },
            ],
          },
        }),
      },
      git: {
        getRef: async () => ({
          data: { object: { type: "commit", sha: "merged" } },
        }),
      },
    },
  };
  return {
    github,
    calls,
    context: { repo: { owner: "a", repo: "b" } },
    number: 1,
    wait: async () => {},
    attempts: 1,
  };
}

test("shipping guards the SHA, uses a merge commit and dispatches publication/cleanup", async () => {
  const mock = fixture();
  const result = await shipRelease(mock);
  assert.equal(mock.calls[0].merge.sha, "head");
  assert.equal(mock.calls[0].merge.merge_method, "merge");
  assert.deepEqual(
    mock.calls.slice(1).map((call) => call.dispatch.workflow_id),
    ["ci.yml", "branch-cleanup.yml"],
  );
  assert.equal(result.sha, "merged");
  assert.equal(result.version, "0.13.0");
});
for (const [options, pattern] of [
  [{ changedHead: true }, /changed while waiting/],
  [{ failed: true }, /failed/],
  [{ stale: true }, /Refresh the release PR/],
  [{ mergeCommit: true }, /merge commits inside PR/],
])
  test(`shipping refuses ${JSON.stringify(options)} before merging`, async () => {
    const mock = fixture(options);
    await assert.rejects(shipRelease(mock), pattern);
    assert.deepEqual(mock.calls, []);
  });
test("shipping reports HACS identity failures after a successful CI", async () => {
  await assert.rejects(
    shipRelease(fixture({ assets: true })),
    /HACS verification failed/,
  );
});
test("only the latest run of each required check counts", () => {
  assert.equal(
    checkedHead([
      { id: 1, name: "check", status: "completed", conclusion: "failure" },
      { id: 2, name: "check", status: "completed", conclusion: "success" },
      { id: 3, name: "previews", status: "in_progress" },
    ]),
    false,
  );
});
