import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cards, digest, validatePreview } from "../preview-common.mjs";
test("preview inventory and hashes bind captures to exact source", async () => {
  const root = await mkdtemp(join(tmpdir(), "ikio-previews-"));
  try {
    const captures = [];
    await writeFile(join(root, "index.html"), "gallery");
    for (const card of cards)
      for (const theme of ["dark", "light"])
        for (const width of [360, 640])
          for (const scenario of ["normal", "unavailable"]) {
            const file = `${card}-${theme}-${width}-${scenario}.png`;
            await writeFile(join(root, file), "png");
            captures.push({
              card,
              theme,
              width,
              scenario,
              file,
              sha256: digest("png"),
            });
          }
    const manifest = {
      version: "0.6.1",
      sha: "abc",
      bundleHash: digest("bundle"),
      galleryHash: digest("gallery"),
      captures,
    };
    const save = () =>
      writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
    await save();
    assert.equal(
      (await validatePreview(root, "abc", "bundle")).captures.length,
      cards.length * 8,
    );
    await assert.rejects(
      validatePreview(root, "different", "bundle"),
      /mismatch/,
    );
    manifest.captures.pop();
    await save();
    await assert.rejects(validatePreview(root, "abc", "bundle"), /Incomplete/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("publication is idempotent and rejects changed published versions", async () => {
  const { execFileSync } = await import("node:child_process");
  const root = await mkdtemp(join(tmpdir(), "ikio-publish-"));
  const source = join(root, "source");
  try {
    await mkdir(source);
    await writeFile(join(source, "index.html"), "gallery");
    await writeFile(join(root, "bundle.js"), "bundle");
    const captures = [];
    for (const card of cards)
      for (const theme of ["dark", "light"])
        for (const width of [360, 640])
          for (const scenario of ["normal", "unavailable"]) {
            const file = `${card}-${theme}-${width}-${scenario}.png`;
            await writeFile(join(source, file), "png");
            captures.push({
              card,
              theme,
              width,
              scenario,
              file,
              sha256: digest("png"),
            });
          }
    const manifest = {
      version: "0.6.1",
      sha: "abc",
      bundleHash: digest("bundle"),
      galleryHash: digest("gallery"),
      captures,
    };
    await writeFile(join(source, "manifest.json"), JSON.stringify(manifest));
    const run = () =>
      execFileSync(
        process.execPath,
        [
          "scripts/publish-previews.mjs",
          source,
          join(root, "site"),
          "abc",
          join(root, "bundle.js"),
        ],
        { stdio: "pipe" },
      );
    run();
    run();
    manifest.browser = "changed";
    await writeFile(join(source, "manifest.json"), JSON.stringify(manifest));
    assert.throws(run);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
