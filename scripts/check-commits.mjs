import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function checkCommitMessage(message) {
  const header = message.split("\n")[0];
  if (
    !/^(feat|fix|perf|refactor|docs|test|build|ci|chore|style|revert)(\([^()\r\n]+\))?!?: \S.*$/.test(
      header,
    )
  )
    throw Error(`Use a Conventional Commit: ${header}`);
}

export function checkCommits(base, head = "HEAD") {
  const output = execFileSync(
    "git",
    ["log", "--no-merges", "--format=%H%x00%B%x00", `${base}..${head}`],
    { encoding: "utf8" },
  );
  const fields = output.split("\0");
  let count = 0;
  for (let i = 0; i + 1 < fields.length; i += 2) {
    try {
      checkCommitMessage(fields[i + 1]);
    } catch (error) {
      throw Error(`${fields[i].trim().slice(0, 12)}: ${error.message}`);
    }
    count++;
  }
  return { commits: count };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  console.log(
    JSON.stringify(
      checkCommits(process.argv[2] ?? "origin/main", process.argv[3]),
    ),
  );
