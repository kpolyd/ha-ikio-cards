const pause = () => new Promise((resolve) => setTimeout(resolve, 10000));

export function checkedHead(checks) {
  return ["check", "previews"].every((name) => {
    const latest = checks
      .filter((check) => check.name === name)
      .sort((a, b) => b.id - a.id)[0];
    if (latest?.status === "completed" && latest.conclusion !== "success")
      throw Error(`${name} failed: ${latest.html_url}`);
    return latest?.conclusion === "success";
  });
}

export async function releaseStatus({ github, context, number }) {
  const { data: pr } = await github.rest.pulls.get({
    ...context.repo,
    pull_number: number,
  });
  const { data: checks } = await github.rest.checks.listForRef({
    ...context.repo,
    ref: pr.head.sha,
    per_page: 100,
  });
  return {
    pr: pr.html_url,
    head: pr.head.sha,
    merged: Boolean(pr.merged_at),
    checks: checks.check_runs
      .filter((check) => ["check", "previews"].includes(check.name))
      .map((check) => ({
        name: check.name,
        status: check.status,
        conclusion: check.conclusion,
        url: check.html_url,
      })),
  };
}

/** Invoked only by an explicit Ship release workflow dispatch. */
export async function shipRelease({
  github,
  context,
  number,
  wait = pause,
  attempts = 180,
}) {
  const repo = context.repo;
  const readPR = async () =>
    (await github.rest.pulls.get({ ...repo, pull_number: number })).data;
  const initial = await readPR();
  if (
    initial.draft ||
    initial.state !== "open" ||
    initial.base.ref !== "main" ||
    initial.head.repo?.full_name !== `${repo.owner}/${repo.repo}` ||
    initial.head.ref !== "release-please--branches--main" ||
    !initial.labels.some((label) => label.name === "autorelease: pending")
  )
    throw Error("Select an open, ready Release Please PR in this repository");
  const head = initial.head.sha;
  let ready = false;
  for (let i = 0; i < attempts; i++) {
    const pr = await readPR();
    if (pr.head.sha !== head || pr.state !== "open" || pr.draft)
      throw Error(
        "Release PR changed while waiting; review the updated PR and retry",
      );
    const { data } = await github.rest.checks.listForRef({
      ...repo,
      ref: head,
      per_page: 100,
    });
    if (checkedHead(data.check_runs)) {
      ready = true;
      break;
    }
    await wait();
  }
  if (!ready) throw Error("Timed out waiting for release PR CI");
  const { data: main } = await github.rest.repos.getBranch({
    ...repo,
    branch: "main",
  });
  const { data: comparison } =
    await github.rest.repos.compareCommitsWithBasehead({
      ...repo,
      basehead: `${main.commit.sha}...${head}`,
    });
  if (
    comparison.merge_base_commit.sha !== main.commit.sha ||
    comparison.total_commits !== comparison.commits.length ||
    comparison.commits.some((commit) => commit.parents.length !== 1)
  )
    throw Error(
      "Refresh the release PR onto current main before shipping; merge commits inside PR branches are forbidden",
    );
  const { data: file } = await github.rest.repos.getContent({
    ...repo,
    path: "ikio/package.json",
    ref: head,
  });
  const { version } = JSON.parse(
    Buffer.from(file.content, "base64").toString(),
  );
  const { data: current } = await github.rest.repos.getBranch({
    ...repo,
    branch: "main",
  });
  if (current.commit.sha !== main.commit.sha)
    throw Error(
      "Main changed before merging; retry after the release PR refreshes",
    );
  const { data: merge } = await github.rest.pulls.merge({
    ...repo,
    pull_number: number,
    sha: head,
    merge_method: "merge",
  });
  if (!merge.merged) throw Error(`Merge failed: ${merge.message}`);
  // A merge with GITHUB_TOKEN does not trigger push CI or branch cleanup.
  await github.rest.actions.createWorkflowDispatch({
    ...repo,
    workflow_id: "ci.yml",
    ref: "main",
  });
  await github.rest.actions.createWorkflowDispatch({
    ...repo,
    workflow_id: "branch-cleanup.yml",
    ref: "main",
  });
  let run;
  for (let i = 0; i < attempts; i++) {
    const { data } = await github.rest.actions.listWorkflowRuns({
      ...repo,
      workflow_id: "ci.yml",
      head_sha: merge.sha,
      per_page: 100,
    });
    run = data.workflow_runs.sort((a, b) => b.id - a.id)[0];
    if (run?.status === "completed") {
      if (run.conclusion !== "success")
        throw Error(
          `Merged, but publication CI failed; rerun that CI: ${run.html_url}`,
        );
      const { data: release } = await github.rest.repos.getReleaseByTag({
        ...repo,
        tag: `v${version}`,
      });
      const { data: tag } = await github.rest.git.getRef({
        ...repo,
        ref: `tags/v${version}`,
      });
      const object =
        tag.object.type === "tag"
          ? (await github.rest.git.getTag({ ...repo, tag_sha: tag.object.sha }))
              .data.object
          : tag.object;
      if (
        release.draft ||
        release.prerelease ||
        release.assets.length ||
        object.sha !== merge.sha
      )
        throw Error(
          "Release identity/HACS verification failed; inspect published release",
        );
      return {
        version,
        sha: merge.sha,
        release: release.html_url,
        ci: run.html_url,
        previews: `https://kpolyd.github.io/ha-ikio-cards/previews/${version}/index.html`,
      };
    }
    await wait();
  }
  throw Error(
    `Merged; timed out waiting for publication. Inspect CI before retrying: ${run?.html_url ?? merge.sha}`,
  );
}
