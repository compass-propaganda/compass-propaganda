// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";

// The site uses a classic deferred script. Run its pure classifier without a DOM
// or new runtime dependencies; browser rendering still needs a separate check.
const source = await readFile(new URL("../site/comparison.js", import.meta.url), "utf8");
const context = createContext({
  document: { querySelectorAll: () => [] },
  HTMLElement: class {},
});
runInContext(source, context);
const tone = context.comparisonTone;
const columns = ["목적·관심", "판단 근거", "참여·실천"];

test("nearby categories share a tone without merging their labels", () => {
  assert.equal(tone("목적·관심", "개인의 삶"), tone("목적·관심", "소비자 이익"));
  assert.notEqual(tone("목적·관심", "개인의 삶"), tone("목적·관심", "공동의 이익"));
  assert.notEqual(tone("목적·관심", "괴로움 소멸"), tone("목적·관심", "신앙의 전승"));
  for (const label of ["관찰·모델", "시험·조사"]) {
    assert.equal(tone("판단 근거", label), tone("판단 근거", "가치·자료"));
  }
  assert.notEqual(tone("판단 근거", "가치·자료"), tone("판단 근거", "경전·전승"));
  assert.notEqual(tone("판단 근거", "결과 비교"), tone("판단 근거", "경전·전승"));
  for (const label of ["신앙 실천", "의례·봉사"]) {
    assert.equal(tone("참여·실천", label), tone("참여·실천", "수행"));
  }
});

test("a repeated category is consistent across columns", () => {
  assert.equal(tone("판단 근거", "결과 비교"), tone("참여·실천", "결과 비교"));
});

test("classification follows the column name, not its position", () => {
  const cells = [
    ["목적·관심", "개인의 삶"],
    ["판단 근거", "가치·자료"],
    ["참여·실천", "일상 실천"],
  ];
  const before = new Map(cells.map(([column, label]) => [column, tone(column, label)]));
  for (const [column, label] of cells.toReversed()) {
    assert.equal(tone(column, label), before.get(column));
  }
  assert.equal(tone("종교", "개인의 삶"), undefined);
});

test("unknown types and qualification labels stay neutral", () => {
  for (const column of [...columns, "오픈소스"]) {
    for (const label of ["미명시", "판본별"]) {
      assert.equal(tone(column, label), "neutral");
    }
  }
  for (const label of ["새로운 유형", "constructor", "__proto__"]) {
    assert.equal(tone("판단 근거", label), "neutral");
  }
  assert.equal(tone("추가 비교 기준", "새로운 유형"), undefined);
});

test("boolean answers remain checks and dashes, not colored category pills", () => {
  for (const column of [...columns, "종교", "삶의 방향", "중앙 권위", "오픈소스"]) {
    for (const label of ["예", "아니오"]) assert.equal(tone(column, label), undefined);
  }
});

test("the current comparison table has no silently unclassified categories", async () => {
  const markdown = await readFile(new URL("../REFERENCES.md", import.meta.url), "utf8");
  const block = markdown.match(/<div class="comparison">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(block, "The comparison table must exist.");
  const rows = block.split("\n").filter((line) => line.startsWith("|"))
    .map((line) => line.slice(1, line.lastIndexOf("|")).split("|").map((cell) => cell.trim()));
  const labelOf = (cell) => cell.match(/<summary>(.*?)<\/summary>/)?.[1] ?? cell;
  const [headings, , ...body] = rows;
  assert.ok(body.length > 0);
  const supportedTones = new Set(["teal", "blue", "amber", "violet", "rose"]);
  for (const column of columns) {
    const index = headings.map(labelOf).indexOf(column);
    assert.ok(index >= 0, `Missing comparison column: ${column}`);
    for (const row of body) {
      const label = labelOf(row[index]);
      if (["미명시", "판본별", "예", "아니오"].includes(label)) continue;
      assert.ok(supportedTones.has(tone(column, label)), `${column}: ${label} needs an explicit tone.`);
    }
  }
});
