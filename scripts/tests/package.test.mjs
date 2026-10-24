import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { packageCollection } from "../package-ikio.mjs";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "ikio-package-"));
  const files = {
    "package.json": '{"workspaces":["cards/*","packages/*"]}',
    "package-lock.json": '{"lockfileVersion":3}',
    "ikio/package.json": '{"version":"0.3.0"}',
    "ikio/CHANGELOG.md": "# Changes",
    "ikio/themes/ikio.yaml": "Ikio Dark: {}",
    "docs/ikio/INSTALLATION.md": "# Install",
    "cards/ikio-light-card/README.md": "# Lights",
    "cards/ikio-light-card/src/index.js": "// source",
    "scripts/ikio-version.mjs": "// version",
  };
  for (const [name, value] of Object.entries(files)) {
    await mkdir(join(root, name, ".."), { recursive: true });
    await writeFile(join(root, name), value);
  }
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  await mkdir(join(root, "cards/ikio-light-card/dist/chunks"), {
    recursive: true,
  });
  await mkdir(join(root, "cards/ikio-light-card/dist/licenses"), {
    recursive: true,
  });
  await writeFile(
    join(root, "cards/ikio-light-card/dist/ikio-light-card.js"),
    "import './chunks/editor.js';",
  );
  await writeFile(
    join(root, "cards/ikio-light-card/dist/chunks/editor.js"),
    "// editor",
  );
  await writeFile(
    join(root, "cards/ikio-light-card/dist/licenses/NOTICE.txt"),
    "Notice",
  );
  await mkdir(join(root, "dist/licenses"), { recursive: true });
  await writeFile(
    join(root, "dist/ha-ikio-cards.js"),
    "// combined HACS bundle",
  );
  await writeFile(join(root, "dist/licenses/NOTICE.txt"), "Notice");
  await writeFile(join(root, "private-untracked.txt"), "not for distribution");
  return root;
}

test("distribution preserves lazy chunks/notices and includes only tracked reproducible source", async () => {
  const root = await fixture();
  try {
    const { output, zip } = await packageCollection(root);
    assert.match(
      await readFile(join(output, "ikio.js"), "utf8"),
      /ikio-light-card\.js\?v=0\.3\.0/,
    );
    const entries = JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          "import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps(z.namelist()))",
          zip,
        ],
        { encoding: "utf8" },
      ),
    );
    for (const name of [
      "ikio.js",
      "ha-ikio-cards.js",
      "licenses/NOTICE.txt",
      "ikio-light-card/chunks/editor.js",
      "ikio-light-card/licenses/NOTICE.txt",
      "themes/ikio.yaml",
      "design/INSTALLATION.md",
      "source/package-lock.json",
      "source/cards/ikio-light-card/src/index.js",
      "source/scripts/ikio-version.mjs",
    ])
      assert.ok(entries.includes(`ikio-v0.3.0/${name}`), name);
    assert.ok(
      !entries.some(
        (name) =>
          name.includes("private-untracked") ||
          name.includes(".git/") ||
          name.includes("source/release/"),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing built card entry fails packaging instead of silently shipping an unusable loader", async () => {
  const root = await fixture();
  try {
    await rm(join(root, "cards/ikio-light-card/dist/ikio-light-card.js"));
    await assert.rejects(packageCollection(root), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
