// SPDX-License-Identifier: MIT
import { posix } from "node:path";

export function parseRecommendations(sources) {
  const recommendations = [...sources]
    .filter(([path]) => /^recommendations\/\d[^/]*\.md$/.test(path))
    .map(([source, content]) => {
      const effects = [...content.matchAll(/^효력: (.*)$/gm)];
      const effect = effects[0]?.[1];
      if (effects.length !== 1 || !["현행", "철회", "대체"].includes(effect)) {
        throw new Error(`${source}: 효력은 현행·철회·대체 중 하나여야 합니다.`);
      }
      const replacements = [...content.matchAll(/^대체 권장: (.*)$/gm)];
      const link = replacements[0]?.[1].match(/^\[[^\]]+\]\(([^)]+)\)$/)?.[1];
      if (
        (effect === "대체" && (replacements.length !== 1 || !link)) ||
        (effect !== "대체" && replacements.length !== 0)
      ) {
        throw new Error(`${source}: 대체 효력에만 대체 권장 링크 하나가 필요합니다.`);
      }
      const replacement = link
        ? posix.normalize(posix.join(posix.dirname(source), link))
        : null;
      const approved = content.match(
        /^- 승인(?:자·승인일)?: [^\n]+, (\d{4}-\d{2}-\d{2})\.?$/m,
      )?.[1];
      if (
        !approved ||
        !Number.isFinite(Date.parse(approved)) ||
        new Date(approved).toISOString().slice(0, 10) !== approved
      ) {
        throw new Error(`${source}: 승인 기록에 유효한 YYYY-MM-DD 날짜가 필요합니다.`);
      }
      return {
        source,
        title: content.match(/^# (.+)$/m)[1],
        pn: content.match(/^Pn: \[(P[1-5])/m)[1],
        text: content.match(/## 권장\s+([^\n]+)/)[1],
        approved,
        number: Number(posix.basename(source).match(/^\d+/)[0]),
        effect,
        replacement,
      };
    })
    .sort((a, b) => b.approved.localeCompare(a.approved) || b.number - a.number);
  const byPath = new Map(recommendations.map((rec) => [rec.source, rec]));
  for (const rec of recommendations) {
    const visited = new Set([rec.source]);
    let next = rec.replacement;
    while (next) {
      if (!byPath.has(next)) throw new Error(`${rec.source}: 대체 권장이 없습니다: ${next}`);
      if (visited.has(next)) throw new Error(`${rec.source}: 대체 권장이 순환합니다.`);
      visited.add(next);
      next = byPath.get(next).replacement;
    }
  }
  return recommendations;
}
