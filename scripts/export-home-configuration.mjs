// Run against trusted local configuration modules from your private repository.
// This tool writes JSON beside your private files; it never uploads them.
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { resolveConfiguration } from "../cards/ikio-home-3d-card/src/resolve-configuration.js";
export async function exportHomeConfiguration({
  homeModel,
  entityInventory,
  deviceBindings,
  output,
}) {
  const definitions = await Promise.all(
    [homeModel, entityInventory, deviceBindings].map(
      (path) => import(pathToFileURL(resolve(path)).href),
    ),
  );
  const values = [
    definitions[0].homeModel,
    definitions[1].entityInventory,
    definitions[2].deviceBindings,
  ];
  resolveConfiguration(...values);
  const folder = resolve(output);
  await mkdir(folder, { recursive: true });
  const files = ["home-model.json", "entities.json", "device-bindings.json"];
  await Promise.all(
    files.map((name, index) =>
      writeFile(
        join(folder, name),
        JSON.stringify(values[index], null, 2) + "\n",
      ),
    ),
  );
  return files.map((name) => join(folder, name));
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [homeModel, entityInventory, deviceBindings, output] =
    process.argv.slice(2);
  if (!homeModel || !entityInventory || !deviceBindings || !output)
    throw Error(
      "Usage: node scripts/export-home-configuration.mjs HOME_MODEL_JS ENTITIES_JS DEVICE_BINDINGS_JS OUTPUT_DIRECTORY",
    );
  console.log(
    (
      await exportHomeConfiguration({
        homeModel,
        entityInventory,
        deviceBindings,
        output,
      })
    ).join("\n"),
  );
}
