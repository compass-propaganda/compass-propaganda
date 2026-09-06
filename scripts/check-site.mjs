// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { parseRecommendations } from "./recommendations.mjs";
import { parseBulletins } from "./bulletins.mjs";
import { publicDocuments, checkRecommendationLinks } from "./site-documents.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const site = join(root, "dist/site");
const publicSite = "https://compass-propaganda.github.io/compass-propaganda/";
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
for (const source of ["PLAN.md", "recommendations/TEMPLATE.md", "ORACLE.md", "AGENTS.md", "oracle/README.md"]) {
  for (const path of [source, source.replace(/\.md$/, ".html")]) {
    await assert.rejects(stat(join(site, path)), { code: "ENOENT" }, `Internal document was published: ${path}`);
  }
}
const terminology = await readFile(join(root, "TERMINOLOGY.md"), "utf8");
const recPaths = (await readdir(join(root, "recommendations")))
  .filter((name) => /^\d+.*\.md$/.test(name))
  .sort()
  .map((name) => `recommendations/${name}`);
const recommendations = parseRecommendations(new Map(await Promise.all(
  recPaths.map(async (path) => [path, await readFile(join(root, path), "utf8")]),
)));
const bySource = new Map(recommendations.map((rec) => [rec.source, rec]));
const escape = (text) => text.replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let links = 0;
for (const page of pages) {
  const html = await readFile(page, "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `Duplicate anchors in ${page}`);
  const path = relative(site, page);
  const canonical = new URL(path === "index.html" ? "./" : path, publicSite).href;
  assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)[1], canonical);
  const metadata = new Map();
  for (const [, key, value] of html.matchAll(/<meta (?:name|property)="([^"]+)" content="([^"]*)"/g)) {
    assert(!metadata.has(key), `Duplicate metadata: ${page} -> ${key}`);
    metadata.set(key, value);
  }
  assert(metadata.get("description")?.trim(), `Missing description: ${page}`);
  assert.equal(metadata.get("og:title"), html.match(/<title>([^<]+)<\/title>/)[1]);
  assert.equal(metadata.get("og:description"), metadata.get("description"));
  assert.equal(metadata.get("og:url"), canonical);
  assert.equal(metadata.get("og:type"), "website");
  const imageUrl = metadata.get("og:image");
  assert(imageUrl?.startsWith(publicSite), `Unexpected sharing image: ${page}`);
  const image = await readFile(join(site, imageUrl.slice(publicSite.length)));
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(Number(metadata.get("og:image:width")), image.readUInt32BE(16));
  assert.equal(Number(metadata.get("og:image:height")), image.readUInt32BE(20));
  assert(metadata.get("og:image:alt")?.trim(), `Missing sharing image description: ${page}`);
  assert.equal(metadata.get("twitter:card"), "summary_large_image");
  for (const key of ["title", "description", "image", "image:alt"]) {
    assert.equal(metadata.get(`twitter:${key}`), metadata.get(`og:${key}`));
  }
  if (/^recommendations\/\d.*\.html$/.test(path)) {
    const rec = bySource.get(path.replace(/\.html$/, ".md"));
    const pn = rec.pn;
    const meaning = terminology.match(
      new RegExp(`^\\| ${pn} \\| (.+?) \\|$`, "m"),
    )[1];
    const badge = html.match(/<a class="pn-badge"[^>]*>([\s\S]*?)<\/a>/)?.[1];
    assert(
      badge?.includes(`>${pn}</span>`) && badge.includes(meaning),
      `Missing Pn code or meaning: ${page}`,
    );
    assert.equal((html.match(/class="pn-badge"/g) || []).length, 1);
    assert(html.includes(`<dt>효력</dt><dd>${escape(rec.effect)}</dd>`));
    const record = html.match(/<details class="recommendation-metadata">([\s\S]*?)<\/details>/)?.[1];
    assert(record?.includes(`<dt>승인</dt><dd>${escape(rec.approvedBy)} · <time datetime="${rec.approved}">`));
    if (rec.author) assert(record.includes(`<dt>작성자</dt><dd>${escape(rec.author)}</dd>`));
    if (rec.writtenAt) assert(record.includes(`<dt>작성일</dt><dd><time datetime="${rec.writtenAt}">`));
    const header = html.match(/<div class="recommendation-metadata">([\s\S]*?)<\/dl><\/div>/)?.[1];
    assert(!/<dt>(승인|작성자|작성일)<\/dt>/.test(header), `Attribution in recommendation header: ${page}`);
    assert(!html.includes("approved_by:"), `Front matter rendered as prose: ${page}`);
    if (rec.replacement) {
      const target = relative(dirname(page), join(site, rec.replacement.replace(/\.md$/, ".html")));
      assert(html.includes(`<dt>대체 권장</dt><dd><a href="${escape(target)}">`));
    }
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
  for (const [tag, raw] of html.matchAll(/<[^>]+\b(?:href|src)="([^"]+)"[^>]*>/g)) {
    if (tag.startsWith("<link ") && tag.includes('rel="canonical"')) continue;
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
const index = await readFile(join(site, "recommendations/index.md"), "utf8");
const indexedPaths = [...index.matchAll(/\[Markdown 원문\]\(([^)]+)\)/g)]
  .map(([, url]) => {
    assert(url.startsWith(publicSite), `Unexpected recommendation origin: ${url}`);
    return url.slice(publicSite.length);
  });
