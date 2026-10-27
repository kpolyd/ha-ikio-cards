import { build } from "esbuild";
import {
  readdir,
  readFile,
  mkdir,
  copyFile,
  writeFile,
} from "node:fs/promises";
const { version } = JSON.parse(await readFile("ikio/package.json", "utf8"));
const cards = (await readdir("cards"))
  .filter((name) => name.startsWith("ikio-"))
  .sort();
if (cards.length !== 12) throw Error("Expected all twelve Ikio cards");
// Bundle dynamic editor imports into this file too: HACS downloads one asset.
// The editors still initialize only when getConfigElement() is called.
const result = await build({
  stdin: {
    contents: cards
      .map((name) => `import './cards/${name}/src/index.js';`)
      .join("\n"),
    resolveDir: process.cwd(),
    sourcefile: "ikio-collection-entry.js",
  },
  bundle: true,
  format: "esm",
  splitting: false,
  outfile: "dist/ha-ikio-cards.js",
  target: "es2020",
  minify: true,
  legalComments: "inline",
  banner: {
    js: `/* Ikio Cards ${version} | https://github.com/kpolyd/ha-ikio-cards */`,
  },
  metafile: true,
});
if (
  Object.values(result.metafile.outputs).some((output) => output.imports.length)
)
  throw Error("The HACS bundle must not depend on other files");
await mkdir("dist/licenses", { recursive: true });
await copyFile(
  new URL("../LICENSE.md", import.meta.resolve("esbuild")),
  "dist/licenses/esbuild-LICENSE.md",
);
await writeFile(
  "dist/licenses/NOTICE.txt",
  "Ikio Cards has no runtime third-party JavaScript dependencies. Built with esbuild (MIT).\n",
);
console.log(
  `Ikio ${version}: twelve cards and editors in dist/ha-ikio-cards.js`,
);

// HACS reads this tracked file from the selected release tag through raw GitHub.
if (process.argv.includes("--write")) {
  await copyFile("dist/ha-ikio-cards.js", "ha-ikio-cards.js");
  await mkdir("licenses", { recursive: true });
  for (const name of ["NOTICE.txt", "esbuild-LICENSE.md"])
    await copyFile(`dist/licenses/${name}`, `licenses/${name}`);
  console.log("Updated tracked HACS bundle and notices");
}
