// SPDX-License-Identifier: MIT
import { parseDocument } from "yaml";

export function parseBulletins(sources, now = new Date()) {
  const numbers = new Set();
  const entries = [];
  for (const [source, content] of sources) {
    const match = source.match(/^bulletins\/(\d+)[^/]*\.md$/);
    if (!match) continue;
    const number = Number(match[1]);
    if (!Number.isSafeInteger(number) || numbers.has(number))
      throw new Error(`${source}: 주보 번호가 중복되거나 유효하지 않습니다.`);
    numbers.add(number);
    const front = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!front) throw new Error(`${source}: YAML 프런트 매터가 필요합니다.`);
    const doc = parseDocument(front[1], { stringKeys: true });
    if (doc.errors.length || doc.warnings.length)
      throw new Error(`${source}: 주보 메타데이터를 확인해 주세요.`);
    const meta = doc.toJS({ maxAliasCount: 0 });
    if (!meta || Array.isArray(meta) || typeof meta !== "object")
      throw new Error(`${source}: 메타데이터는 키와 값의 매핑이어야 합니다.`);
    for (const [key, value] of Object.entries(meta)) {
      if (!["status", "published_at", "summary"].includes(key) || typeof value !== "string" || !value.trim() || /[\r\n]/.test(value))
        throw new Error(`${source}: 유효하지 않은 메타데이터: ${key}`);
    }
    if (!["draft", "published"].includes(meta.status))
      throw new Error(`${source}: status는 draft 또는 published여야 합니다.`);
    if (meta.status === "draft") continue;
    const date = meta.published_at;
    if (!date || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== date.slice(0, 10))
      throw new Error(`${source}: published_at에는 시간대가 포함된 발행 시각이 필요합니다.`);
    if (Date.parse(date) > now.getTime())
      throw new Error(`${source}: 미래 시각의 주보는 아직 발행할 수 없습니다.`);
    const body = content.slice(front[0].length);
    const title = body.match(/^# (.+)$/m)?.[1];
    if (!title || !meta.summary)
      throw new Error(`${source}: 발행할 주보에는 제목과 summary가 필요합니다.`);
    entries.push({ source, number, title, body, summary: meta.summary, published: date });
  }
  return entries.sort((a, b) => Date.parse(b.published) - Date.parse(a.published) || b.number - a.number);
}

export function renderFeed(entries, publicSite) {
  const xml = (text) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
  const url = (path) => xml(new URL(path, publicSite).href);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Compass Propaganda 주보</title>
<link>${url("bulletins/index.html")}</link>
<description>권장과 변경 사항, 교단의 소식을 전합니다.</description>
<language>ko</language>
<atom:link href="${url("feed.xml")}" rel="self" type="application/rss+xml"/>
${entries.length ? `<lastBuildDate>${new Date(entries[0].published).toUTCString()}</lastBuildDate>` : ""}
${entries.map((entry) => `<item>
<title>${xml(entry.title)}</title>
<link>${url(entry.source.replace(/\.md$/, ".html"))}</link>
<guid isPermaLink="false">compass-propaganda:bulletin:${entry.number}</guid>
<pubDate>${new Date(entry.published).toUTCString()}</pubDate>
<description>${xml(entry.summary)}</description>
</item>`).join("\n")}
</channel></rss>\n`;
}
