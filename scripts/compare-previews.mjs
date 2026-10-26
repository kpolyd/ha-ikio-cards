import { readFile, mkdir, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
const [base, head, out = "dist/previews/comparison"] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const a = JSON.parse(await readFile(`${base}/manifest.json`, "utf8")),
  b = JSON.parse(await readFile(`${head}/manifest.json`, "utf8"));
const results = [];
for (const capture of b.captures) {
  const old = a.captures.find((x) => x.file === capture.file);
  if (!old) {
    results.push({ ...capture, status: "added" });
    continue;
  }
  const before = PNG.sync.read(await readFile(`${base}/${old.file}`)),
    after = PNG.sync.read(await readFile(`${head}/${capture.file}`));
  const width = Math.max(before.width, after.width),
    height = Math.max(before.height, after.height);
  const pad = (img) => {
    const canvas = new PNG({ width, height });
    PNG.bitblt(img, canvas, 0, 0, img.width, img.height, 0, 0);
    return canvas;
  };
  const diff = new PNG({ width, height });
  const changed = pixelmatch(
    pad(before).data,
    pad(after).data,
    diff.data,
    width,
    height,
    { threshold: 0.1 },
  );
  const name = capture.file.replaceAll("/", "-");
  await writeFile(`${out}/before-${name}`, PNG.sync.write(before));
  await writeFile(`${out}/after-${name}`, PNG.sync.write(after));
  await writeFile(`${out}/diff-${name}`, PNG.sync.write(diff));
  results.push({
    file: capture.file,
    changed,
    width,
    height,
    status: changed ? "changed" : "same",
  });
}
for (const old of a.captures)
  if (!b.captures.some((x) => x.file === old.file))
    results.push({ file: old.file, status: "removed" });
await writeFile(
  `${out}/report.json`,
  JSON.stringify({ base: a.sha, head: b.sha, results }, null, 2),
);
await writeFile(
  `${out}/index.html`,
  "<!doctype html><title>Preview comparison</title><h1>Before / After / Difference</h1>" +
    results
      .filter((r) => r.status === "changed")
      .map(
        (r) =>
          `<h2>${r.file}</h2>` +
          ["before", "after", "diff"]
            .map(
              (p) =>
                `<img style="max-width:32%" src="${p}-${r.file.replaceAll("/", "-")}" alt="${p}">`,
            )
            .join(""),
      )
      .join(""),
);
