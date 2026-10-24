import { readFile, writeFile, readdir } from "node:fs/promises";
const read = async (path) => JSON.parse(await readFile(path, "utf8"));
const version = (await read("ikio/package.json")).version;
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
  throw Error("Ikio needs a numeric semantic version");
const paths = [];
for (const root of ["cards", "packages"])
  for (const name of await readdir(root))
    if (name.startsWith("ikio-")) paths.push(`${root}/${name}/package.json`);
const check = process.argv.includes("--check");
for (const path of paths) {
  const value = await read(path);
  if (check) {
    if (value.version !== version) throw Error(`${path} must use ${version}`);
    for (const [name, v] of Object.entries(value.dependencies || {}))
      if (name.startsWith("@ikio/") && v !== version)
        throw Error(`${path}: ${name} must use ${version}`);
  } else {
    value.version = version;
    for (const name of Object.keys(value.dependencies || {}))
      if (name.startsWith("@ikio/")) value.dependencies[name] = version;
    await writeFile(path, JSON.stringify(value, null, 2) + "\n");
  }
}
const lock = await read("package-lock.json");
for (const path of paths) {
  const dir = path.replace("/package.json", "");
  if (check) {
    if (lock.packages[dir]?.version !== version)
      throw Error(`${dir} lock version must use ${version}`);
  } else if (lock.packages[dir]) {
    const pkg = await read(path);
    lock.packages[dir].version = version;
    if (pkg.dependencies) lock.packages[dir].dependencies = pkg.dependencies;
  }
}
if (!check)
  await writeFile("package-lock.json", JSON.stringify(lock, null, 2) + "\n");
console.log(`Ikio ${version}: ${paths.length} synchronized packages`);
