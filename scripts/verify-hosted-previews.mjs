import { readFile } from "node:fs/promises";
const manifest = JSON.parse(
  await readFile("dist/previews/manifest.json", "utf8"),
);
const base = `https://kpolyd.github.io/ha-ikio-cards/previews/${manifest.version}`;
let error;
for (let attempt = 0; attempt < 12; attempt++) {
  try {
    const response = await fetch(`${base}/manifest.json`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("Manifest HTTP " + response.status);
    const hosted = await response.json();
    if (
      hosted.sha !== manifest.sha ||
      hosted.bundleHash !== manifest.bundleHash
    )
      throw Error("Hosted identity mismatch");
    for (const path of ["index.html", manifest.captures[0].file]) {
      const r = await fetch(`${base}/${path}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw Error("Missing hosted " + path);
    }
    error = undefined;
    break;
  } catch (e) {
    error = e;
    if (attempt < 11) await new Promise((r) => setTimeout(r, 5000));
  }
}
if (error) throw error;
