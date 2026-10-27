import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishRelease, verifyReleaseOrder } from "../publish-release.mjs";

function api({ published = false, conflictingTag = false } = {}) {
  const calls = [];
  const missing = async () => {
    throw Object.assign(Error("Missing"), { status: 404 });
  };
  const record = (name) => async (payload) => {
    calls.push({ name, payload });
    return {
      data: {
        id: 7,
        assets: [],
        html_url: "https://github.com/owner/repo/releases/tag/v0.3.2",
      },
    };
  };
  return {
    calls,
    github: {
      paginate: async () => [],
      rest: {
        repos: {
          listReleases: async () => ({ data: [{ tag_name: "v0.3.2" }] }),
          getReleaseByTag: published
            ? async () => ({ data: { draft: false, html_url: "existing" } })
            : missing,
          createRelease: record("create"),
          updateRelease: record("publish"),
          uploadReleaseAsset: record("upload"),
          deleteReleaseAsset: record("delete"),
        },
        git: {
          getRef: conflictingTag
            ? async () => ({
                data: { object: { type: "commit", sha: "different" } },
              })
            : missing,
        },
      },
    },
  };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "ikio-release-"));
  for (const [name, value] of Object.entries({
    "ikio/package.json": '{"version":"0.3.2"}',
    "ikio/CHANGELOG.md":
      "# Changes\n\n## 0.3.2 — raw HACS\n\n- Avoid release redirects.\n\n## 0.3.1 — previous\n",
    "hacs.json": '{"content_in_root":true,"filename":"ha-ikio-cards.js"}',
    "ha-ikio-cards.js": "// bundle",
    "dist/ha-ikio-cards.js": "// bundle",
    "licenses/NOTICE.txt": "Notice",
    "dist/licenses/NOTICE.txt": "Notice",
    "licenses/esbuild-LICENSE.md": "License",
    "dist/licenses/esbuild-LICENSE.md": "License",
  })) {
    await mkdir(join(root, name, ".."), { recursive: true });
    await writeFile(join(root, name), value);
  }
  return root;
}
const context = { repo: { owner: "owner", repo: "repo" }, sha: "verified" };
async function run(options, check) {
  const root = await fixture();
  const mock = api(options);
  try {
    await check(root, mock);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test("release uses checked tagged source and attaches no assets so HACS falls back to raw files", async () => {
  await run({}, async (root, mock) => {
    await publishRelease({ ...mock, context, root });
    assert.deepEqual(
      mock.calls.map((c) => c.name),
      ["create", "publish"],
    );
    assert.equal(mock.calls[0].payload.draft, true);
    assert.equal(mock.calls[0].payload.target_commitish, "verified");
    assert.equal(mock.calls[0].payload.tag_name, "v0.3.2");
    assert.equal(mock.calls.at(-1).payload.draft, false);
    assert.match(mock.calls[0].payload.body, /raw.githubusercontent.com/);
  });
});
test("published versions are never overwritten", async () => {
  await run({ published: true }, async (root, mock) => {
    assert.equal(
      (await publishRelease({ ...mock, context, root })).skipped,
      true,
    );
    assert.deepEqual(mock.calls, []);
  });
});
test("a tag for different source aborts without creating a release", async () => {
  await run({ conflictingTag: true }, async (root, mock) => {
    await assert.rejects(
      publishRelease({ ...mock, context, root }),
      /different source/,
    );
    assert.deepEqual(mock.calls, []);
  });
});
test("a stale committed bundle cannot be released", async () => {
  await run({}, async (root, mock) => {
    await writeFile(join(root, "ha-ikio-cards.js"), "// stale bundle");
    await assert.rejects(
      publishRelease({ ...mock, context, root }),
      /bundle is stale/,
    );
    assert.deepEqual(mock.calls, []);
  });
});
test("an asset-free draft resumes on the same source without creating a duplicate", async () => {
  await run({}, async (root, mock) => {
    mock.github.paginate = async () => [
      {
        id: 7,
        tag_name: "v0.3.2",
        draft: true,
        target_commitish: "verified",
        assets: [],
      },
    ];
    await publishRelease({ ...mock, context, root });
    assert.deepEqual(
      mock.calls.map((c) => c.name),
      ["publish"],
    );
  });
});
test("an existing draft from different source cannot be overwritten", async () => {
  await run({}, async (root, mock) => {
    mock.github.paginate = async () => [
      {
        id: 7,
        tag_name: "v0.3.2",
        draft: true,
        target_commitish: "different",
        assets: [],
      },
    ];
    await assert.rejects(
      publishRelease({ ...mock, context, root }),
      /draft targets different source/,
    );
    assert.deepEqual(mock.calls, []);
  });
});
test("a draft with assets is rejected because HACS would still use release redirects", async () => {
  await run({}, async (root, mock) => {
    mock.github.paginate = async () => [
      {
        id: 7,
        tag_name: "v0.3.2",
        draft: true,
        target_commitish: "verified",
        assets: [{ name: "source.zip" }],
      },
    ];
    await assert.rejects(
      publishRelease({ ...mock, context, root }),
      /Draft has attached assets/,
    );
    assert.deepEqual(mock.calls, []);
  });
});
test("publishing errors propagate without changing source tags or attaching assets", async () => {
  await run({}, async (root, mock) => {
    mock.github.rest.repos.updateRelease = async () => {
      throw Error("GitHub publish failed");
    };
    await assert.rejects(
      publishRelease({ ...mock, context, root }),
      /GitHub publish failed/,
    );
    assert.deepEqual(
      mock.calls.map((c) => c.name),
      ["create"],
    );
  });
});

test("HACS order check skips drafts/prereleases and retries stale lists", async () => {
  let reads = 0;
  let waits = 0;
  const github = {
    rest: {
      repos: {
        listReleases: async () => ({
          data:
            ++reads === 1
              ? [{ tag_name: "v0.3.1" }]
              : [
                  { tag_name: "v0.4.0", draft: true },
                  { tag_name: "v0.4.1", prerelease: true },
                  { tag_name: "v0.3.2" },
                ],
        }),
      },
    },
  };
  await verifyReleaseOrder({
    github,
    ...context.repo,
    tag: "v0.3.2",
    wait: async () => {
      waits++;
    },
  });
  assert.equal(reads, 2);
  assert.equal(waits, 1);
});
test("HACS order check fails if the published version stays below an older release", async () => {
  const { github } = api();
  await assert.rejects(
    verifyReleaseOrder({
      github,
      ...context.repo,
      tag: "v0.3.3",
      attempts: 2,
      wait: async () => {},
    }),
    /expected v0.3.3, found v0.3.2/,
  );
});
test("rerunning a published standard release verifies order without republishing", async () => {
  await run({ published: true }, async (root, mock) => {
    mock.github.rest.repos.getReleaseByTag = async () => ({
      data: { draft: false, tag_name: "v0.3.2", html_url: "existing" },
    });
    assert.equal(
      (await publishRelease({ ...mock, context, root })).skipped,
      true,
    );
    assert.deepEqual(mock.calls, []);
  });
});
test("legacy published tags prevent duplicate releases during migration", async () => {
  await run({}, async (root, mock) => {
    mock.github.paginate = async () => [
      { tag_name: "ikio-v0.3.2", draft: false, html_url: "legacy" },
    ];
    assert.equal(
      (await publishRelease({ ...mock, context, root })).url,
      "legacy",
    );
    assert.deepEqual(mock.calls, []);
  });
});
