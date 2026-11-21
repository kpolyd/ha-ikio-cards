import { readFile, mkdir, cp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { validatePreview, digest } from "./preview-common.mjs";
const [source, site, sha, bundlePath] = process.argv.slice(2);
const bundle = await readFile(bundlePath);
const manifest = await validatePreview(source, sha, bundle);
const target = resolve(site, "previews", manifest.version);
let existing;
try {
  existing = await readFile(`${target}/manifest.json`);
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const candidate = await readFile(`${source}/manifest.json`);
if (existing) {
  if (digest(existing) === digest(candidate)) {
    await validatePreview(target, sha, bundle);
  } else {
    if (process.env.IKIO_UNTAGGED_PREVIEW !== "true")
      throw Error("Refusing to overwrite published version");
    // A failed Pages deployment can leave an untagged preview on gh-pages.
    // Only refresh it when the existing preview was built from the same bundle.
    await validatePreview(target, JSON.parse(existing).sha, bundle);
    await rm(target, { recursive: true });
    existing = undefined;
  }
}
if (!existing) {
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
}
console.log(target);
