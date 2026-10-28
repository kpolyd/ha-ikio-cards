import { build } from "esbuild";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
await build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: "dist",
  entryNames: "ikio-home-3d-card",
  chunkNames: "chunks/[name]-[hash]",
  target: "es2020",
  minify: true,
  loader: { ".css": "text" },
  legalComments: "eof",
  metafile: true,
}).then(async (result) => {
  await mkdir("dist/licenses", { recursive: true });
  await copyFile(
    "licenses/Three-LICENSE.txt",
    "dist/licenses/Three-LICENSE.txt",
  );
  await copyFile(
    new URL("../LICENSE.md", import.meta.resolve("esbuild")),
    "dist/licenses/esbuild-LICENSE.md",
  );
  await writeFile(
    "dist/licenses/NOTICE.txt",
    "Ikio Home 3D bundles Three.js (MIT). Built with esbuild (MIT). Personal model and entity configuration are not included.\n",
  );
  await writeFile(
    "dist/build-meta.json",
    JSON.stringify(result.metafile, null, 2),
  );
});
