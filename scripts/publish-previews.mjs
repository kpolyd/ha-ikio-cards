import { readFile, mkdir, cp } from "node:fs/promises";
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
  if (digest(existing) !== digest(candidate))
    throw Error("Refusing to overwrite published version");
  await validatePreview(target, sha, bundle);
} else {
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
}
console.log(target);
