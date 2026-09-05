// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecommendations } from "./recommendations.mjs";

function document(effect = "현행", replacement = "", date = "2026-09-05") {
  return `# 권장\n\nPn: [P3](../TERMINOLOGY.md#pn-룰)\n\n효력: ${effect}\n${replacement ? `대체 권장: [후속 권장](${replacement})\n` : ""}\n## 권장\n\n권장 내용.\n\n- 승인: 돌, ${date}.\n`;
}
const a = "recommendations/001-a.md";
const b = "recommendations/002-b.md";
const c = "recommendations/003-c.md";

test("keeps withdrawal and replacement history while ordering by approval date", () => {
  const records = parseRecommendations(new Map([
    [a, document("대체", "002-b.md", "2026-09-06")],
    [b, document("대체", "003-c.md")],
    [c, document()],
    ["recommendations/004-d.md", document("철회")],
    ["recommendations/TEMPLATE.md", "not a published recommendation"],
  ]));
  assert.deepEqual(records.map((rec) => rec.source), [a, "recommendations/004-d.md", c, b]);
  assert.equal(records.find((rec) => rec.source === a).replacement, b);
  assert.deepEqual(records.filter((rec) => rec.effect === "현행").map((rec) => rec.source), [c]);
});

test("missing, unknown or conflicting effects never default to current", () => {
  for (const content of [
    document().replace("효력: 현행\n", ""),
    document("초안"),
    document() + "\n효력: 철회\n",
  ]) assert.throws(() => parseRecommendations(new Map([[a, content]])), /효력/);
});

test("replacement must name exactly one published recommendation", () => {
  for (const [effect, replacement] of [
    ["대체", ""], ["대체", "missing.md"], ["대체", "../PRINCIPLES.md"],
    ["현행", "002-b.md"], ["철회", "002-b.md"],
  ]) assert.throws(() => parseRecommendations(new Map([[a, document(effect, replacement)], [b, document()]])), /대체/);
  assert.throws(() => parseRecommendations(new Map([
    [a, document("대체", "002-b.md") + "대체 권장: [다른 권장](003-c.md)\n"],
    [b, document()], [c, document()],
  ])), /대체/);
});

test("rejects self-replacement and cycles, including normalized paths", () => {
  assert.throws(() => parseRecommendations(new Map([[a, document("대체", "./001-a.md")]])), /순환/);
  assert.throws(() => parseRecommendations(new Map([
    [a, document("대체", "002-b.md")], [b, document("대체", "003-c.md")],
    [c, document("대체", "001-a.md")],
  ])), /순환/);
});

test("rejects invalid approval dates", () => {
  assert.throws(() => parseRecommendations(new Map([[a, document("현행", "", "2026-02-30")]])), /날짜/);
});
