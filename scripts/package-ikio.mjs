import { readFile, readdir, mkdir, cp, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export async function packageCollection(root = process.cwd()) {
  const version = JSON.parse(
    await readFile(join(root, "ikio/package.json"), "utf8"),
  ).version;
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw Error("Invalid collection version");
  const folder = `ikio-v${version}`;
  const output = join(root, "release", folder);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  // Include the standalone HACS asset and its build notices in manual releases.
  await cp(
    join(root, "dist/ha-ikio-cards.js"),
    join(output, "ha-ikio-cards.js"),
  );
  await cp(join(root, "dist/licenses"), join(output, "licenses"), {
    recursive: true,
  });
  const modules = [];
  for (const name of (await readdir(join(root, "cards"))).sort()) {
    if (!name.startsWith("ikio-")) continue;
    const source = join(root, "cards", name);
    // Verify the entry exists before producing a seemingly installable archive.
    await readFile(join(source, "dist", `${name}.js`));
    await cp(join(source, "dist"), join(output, name), { recursive: true });
    await cp(join(source, "README.md"), join(output, name, "README.md"));
    modules.push(`import './${name}/${name}.js?v=${version}';`);
  }
  if (!modules.length) throw Error("No built Ikio cards found");
  await writeFile(join(output, "ikio.js"), modules.join("\n") + "\n");
  await cp(join(root, "ikio/CHANGELOG.md"), join(output, "CHANGELOG.md"));
  await cp(join(root, "ikio/package.json"), join(output, "package.json"));
  await cp(join(root, "ikio/themes"), join(output, "themes"), {
    recursive: true,
  });
  await cp(join(root, "docs/ikio"), join(output, "design"), {
    recursive: true,
  });
  await writeFile(
    join(output, "README.md"),
    `# Ikio ${version}\n\nCopy ikio.js and the ikio-*-card directories to /config/www/ikio. Add /local/ikio/ikio.js?v=${version} as a JavaScript module in Home Assistant Settings → Dashboards → Resources. Preserve every chunks/ directory. Then Add card → Ikio and configure through the visual editor.\n\nAll cards share appearance tokens and one version. The themes/ikio.yaml global theme is optional. Keep source/ and design documents outside the public www directory. See design/INSTALLATION.md and design/MIGRATION.md for details.\n\nTo reproduce this build, enter source/ and run npm ci && npm run build using Node 24. Native Home Assistant/device compatibility requires live verification.\n`,
  );
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  if (!files.includes("package-lock.json"))
    throw Error("Stage the project source and lockfile before packaging");
  for (const name of files) {
    if (name.startsWith("release/") || name.split("/").includes("node_modules"))
      continue;
    const target = join(output, "source", name);
    await mkdir(resolve(target, ".."), { recursive: true });
    await cp(join(root, name), target);
  }
  const zip = join(root, "release", `${folder}.zip`);
  await rm(zip, { force: true });
  execFileSync("python3", ["-m", "zipfile", "-c", zip, folder], {
    cwd: join(root, "release"),
  });
  return { output, zip };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await packageCollection();
  console.log(result.output);
  console.log(result.zip);
}
