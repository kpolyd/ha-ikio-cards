import { readFile, readdir } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { pathToFileURL } from "node:url";

// Validation only: private workspaces never need a release-version copy.
export async function checkCollectionVersion(root = process.cwd()) {
  const read = async (path) =>
    JSON.parse(await readFile(resolve(root, path), "utf8"));
  const { version } = await read("ikio/package.json");
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
    throw Error("Ikio needs a numeric semantic version");
  const workspaces = new Map();
  for (const parent of ["cards", "packages"])
    for (const name of await readdir(resolve(root, parent))) {
      if (!name.startsWith("ikio-")) continue;
      const dir = `${parent}/${name}`;
      const pkg = await read(`${dir}/package.json`);
      if (!pkg.private || Object.hasOwn(pkg, "version"))
        throw Error(
          `${dir} must be private and omit version; use ikio/package.json`,
        );
      workspaces.set(pkg.name, { dir, pkg });
    }
  const lock = await read("package-lock.json");
  for (const { dir, pkg } of workspaces.values()) {
    const entry = lock.packages[dir];
    if (!entry || Object.hasOwn(entry, "version"))
      throw Error(`${dir} lock entry must exist and omit version`);
    for (const field of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ])
      for (const [name, spec] of Object.entries(pkg[field] || {})) {
        if (!name.startsWith("@ikio/")) continue;
        const target = workspaces.get(name);
        const expected =
          target &&
          `file:${relative(dirname(resolve(root, dir, "package.json")), resolve(root, target.dir)).replaceAll("\\", "/")}`;
        if (!target || spec !== expected || entry[field]?.[name] !== expected)
          throw Error(
            `${dir}: ${name} must use its local workspace file reference in manifest and lockfile`,
          );
        const link = lock.packages[`node_modules/${name}`];
        if (!link?.link || link.resolved !== target.dir)
          throw Error(
            `${name} must resolve to the local workspace in the lockfile`,
          );
      }
  }
  return { version, workspaces: workspaces.size };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = await checkCollectionVersion();
  console.log(
    `Ikio ${result.version}: ${result.workspaces} unversioned private workspaces`,
  );
}
