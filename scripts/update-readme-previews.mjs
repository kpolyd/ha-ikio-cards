import { readFile, writeFile } from "node:fs/promises";
import { cards } from "./preview-common.mjs";
const { version } = JSON.parse(await readFile("ikio/package.json", "utf8"));
const base = `https://kpolyd.github.io/ha-ikio-cards/previews/${version}`;
const names = [
  "Lights",
  "Electricity",
  "Vehicle",
  "Alarmo",
  "Server Monitor",
  "Climate",
  "Dehumidifier",
  "Media",
  "Camera",
  "Vacuum",
  "Appliances",
  "Graph",
  "Chip",
  "Router",
  "Weather",
  "Home 3D",
  "Entity",
  "Batteries",
];
const block =
  `<!-- IKIO_PREVIEWS_START -->\n## Card previews · ${version}\n\nActual compiled cards with simulated Home Assistant data. Click an image to open the interactive gallery.\n\n` +
  cards
    .map(
      (c, i) =>
        `### ${names[i]}\n\n[![${names[i]}](${base}/screenshots/${c}/dark-360-normal.png)](${base}/index.html#${c})\n`,
    )
    .join("\n") +
  "<!-- IKIO_PREVIEWS_END -->";
const source = await readFile("README.md", "utf8");
const result = source.includes("<!-- IKIO_PREVIEWS_START -->")
  ? source.replace(
      /<!-- IKIO_PREVIEWS_START -->[\s\S]*?<!-- IKIO_PREVIEWS_END -->/,
      block,
    )
  : source + "\n" + block + "\n";
if (process.argv.includes("--check")) {
  if (result !== source)
    throw Error("Run npm run preview:readme before committing version");
} else await writeFile("README.md", result);
