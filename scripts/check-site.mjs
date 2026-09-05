// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

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
const terminology = await readFile(join(root, "TERMINOLOGY.md"), "utf8");
let links = 0;
for (const page of pages) {
  const html = await readFile(page, "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `Duplicate anchors in ${page}`);
  const path = relative(site, page);
  if (/^recommendations\/\d.*\.html$/.test(path)) {
    const source = await readFile(
      join(root, path.replace(/\.html$/, ".md")),
      "utf8",
    );
    const pn = source.match(/^Pn: \[(P[1-5])\]/m)[1];
    const meaning = terminology.match(
      new RegExp(`^\\| ${pn} \\| (.+?) \\|$`, "m"),
    )[1];
    const badge = html.match(/<a class="pn-badge"[^>]*>([\s\S]*?)<\/a>/)?.[1];
    assert(
      badge?.includes(`>${pn}</span>`) && badge.includes(meaning),
      `Missing Pn code or meaning: ${page}`,
    );
  }
  const navigation = html.match(
    /<nav aria-label="차례">([\s\S]*?)<\/nav>/,
  )?.[1];
  if (navigation) {
    const entries = [...navigation.matchAll(/<a href="([^"]+)"([^>]*)>/g)];
    for (const [, href, attributes] of entries) {
      const target = resolve(dirname(page), href);
      if (target === page) {
        assert(
          attributes.includes('aria-current="page"'),
          `Missing current page: ${page}`,
        );
      } else if (attributes.includes('aria-current="page"')) {
        assert.fail(`Incorrect current page: ${page} -> ${href}`);
      }
    }
    if (
      relative(site, page).startsWith("recommendations/") &&
      !page.endsWith("/index.html")
    ) {
      const parent = entries.find(
        ([, href]) =>
          resolve(dirname(page), href) ===
          join(site, "recommendations/index.html"),
      );
      assert(
        parent?.[2].includes('aria-current="location"'),
        `Missing recommendation location: ${page}`,
      );
    }
  }
  for (const [, raw] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    assert(
      !raw.startsWith("https://compass-propaganda.github.io/compass-propaganda/"),
      `Internal site link leaves the current deployment: ${page} -> ${raw}`,
    );
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
const recPaths = (await readdir(join(root, "recommendations")))
  .filter((name) => /^\d+.*\.md$/.test(name))
  .sort()
  .map((name) => `recommendations/${name}`);
const index = await readFile(join(site, "recommendations/index.md"), "utf8");
const publicSite = "https://compass-propaganda.github.io/compass-propaganda/";
const indexedPaths = [...index.matchAll(/\[Markdown 원문\]\(([^)]+)\)/g)]
  .map(([, url]) => {
    assert(url.startsWith(publicSite), `Unexpected recommendation origin: ${url}`);
    return url.slice(publicSite.length);
  });
assert.deepEqual([...indexedPaths].sort(), recPaths, "Recommendation index is incomplete or duplicated");
for (const source of [...recPaths, "PRINCIPLES.md", "TERMINOLOGY.md"]) {
  const original = await readFile(join(root, source));
  assert.deepEqual(await readFile(join(site, source)), original, `Altered source: ${source}`);
  if (recPaths.includes(source)) {
    const entry = index.split(/^## /m).find((part) => part.includes(`${publicSite}${source})`));
    assert(entry.includes(createHash("sha256").update(original).digest("hex")), `Wrong content hash: ${source}`);
    // Raw recommendation links must still reach their shared criteria.
    for (const [, href] of original.toString().matchAll(/\]\((\.\.[^)]+)\)/g)) {
      assert((await stat(resolve(site, dirname(source), href.split("#")[0]))).isFile());
    }
  }
}
for (const [, url] of index.matchAll(/\]\(([^)]+)\)/g)) {
  if (url.startsWith(publicSite)) {
    assert((await stat(join(site, url.slice(publicSite.length)))).isFile());
  }
}
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
  `Verified ${pages.length} HTML pages, ${links} local links, ${recPaths.length} indexed recommendation sources, and both oracle downloads.`,
);