assert.deepEqual([...indexedPaths].sort(), recPaths, "Recommendation index is incomplete or duplicated");
const bulletinPaths = (await readdir(join(root, "bulletins")))
  .filter((name) => /^\d+[^/]*\.md$/.test(name))
  .map((name) => `bulletins/${name}`);
const bulletins = parseBulletins(new Map(await Promise.all(
  bulletinPaths.map(async (path) => [path, await readFile(join(root, path), "utf8")]),
)));
const sourcePaths = [...publicDocuments, ...recPaths, ...bulletins.map((entry) => entry.source)];
for (const source of sourcePaths) {
  const original = await readFile(join(root, source));
  assert.deepEqual(await readFile(join(site, source)), original, `Altered source: ${source}`);
  if (recPaths.includes(source)) {
    const entry = index.split(/^## /m).find((part) => part.includes(`${publicSite}${source})`));
    assert(entry.includes(createHash("sha256").update(original).digest("hex")), `Wrong content hash: ${source}`);
    const rec = bySource.get(source);
    const effect = rec.effect;
    assert(entry.includes(`- 효력: ${effect}\n`), `Wrong effect: ${source}`);
    assert(entry.includes(`- 승인자: ${rec.approvedBy}\n`), `Wrong approver: ${source}`);
    assert(entry.includes(`- 승인일: ${rec.approved}\n`), `Wrong approval date: ${source}`);
    const home = await readFile(join(site, "index.html"), "utf8");
    assert.equal(home.includes(`href="${source.replace(/\.md$/, ".html")}"`), effect === "현행", `Incorrect home recommendation: ${source}`);
    if (rec.replacement) {
      assert(entry.includes(`[대체 권장](${publicSite}${rec.replacement})`), `Wrong replacement: ${source}`);
    }
    await checkRecommendationLinks(site, source, original);
  }
}
for (const [, url] of index.matchAll(/\]\(([^)]+)\)/g)) {
  if (url.startsWith(publicSite)) {
    assert((await stat(join(site, url.slice(publicSite.length)))).isFile());
  }
}
assert.equal(await readFile(join(site, "setup-oracle/oracle.md"), "utf8"), prompt);
assert.equal(
  await readFile(join(site, "setup-oracle/install.md"), "utf8"),
  await readFile(join(root, "oracle/prompts/install.md"), "utf8"),
);
const archive = join(site, "setup-oracle/compass-propaganda.zip");
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
  `Verified ${pages.length} HTML pages, ${links} local links, ${sourcePaths.length} published Markdown sources, ${recPaths.length} indexed recommendations, and oracle setup artifacts.`,
);
