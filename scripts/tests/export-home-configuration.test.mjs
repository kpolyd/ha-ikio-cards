import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportHomeConfiguration } from "../export-home-configuration.mjs";
import {
  home,
  inventory,
  devices,
} from "../../cards/ikio-home-3d-card/tests/fixtures/studio.js";
test("exports trusted local configuration modules to three equivalent JSON files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ikio-home-export-"));
  try {
    const names = ["homeModel", "entityInventory", "deviceBindings"],
      values = [home, inventory, devices];
    const files = names.map((name) => join(dir, name + ".mjs"));
    await Promise.all(
      files.map((file, i) =>
        writeFile(
          file,
          `export const ${names[i]} = ${JSON.stringify(values[i])};`,
        ),
      ),
    );
    const outputs = await exportHomeConfiguration({
      homeModel: files[0],
      entityInventory: files[1],
      deviceBindings: files[2],
      output: join(dir, "json"),
    });
    assert.equal(outputs.length, 3);
    assert.deepEqual(
      await Promise.all(
        outputs.map(async (f) => JSON.parse(await readFile(f, "utf8"))),
      ),
      values,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
