import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const out = resolve(process.env.PREVIEW_OUTPUT || "dist/previews");
const root = resolve(process.env.PREVIEW_SOURCE || ".");
const bundle = await readFile(`${root}/dist/ha-ikio-cards.js`, "utf8");
const fixture = await build({
  entryPoints: ["dev/previews/fixtures/collection.js"],
  bundle: true,
  write: false,
  format: "iife",
  loader: { ".png": "dataurl" },
});
const source = await readFile("dev/previews/collection.html", "utf8");
const shell = source.slice(0, source.indexOf('<script type="module">'));
const fixed = Date.parse("2026-10-26T12:00:00Z");
const html =
  shell +
  `<p>Actual compiled cards with simulated Home Assistant data. Native HA controls are represented by local substitutes.</p><script>Date.now=()=>${fixed};</script><script type="module">${(bundle + "\n" + fixture.outputFiles[0].text).replaceAll("</script", "<\\/script")}</script></html>`;
await mkdir(out, { recursive: true });
await writeFile(`${out}/index.html`, html);
await writeFile(
  `${out}/LICENSES.txt`,
  (await readFile("dev/previews/MDI-LICENSE.txt", "utf8")) +
    (await readFile("dev/previews/APACHE-2.0.txt", "utf8")),
);
console.log(out);
