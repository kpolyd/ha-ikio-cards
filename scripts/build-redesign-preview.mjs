import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
const root = resolve(import.meta.dirname, "..");
const types = ["climate", "media", "vacuum", "server-monitor", "graph"];
const entry =
  types.map((t) => `import './cards/ikio-${t}-card/src/index.js';`).join("\n") +
  "\nimport './dev/previews/redesign.js';";
const built = await build({
  stdin: { contents: entry, resolveDir: root, loader: "js" },
  bundle: true,
  format: "iife",
  platform: "browser",
  write: false,
  minify: true,
});
const template = await readFile(
  resolve(root, "dev/previews/redesign.html"),
  "utf8",
);
const notices = await readFile(
  resolve(root, "dev/previews/MDI-LICENSE.txt"),
  "utf8",
);
const apache = await readFile(
  resolve(root, "dev/previews/APACHE-2.0.txt"),
  "utf8",
);
const output = resolve(
  process.argv[2] || resolve(root, "dist/Ikio-Redesign-Mocks.html"),
);
const code = built.outputFiles[0].text.replaceAll("</script", "<\\/script");
const licenseScript = `document.querySelector('#licenses').textContent=${JSON.stringify(notices + "\n\n" + apache).replaceAll("<", "\\u003c")};`;
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  template.replace(
    "<!-- IKIO_PREVIEW_SCRIPT -->",
    `<script>${code}</script><script>${licenseScript}</script>`,
  ),
);
console.log(output);
