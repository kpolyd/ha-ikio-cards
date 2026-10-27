import { readFile } from "node:fs/promises";
import { validateHacsBundle } from "./check-hacs.mjs";

async function optional(request) {
  try {
    return (await request()).data;
  } catch (error) {
    if (error.status === 404) return undefined;
    throw error;
  }
}

/** HACS selects the first stable release, independently of GitHub's latest flag. */
export async function verifyReleaseOrder({
  github,
  owner,
  repo,
  tag,
  attempts = 6,
  wait = () => new Promise((resolve) => setTimeout(resolve, 10000)),
}) {
  let first;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const { data } = await github.rest.repos.listReleases({
      owner,
      repo,
      per_page: 30,
    });
    first = data.find((item) => !item.draft && !item.prerelease)?.tag_name;
    if (first === tag) return;
    if (attempt + 1 < attempts) await wait();
  }
  throw Error(
    `HACS release ordering check failed: expected ${tag}, found ${first ?? "no stable release"}. The release remains published; inspect GitHub's release list before retrying.`,
  );
}

/** Publish only checked source; no attached assets, so HACS uses raw tagged files. */
export async function publishRelease({
  github,
  context,
  root = process.cwd(),
}) {
  const { owner, repo } = context.repo;
  const { version } = JSON.parse(
    await readFile(`${root}/ikio/package.json`, "utf8"),
  );
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Invalid release version");
  const tag = `v${version}`;
  let release = await optional(() =>
    github.rest.repos.getReleaseByTag({ owner, repo, tag }),
  );
  // Drafts may not yet have a tag, so they can be absent from getReleaseByTag.
  if (!release) {
    const releases = await github.paginate(github.rest.repos.listReleases, {
      owner,
      repo,
      per_page: 100,
    });
    release =
      releases.find((item) => item.tag_name === tag) ??
      releases.find(
        (item) => item.tag_name === `ikio-v${version}` && !item.draft,
      );
  }
  // Later documentation commits must not modify an already published version.
  if (release && !release.draft) {
    if (release.tag_name === tag)
      await verifyReleaseOrder({ github, owner, repo, tag });
    return { skipped: true, url: release.html_url };
  }
  const ref = await optional(() =>
    github.rest.git.getRef({ owner, repo, ref: `tags/${tag}` }),
  );
  if (ref) {
    const object =
      ref.object.type === "tag"
        ? (
            await github.rest.git.getTag({
              owner,
              repo,
              tag_sha: ref.object.sha,
            })
          ).data.object
        : ref.object;
    if (object.type !== "commit" || object.sha !== context.sha)
      throw Error(
        "Existing release tag points to different source; bump the version",
      );
  }
  if (release && release.target_commitish !== context.sha)
    throw Error("Existing draft targets different source; bump the version");
  const changelog = await readFile(`${root}/ikio/CHANGELOG.md`, "utf8");
  const section = changelog
    .split(/^## /m)
    .slice(1)
    .find((s) => s.startsWith(`${version} `));
  if (!section) throw Error("Current version is missing from the changelog");
  await validateHacsBundle(root);
  // Any attached asset makes HACS 2.0.5 select the release-download path.
  if (release?.assets?.length)
    throw Error(
      "Draft has attached assets; use a new version for raw-file distribution",
    );
  if (!release)
    release = (
      await github.rest.repos.createRelease({
        owner,
        repo,
        tag_name: tag,
        target_commitish: context.sha,
        name: `Ikio Cards ${version}`,
        draft: true,
        prerelease: false,
        body: `${section.trim()}\n\n## Card previews\n\nhttps://kpolyd.github.io/ha-ikio-cards/previews/${version}/index.html\n\n## Install through HACS\n\nAdd https://github.com/${owner}/${repo} as a custom Dashboard repository, then download Ikio Cards. The tracked ha-ikio-cards.js file includes all thirteen cards and their editors. HACS downloads it from this release tag through raw.githubusercontent.com, avoiding the GitHub release-redirect header issue. Resource: /hacsfiles/${repo}/ha-ikio-cards.js (JavaScript module).\n\nDownload the bundle directly: https://raw.githubusercontent.com/${owner}/${repo}/${tag}/ha-ikio-cards.js . This release intentionally has no attached assets. The full ZIP is available from the successful CI run’s ikio-cards artifact; source, theme and dependency notices are also in the tagged repository. Automated tests/build checks passed for this source. Native HA/device compatibility still requires live verification.\n`,
      })
    ).data;
  const published = await github.rest.repos.updateRelease({
    owner,
    repo,
    release_id: release.id,
    draft: false,
    make_latest: "true",
  });
  await verifyReleaseOrder({ github, owner, repo, tag });
  return { skipped: false, url: published.data.html_url };
}
