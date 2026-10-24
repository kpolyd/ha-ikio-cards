import { readFile } from "node:fs/promises";

async function optional(request) {
  try {
    return (await request()).data;
  } catch (error) {
    if (error.status === 404) return undefined;
    throw error;
  }
}

/** Called only after CI succeeds on main; draft assets are private until complete. */
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
  const tag = `ikio-v${version}`;
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
    release = releases.find((item) => item.tag_name === tag);
  }
  // Later documentation commits must not modify an already published version.
  if (release && !release.draft)
    return { skipped: true, url: release.html_url };
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
  const bundle = await readFile(`${root}/dist/ha-ikio-cards.js`);
  const zip = await readFile(`${root}/release/${tag}.zip`);
  const notice = await readFile(`${root}/dist/licenses/NOTICE.txt`);
  const license = await readFile(`${root}/dist/licenses/esbuild-LICENSE.md`);
  const assets = [
    ["ha-ikio-cards.js", "application/javascript", bundle],
    [`${tag}.zip`, "application/zip", zip],
    ["NOTICE.txt", "text/plain", notice],
    ["esbuild-LICENSE.md", "text/markdown", license],
  ];
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
        body: `${section.trim()}\n\n## Install through HACS\n\nAdd https://github.com/${owner}/${repo} as a custom Dashboard repository, then download Ikio Cards. The release asset ha-ikio-cards.js includes all eleven cards and their editors. Resource: /hacsfiles/${repo}/ha-ikio-cards.js (JavaScript module).\n\nThe ZIP also includes individual builds, theme, design docs, notices and reproducible source. Automated tests/build checks passed for this source. Native HA/device compatibility still requires live verification.\n`,
      })
    ).data;
  for (const [name, type, data] of assets) {
    // Retry only unpublished draft assets, never overwrite a published release.
    const existing = release.assets?.find((asset) => asset.name === name);
    if (existing)
      await github.rest.repos.deleteReleaseAsset({
        owner,
        repo,
        asset_id: existing.id,
      });
    await github.rest.repos.uploadReleaseAsset({
      owner,
      repo,
      release_id: release.id,
      name,
      data,
      headers: { "content-type": type, "content-length": data.length },
    });
  }
  const published = await github.rest.repos.updateRelease({
    owner,
    repo,
    release_id: release.id,
    draft: false,
    make_latest: "true",
  });
  return { skipped: false, url: published.data.html_url };
}
