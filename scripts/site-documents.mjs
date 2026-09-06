// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

// One publication list drives both HTML pages and their byte-preserving sources.
export const documentGroups = [
  ["입문과 교리", [
    ["ONBOARDING.md", "입문 안내"],
    ["PRINCIPLES.md", "판단 원칙"],
    ["TERMINOLOGY.md", "용어"],
  ]],
  ["탐구", [
    ["APPROACH.md", "과학적 접근"],
    ["PROPHETS.md", "선지자들"],
    ["REFERENCES.md", "참고 자료"],
  ]],
  ["운영", [
    ["GOVERNANCE.md", "운영과 참여"],
    ["AI.md", "AI 활용"],
  ]],
];

export const publicDocuments = [
  ...documentGroups.flatMap(([, entries]) => entries.map(([path]) => path)),
  "README.md",
  "LICENSE.md",
];

export function isPublicDocument(path) {
  return publicDocuments.includes(path) ||
    /^(?:recommendations|bulletins)\/\d+[^/\\]*\.md$/.test(path);
}

// The caller includes only published bulletins. Never crawl linked repository files:
// plans, authoring templates and implementation documents are not site publications.
export async function writeMarkdownSources(output, sources) {
  for (const path of sources.keys()) {
    assert(isPublicDocument(path), `Not a site publication: ${path}`);
  }
  for (const [path, content] of sources) {
    const destination = resolve(output, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
}

export async function checkRecommendationLinks(site, source, content) {
  for (const [, href] of content.toString().matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(href)) continue;
    const path = decodeURIComponent(href.split(/[?#]/)[0]);
    const target = resolve(site, dirname(source), path);
    const local = relative(resolve(site), target);
    assert(local !== ".." && !local.startsWith(`..${sep}`) && !isAbsolute(local),
      `Source link leaves the site: ${source} -> ${href}`);
    let info;
    try {
      info = await stat(target);
    } catch (cause) {
      throw new Error(`Missing deployed source: ${source} -> ${href}`, { cause });
    }
    assert(info.isFile(), `Source link is not a file: ${source} -> ${href}`);
  }
}
