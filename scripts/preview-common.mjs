import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
export const cards = [
  "lights",
  "electricity",
  "vehicle",
  "alarmo",
  "server-monitor",
  "climate",
  "media",
  "camera",
  "vacuum",
  "appliances",
  "graph",
];
export const digest = (b) => createHash("sha256").update(b).digest("hex");
export async function validatePreview(folder, sha, bundle) {
  const manifest = JSON.parse(
    await readFile(`${folder}/manifest.json`, "utf8"),
  );
  if (manifest.sha !== sha || manifest.bundleHash !== digest(bundle))
    throw Error("Preview source/bundle mismatch");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version))
    throw Error("Invalid preview version");
  if (manifest.galleryHash !== digest(await readFile(`${folder}/index.html`)))
    throw Error("Gallery hash mismatch");
  const keys = new Set();
  for (const capture of manifest.captures) {
    const path = resolve(folder, capture.file);
    if (!path.startsWith(resolve(folder) + sep))
      throw Error("Invalid capture path");
    if (capture.sha256 !== digest(await readFile(path)))
      throw Error("Capture hash mismatch");
    keys.add(
      `${capture.card}/${capture.theme}/${capture.width}/${capture.scenario}`,
    );
  }
  for (const card of cards)
    for (const theme of ["dark", "light"])
      for (const width of [360, 640])
        for (const scenario of ["normal", "unavailable"])
          if (!keys.has(`${card}/${theme}/${width}/${scenario}`))
            throw Error("Incomplete preview inventory");
  return manifest;
}
