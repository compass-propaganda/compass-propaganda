// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { documentGroups, publicDocuments, isPublicDocument, writeMarkdownSources, checkRecommendationLinks } from "./site-documents.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "compass-site-sources-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("publications share one inventory and exclude plans and authoring documents", () => {
  assert(publicDocuments.includes("APPROACH.md"));
  assert(publicDocuments.includes("PRINCIPLES.md"));
  assert.equal(new Set(publicDocuments).size, publicDocuments.length);
  for (const [, entries] of documentGroups) {
    for (const [path] of entries) assert(publicDocuments.includes(path));
  }
  for (const path of ["PLAN.md", "ORACLE.md", "AGENTS.md", "oracle/README.md", "recommendations/TEMPLATE.md", "bulletins/TEMPLATE.md"]) {
    assert(!isPublicDocument(path), path);
  }
});

test("reproduces the missing APPROACH.md dependency and fixes it without altering recommendation bytes", async (t) => {
  const site = await fixture(t);
  const source = "recommendations/004-reciprocity.md";
  const recommendation = Buffer.from('---\r\npn: P2\r\neffect: 현행\r\napproved_by: 돌\r\napproved_at: "2026-09-06"\r\n---\r\n\r\n# 도움\r\n[생활 규칙](../APPROACH.md#생활-규칙과-판단-비용)\r\n');
  const legacy = new Map([
    [source, recommendation],
    ["PRINCIPLES.md", "# 판단 원칙\n"],
    ["TERMINOLOGY.md", "# 용어\n"],
  ]);
  await writeMarkdownSources(site, legacy);
  await assert.rejects(stat(join(site, "APPROACH.md")), { code: "ENOENT" });
  await assert.rejects(checkRecommendationLinks(site, source, recommendation), (error) =>
    error.cause?.code === "ENOENT" && error.message.includes(`${source} -> ../APPROACH.md`));

  const approach = Buffer.from("# 과학적 접근\n\n## 생활 규칙과 판단 비용\n");
  await writeMarkdownSources(site, new Map([...legacy, ["APPROACH.md", approach]]));
  await checkRecommendationLinks(site, source, recommendation);
  assert.deepEqual(await readFile(join(site, source)), recommendation);
  assert.deepEqual(await readFile(join(site, "APPROACH.md")), approach);
});

test("copying public sources never follows links into internal documents", async (t) => {
  const site = await fixture(t);
  const publicSource = "# 과학적 접근\n[실행 규칙](ORACLE.md)\n";
  await writeMarkdownSources(site, new Map([["APPROACH.md", publicSource]]));
  assert.equal(await readFile(join(site, "APPROACH.md"), "utf8"), publicSource);
  await assert.rejects(stat(join(site, "ORACLE.md")), { code: "ENOENT" });
  await assert.rejects(stat(join(site, "PLAN.md")), { code: "ENOENT" });
});

test("invalid or internal publication paths fail before writing any sources", async (t) => {
  const site = await fixture(t);
  for (const path of ["PLAN.md", "recommendations/TEMPLATE.md", "../outside.md", "recommendations/001/../../private.md", "recommendations/001\\..\\private.md"]) {
    await assert.rejects(writeMarkdownSources(site, new Map([
      ["APPROACH.md", "must not be written"], [path, "private"],
    ])), /Not a site publication/);
    await assert.rejects(stat(join(site, "APPROACH.md")), { code: "ENOENT" });
  }
});

test("link checks accept encoded paths, queries and external links but reject escapes and missing files", async (t) => {
  const site = await fixture(t);
  await writeMarkdownSources(site, new Map([
    ["APPROACH.md", "# Methods\n"],
    ["recommendations/006-two words.md", "# Another recommendation\n"],
  ]));
  const source = "recommendations/004-reciprocity.md";
  await checkRecommendationLinks(site, source, [
    "[methods](../APPROACH.md?view=raw#section)",
    "[other](006-two%20words.md)",
    "[remote](https://example.org/paper)",
    "[remote](//example.org/paper)",
    "[anchor](#same-page)",
  ].join("\n"));
  await assert.rejects(checkRecommendationLinks(site, source, "[escape](../../outside.md)"), /leaves the site/);
  await assert.rejects(checkRecommendationLinks(site, source, "[missing](../missing.md)"), /Missing deployed source/);
  await assert.rejects(checkRecommendationLinks(site, source, "[directory](../recommendations/)"), /not a file/);
});
