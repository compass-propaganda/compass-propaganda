// SPDX-License-Identifier: MIT
import { posix } from "node:path";
import { parseDocument } from "yaml";

const fields = new Set([
  "pn", "effect", "author", "written_at", "approved_by", "approved_at", "replacement",
]);

export function parseRecommendation(source, content) {
  const frontMatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontMatter) throw new Error(`${source}: YAML 프런트 매터가 필요합니다.`);
  const document = parseDocument(frontMatter[1], { stringKeys: true });
  const issue = document.errors[0] || document.warnings[0];
  if (issue) throw new Error(`${source}: ${issue.message}`);
  let metadata;
  try {
    metadata = document.toJS({ maxAliasCount: 0 });
  } catch (error) {
    throw new Error(`${source}: ${error.message}`);
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`${source}: 프런트 매터는 키와 값의 매핑이어야 합니다.`);
  }
  for (const [key, value] of Object.entries(metadata)) {
    if (!fields.has(key)) throw new Error(`${source}: 알 수 없는 메타데이터: ${key}`);
    if (typeof value !== "string" || !value.trim() || /[\r\n]/.test(value)) {
      throw new Error(`${source}: ${key}에는 비어 있지 않은 한 줄 문자열이 필요합니다.`);
    }
  }
  for (const key of ["pn", "effect", "approved_by", "approved_at"]) {
    if (!Object.hasOwn(metadata, key)) throw new Error(`${source}: ${key}가 필요합니다.`);
  }
  if (!/^P[1-5]$/.test(metadata.pn)) throw new Error(`${source}: pn은 P1–P5여야 합니다.`);
  if (!["현행", "철회", "대체"].includes(metadata.effect)) {
    throw new Error(`${source}: effect는 현행·철회·대체 중 하나여야 합니다.`);
  }
  for (const key of ["approved_at", "written_at"]) {
    const date = metadata[key];
    if (date !== undefined && (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )) throw new Error(`${source}: ${key}에 유효한 YYYY-MM-DD 날짜가 필요합니다.`);
  }
  if (metadata.written_at && metadata.written_at > metadata.approved_at) {
    throw new Error(`${source}: 작성일은 승인일보다 늦을 수 없습니다.`);
  }
  if ((metadata.effect === "대체") !== Object.hasOwn(metadata, "replacement")) {
    throw new Error(`${source}: 대체 효력에만 replacement가 필요합니다.`);
  }
  const body = content.slice(frontMatter[0].length);
  const title = body.match(/^# (.+)$/m)?.[1];
  const text = body.match(/^## 권장\s+([^\n]+)/m)?.[1];
  if (!title || !text) throw new Error(`${source}: 제목과 권장 본문이 필요합니다.`);
  return {
    source, body, title, text,
    pn: metadata.pn,
    effect: metadata.effect,
    approved: metadata.approved_at,
    approvedBy: metadata.approved_by,
    author: metadata.author,
    writtenAt: metadata.written_at,
    number: Number(posix.basename(source).match(/^\d+/)[0]),
    replacement: metadata.replacement
      ? posix.normalize(posix.join(posix.dirname(source), metadata.replacement))
      : null,
  };
}

export function parseRecommendations(sources) {
  const recommendations = [...sources]
    .filter(([path]) => /^recommendations\/\d[^/]*\.md$/.test(path))
    .map(([source, content]) => parseRecommendation(source, content))
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
