// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecommendations } from "./recommendations.mjs";

function document(effect = "현행", replacement = "", date = "2026-09-05") {
  return `---\npn: P3\neffect: ${effect}\napproved_by: 돌\napproved_at: "${date}"\n${replacement ? `replacement: ${replacement}\n` : ""}---\n\n# 권장\n\n## 권장\n\n권장 내용.\n`;
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
    document().replace("effect: 현행\n", ""),
    document("초안"),
    document().replace("effect: 현행", "effect: 현행\neffect: 철회"),
  ]) assert.throws(() => parseRecommendations(new Map([[a, content]])), /effect|unique/);
});

test("replacement must name exactly one published recommendation", () => {
  for (const [effect, replacement] of [
    ["대체", ""], ["대체", "missing.md"], ["대체", "../PRINCIPLES.md"],
    ["현행", "002-b.md"], ["철회", "002-b.md"],
  ]) assert.throws(() => parseRecommendations(new Map([[a, document(effect, replacement)], [b, document()]])), /대체/);
  assert.throws(() => parseRecommendations(new Map([
    [a, document("대체", "002-b.md").replace("replacement: 002-b.md", "replacement: 002-b.md\nreplacement: 003-c.md")],
    [b, document()], [c, document()],
  ])), /unique/);
});

test("rejects self-replacement and cycles, including normalized paths", () => {
  assert.throws(() => parseRecommendations(new Map([[a, document("대체", "./001-a.md")]])), /순환/);
  assert.throws(() => parseRecommendations(new Map([
    [a, document("대체", "002-b.md")], [b, document("대체", "003-c.md")],
    [c, document("대체", "001-a.md")],
  ])), /순환/);
});

test("rejects invalid approval dates", () => {
  for (const date of ["2026-02-30", "2026-9-5", "yesterday"]) {
    assert.throws(() => parseRecommendations(new Map([[a, document("현행", "", date)]])), /날짜/);
  }
});

test("parses YAML metadata and keeps body examples independent", () => {
  const content = document().replace('pn: P3', 'pn: "P3" # 요청 강도')
    .replace('approved_by: 돌', 'approved_by: "돌: 중앙"\nauthor: AI\nwritten_at: "2026-09-04"')
    + '\n```yaml\neffect: 철회\napproved_at: "2099-01-01"\n```\n';
  const [record] = parseRecommendations(new Map([[a, content.replaceAll('\n', '\r\n')]]));
  assert.equal(record.pn, 'P3');
  assert.equal(record.effect, '현행');
  assert.equal(record.approvedBy, '돌: 중앙');
  assert.equal(record.author, 'AI');
  assert.equal(record.writtenAt, '2026-09-04');
  assert.equal(record.approved, '2026-09-05');
  assert(record.body.includes('effect: 철회'));
  assert(!record.body.includes('approved_by:'));
});

test("rejects malformed front matter and invalid or unknown fields", () => {
  for (const content of [
    '# 권장\n\n## 권장\n\n본문',
    '---\npn: P3\n',
    '---\n[one, two]\n---\n# 권장',
    document().replace('pn: P3', 'pn: [P3'),
    document().replace('pn: P3', 'pn: P0'),
    document().replace('pn: P3', 'pn: P3\npn: P1'),
    document().replace('pn: P3', 'pn: P3\npriority: P1'),
    document().replace('approved_by: 돌\n', ''),
    document().replace('approved_by: 돌', 'approved_by: null'),
    document().replace('approved_by: 돌', 'approved_by: [돌]'),
    document().replace('approved_by: 돌', 'approved_by: !person 돌'),
    document().replace('approved_by: 돌', 'approved_by: &person 돌\nauthor: *person'),
    document().replace('pn: P3', 'pn: P3\nwritten_at: "2026-09-06"'),
  ]) assert.throws(() => parseRecommendations(new Map([[a, content]])), /recommendations\/001-a\.md/);
});
