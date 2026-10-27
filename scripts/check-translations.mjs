import { catalogs } from "../packages/ikio-card-ui/src/translations/index.js";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(
  new URL("../packages/ikio-card-ui/src/translations/", import.meta.url),
);
const files = (await readdir(root)).filter((f) => f.endsWith(".json"));
for (const file of files)
  if (!Object.hasOwn(catalogs, file.slice(0, -5).toLowerCase()))
    throw Error(`${file}: register this catalog in translations/index.js`);
const en = JSON.parse(await readFile(resolve(root, "en.json"), "utf8"));
const placeholders = (s) =>
  [...String(s).matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",");
for (const file of files) {
  const catalog = JSON.parse(await readFile(resolve(root, file), "utf8"));
  for (const key of Object.keys(catalog))
    if (!Object.hasOwn(en, key)) throw Error(`${file}: unknown message ${key}`);
  for (const [key, english] of Object.entries(en)) {
    if (!Object.hasOwn(catalog, key)) throw Error(`${file}: missing ${key}`);
    const value = catalog[key];
    if (typeof value !== typeof english || !value)
      throw Error(`${file}: invalid ${key}`);
    const forms = typeof value === "string" ? [value] : Object.values(value);
    if (typeof value === "object" && (!value.one || !value.other))
      throw Error(`${file}: ${key} needs one and other forms`);
    const expected = placeholders(
      typeof english === "string" ? english : english.other,
    );
    for (const text of forms)
      if (
        typeof text !== "string" ||
        !text.trim() ||
        placeholders(text) !== expected
      )
        throw Error(`${file}: placeholder mismatch in ${key}`);
  }
}
console.log(
  `${files.length} translation catalogs validated (${Object.keys(en).length} messages each).`,
);
// Catch newly added literal messages before they can silently fall back to English.
const repository = fileURLToPath(new URL("../", import.meta.url));
async function checkSources(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        ["src", "cards", "packages"].includes(entry.name) ||
        entry.name.startsWith("ikio-")
      )
        await checkSources(path);
    } else if (entry.name.endsWith(".js")) {
      const source = await readFile(path, "utf8");
      for (const match of source.matchAll(
        /\bt\(\s*[^,]+,\s*("(?:[^"\\]|\\.)*")/g,
      )) {
        const key = JSON.parse(match[1]);
        if (!Object.hasOwn(en, key))
          throw Error(`${path}: unregistered translation ${key}`);
      }
    }
  }
}
await checkSources(resolve(repository, "cards"));
await checkSources(resolve(repository, "packages"));
