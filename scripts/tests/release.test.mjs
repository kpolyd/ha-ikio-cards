import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishRelease } from "../publish-release.mjs";

function api({
  published = false,
  conflictingTag = false,
  failUpload = false,
} = {}) {
  const calls = [];
  const missing = async () => {
    throw Object.assign(Error("Missing"), { status: 404 });
  };
  const record = (name) => async (payload) => {
    calls.push({ name, payload });
    if (name === "upload" && failUpload) throw Error("Upload failed");
    return {
      data: {
        id: 7,
        assets: [],
        html_url: "https://github.com/owner/repo/releases/tag/ikio-v0.3.1",
      },
    };
  };
  return {
    calls,
    github: {
      paginate: async () => [],
      rest: {
        repos: {
          getReleaseByTag: published
            ? async () => ({ data: { draft: false, html_url: "existing" } })
            : missing,
          createRelease: record("create"),
          uploadReleaseAsset: record("upload"),
          deleteReleaseAsset: record("delete"),
          updateRelease: record("publish"),
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
    "ikio/package.json": '{"version":"0.3.1"}',
    "ikio/CHANGELOG.md":
      "# Changes\n\n## 0.3.1 — HACS\n\n- Add HACS support.\n\n## 0.3.0 — previous\n",
    "dist/ha-ikio-cards.js": "// bundle",
    "release/ikio-v0.3.1.zip": "zip",
    "dist/licenses/NOTICE.txt": "Notice",
    "dist/licenses/esbuild-LICENSE.md": "License",
  })) {
    await mkdir(join(root, name, ".."), { recursive: true });
    await writeFile(join(root, name), value);
  }
  return root;
}
const context = { repo: { owner: "owner", repo: "repo" }, sha: "verified" };
test("release publishes only after every required asset uploads", async () => {
  const root = await fixture();
  const mock = api();
  try {
    await publishRelease({ ...mock, context, root });
    assert.deepEqual(
      mock.calls.map((c) => c.name),
      ["create", "upload", "upload", "upload", "upload", "publish"],
    );
    assert.equal(mock.calls[0].payload.draft, true);
    assert.equal(mock.calls[0].payload.target_commitish, "verified");
    assert.equal(mock.calls[1].payload.name, "ha-ikio-cards.js");
    assert.equal(mock.calls.at(-1).payload.draft, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("published versions are never overwritten", async () => {
  const root = await fixture();
  const mock = api({ published: true });
  try {
    assert.equal(
      (await publishRelease({ ...mock, context, root })).skipped,
      true,
    );
    assert.deepEqual(mock.calls, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("a tag for different source aborts without creating a release", async () => {
  const root = await fixture();
  const mock = api({ conflictingTag: true });
  try {
    await assert.rejects(
      publishRelease({ ...mock, context, root }),
      /different source/,
    );
    assert.deepEqual(mock.calls, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("asset failure leaves the release unpublished", async () => {
  const root = await fixture();
  const mock = api({ failUpload: true });
  try {
    await assert.rejects(
      publishRelease({ ...mock, context, root }),
      /Upload failed/,
    );
    assert.ok(!mock.calls.some((c) => c.name === "publish"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failed draft upload resumes on the same source without creating a duplicate", async () => {
  const root = await fixture();
  const mock = api();
  mock.github.paginate = async () => [
    {
      id: 7,
      tag_name: "ikio-v0.3.1",
      draft: true,
      target_commitish: "verified",
      assets: [{ id: 99, name: "ha-ikio-cards.js" }],
    },
  ];
  try {
    await publishRelease({ ...mock, context, root });
    assert.equal(mock.calls[0].name, "delete");
    assert.equal(mock.calls[0].payload.asset_id, 99);
    assert.ok(!mock.calls.some((call) => call.name === "create"));
    assert.equal(mock.calls.at(-1).name, "publish");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an existing draft from different source cannot be overwritten", async () => {
  const root = await fixture();
  const mock = api();
  mock.github.paginate = async () => [
    {
      id: 7,
      tag_name: "ikio-v0.3.1",
      draft: true,
      target_commitish: "different",
      assets: [],
    },
  ];
  try {
    await assert.rejects(
      publishRelease({ ...mock, context, root }),
      /draft targets different source/,
    );
    assert.deepEqual(mock.calls, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
