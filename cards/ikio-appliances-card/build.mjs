import { build } from "esbuild";
await build({
  entryPoints: ["src/index.js"],
  bundle: true,
  format: "esm",
  splitting: true,
  outdir: "dist",
  entryNames: "ikio-appliances-card",
  chunkNames: "chunks/[name]-[hash]",
  target: "es2020",
  minify: true,
  legalComments: "eof",
  metafile: true,
}).then(async (result) => {
  const { writeFile, mkdir, copyFile } = await import("node:fs/promises");
  await mkdir("dist/licenses", { recursive: true });
  await copyFile(
    new URL("../LICENSE.md", import.meta.resolve("esbuild")),
    "dist/licenses/esbuild-LICENSE.md",
  );
  await writeFile(
    "dist/licenses/NOTICE.txt",
    "Ikio Appliances has no runtime third-party JavaScript dependencies. Built with esbuild (MIT).\n",
  );
  await writeFile(
    "dist/build-meta.json",
    JSON.stringify(result.metafile, null, 2),
  );
});
