import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** HACS must use raw tagged content, not GitHub release-asset redirects. */
export async function validateHacsBundle(root = process.cwd()) {
  const manifest = JSON.parse(await readFile(`${root}/hacs.json`, "utf8"));
  if (
    manifest.content_in_root !== true ||
    manifest.filename !== "ha-ikio-cards.js" ||
    manifest.zip_release
  )
    throw Error(
      "HACS must install the root ha-ikio-cards.js file without ZIP releases",
    );
  const committed = await readFile(`${root}/${manifest.filename}`);
  const built = await readFile(`${root}/dist/${manifest.filename}`);
  if (!committed.equals(built))
    throw Error(
      "Tracked HACS bundle is stale: run npm run prepare:hacs and commit the result",
    );
  for (const name of new Set([
    "NOTICE.txt",
    "esbuild-LICENSE.md",
    ...(await readdir(`${root}/dist/licenses`)),
  ])) {
    const tracked = await readFile(`${root}/licenses/${name}`);
    const generated = await readFile(`${root}/dist/licenses/${name}`);
    if (!tracked.equals(generated)) throw Error(`Tracked ${name} is stale`);
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await validateHacsBundle();
  console.log(
    "Tracked HACS bundle/notices match the build; raw-file installation configured",
  );
}
