// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const site = join(root, "dist/site");
async function htmlFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith(".html")) result.push(path);
  }
  return result;
}
const pages = await htmlFiles(site);
let links = 0;
for (const page of pages) {
  const html = await readFile(page, "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `Duplicate anchors in ${page}`);
  for (const [, raw] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(raw)) continue;
    const [path, anchor] = raw.split("#");
    const target = path
      ? resolve(dirname(page), decodeURIComponent(path))
      : page;
    const info = await stat(target);
    assert(info.isFile(), `Not a file: ${target}`);
    if (anchor && target.endsWith(".html")) {
      const content = await readFile(target, "utf8");
      assert(
        content.includes(`id="${decodeURIComponent(anchor)}"`),
        `Missing anchor: ${page} -> ${raw}`,
      );
    }
    links++;
  }
}
const prompt = await readFile(join(root, "dist/oracle.md"), "utf8");
assert.equal(await readFile(join(site, "downloads/oracle.md"), "utf8"), prompt);
const archive = join(site, "downloads/compass-propaganda.zip");
const entries = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" })
  .trim()
  .split("\n")
  .sort();
assert.deepEqual(entries, [
  "compass-propaganda/SKILL.md",
  "compass-propaganda/references/oracle.md",
]);
assert.equal(
  execFileSync(
    "unzip",
    ["-p", archive, "compass-propaganda/references/oracle.md"],
    { encoding: "utf8" },
  ),
  prompt,
);
assert.equal(
  execFileSync("unzip", ["-p", archive, "compass-propaganda/SKILL.md"], {
    encoding: "utf8",
  }),
  await readFile(join(root, "oracle/SKILL.md"), "utf8"),
);
console.log(
  `Verified ${pages.length} HTML pages, ${links} local links, and both oracle downloads.`,
);
