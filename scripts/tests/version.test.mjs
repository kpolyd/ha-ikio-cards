import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkCollectionVersion } from "../ikio-version.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "ikio-version-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    "ikio/package.json": { version: "0.6.4" },
    "cards/ikio-example/package.json": {
      name: "@ikio/example",
      private: true,
      dependencies: { "@ikio/shared": "file:../../packages/ikio-shared" },
    },
    "packages/ikio-shared/package.json": {
      name: "@ikio/shared",
      private: true,
    },
    "package-lock.json": {
      packages: {
        "cards/ikio-example": {
          dependencies: { "@ikio/shared": "file:../../packages/ikio-shared" },
        },
        "packages/ikio-shared": {},
        "node_modules/@ikio/shared": {
          resolved: "packages/ikio-shared",
          link: true,
        },
      },
    },
  };
  for (const [path, value] of Object.entries(files)) {
    await mkdir(join(root, path, ".."), { recursive: true });
    await writeFile(join(root, path), JSON.stringify(value));
  }
  return {
    root,
    files,
    write: (path) => writeFile(join(root, path), JSON.stringify(files[path])),
  };
}

test("changing the collection version requires no workspace changes", async (t) => {
  const f = await fixture(t);
  f.files["ikio/package.json"].version = "0.7.0";
  await f.write("ikio/package.json");
  const before = await readFile(join(f.root, "package-lock.json"), "utf8");
  assert.deepEqual(await checkCollectionVersion(f.root), {
    version: "0.7.0",
    workspaces: 2,
  });
  assert.equal(
    await readFile(join(f.root, "package-lock.json"), "utf8"),
    before,
  );
});

test("duplicate workspace versions are rejected", async (t) => {
  const f = await fixture(t);
  f.files["cards/ikio-example/package.json"].version = "0.6.4";
  await f.write("cards/ikio-example/package.json");
  await assert.rejects(checkCollectionVersion(f.root), /omit version/);
});

test("registry dependency specs and non-local lock resolutions are rejected", async (t) => {
  const f = await fixture(t);
  f.files["cards/ikio-example/package.json"].dependencies["@ikio/shared"] = "*";
  await f.write("cards/ikio-example/package.json");
  await assert.rejects(
    checkCollectionVersion(f.root),
    /local workspace file reference/,
  );
  f.files["cards/ikio-example/package.json"].dependencies["@ikio/shared"] =
    "file:../../packages/ikio-shared";
  await f.write("cards/ikio-example/package.json");
  f.files["package-lock.json"].packages["node_modules/@ikio/shared"].link =
    false;
  await f.write("package-lock.json");
  await assert.rejects(
    checkCollectionVersion(f.root),
    /resolve to the local workspace/,
  );
});
