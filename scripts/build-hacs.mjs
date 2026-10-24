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
if (cards.length !== 11) throw Error("Expected all eleven Ikio cards");
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
  `Ikio ${version}: eleven cards and editors in dist/ha-ikio-cards.js`,
);
