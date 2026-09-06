// SPDX-License-Identifier: MIT
import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  copyFile,
  rm,
} from "node:fs/promises";
import { dirname, resolve, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import { parseRecommendations } from "./recommendations.mjs";
import { renderOracleSetup } from "./setup-oracle.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist/site");
const repository = "https://github.com/compass-propaganda/compass-propaganda";
const publicSite = "https://compass-propaganda.github.io/compass-propaganda/";
const groups = [
  [
    "입문과 교리",
    [
      ["ONBOARDING.md", "입문 안내"],
      ["PRINCIPLES.md", "판단 원칙"],
      ["TERMINOLOGY.md", "용어"],
    ],
  ],
  [
    "탐구",
    [
      ["APPROACH.md", "과학적 접근"],
      ["PROPHETS.md", "선지자들"],
      ["REFERENCES.md", "참고 자료"],
    ],
  ],
  [
    "운영",
    [
      ["GOVERNANCE.md", "운영과 참여"],
      ["AI.md", "AI 활용"],
    ],
  ],
  [
    "구현",
    [
      ["ORACLE.md", "오라클의 실행과 검증"],
      ["oracle/README.md", "참조 구현 안내"],
    ],
  ],
];
const documents = [
  ...groups.flatMap(([, entries]) => entries.map(([path]) => path)),
  "README.md",
  "LICENSE.md",
  "PLAN.md",
  "recommendations/TEMPLATE.md",
];
const recPaths = (await readdir(resolve(root, "recommendations")))
  .filter((path) => /^\d+.*\.md$/.test(path))
  .sort()
  .map((path) => `recommendations/${path}`);
documents.push(...recPaths);
const sources = new Map(
  await Promise.all(
    documents.map(async (path) => [
      path,
      await readFile(resolve(root, path), "utf8"),
    ]),
  ),
);
const recommendations = parseRecommendations(sources);
const recommendationsBySource = new Map(recommendations.map((rec) => [rec.source, rec]));
const purpose = sources.get("PRINCIPLES.md").match(/^> (.+)$/m)[1];
const htmlPath = (path) => path.replace(/\.md$/, ".html");
const relative = (from, to) =>
  posix.relative(posix.dirname(from), to) || posix.basename(to);
const escape = (text) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const slug = (text) =>
  text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s-]/gu, "")
    .replace(/ /g, "-");
let revision = "main";
try {
  revision = execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {}
const sourceUrl = (path) => `${repository}/blob/${revision}/${path}`;
const symbol = (
  await readFile(resolve(root, "site/symbol.svg"), "utf8")
).replace("<svg ", '<svg aria-hidden="true" ');
const markdown = new MarkdownIt({ html: true, typographer: false }).use(
  footnote,
);
const pnLabels = new Map(
  [
    ...sources.get("TERMINOLOGY.md").matchAll(/^\| (P[1-5]) \| (.+?) \|$/gm),
  ].map(([, code, label]) => [code, label]),
);
if (pnLabels.size !== 5)
  throw new Error("용어 문서에 P1–P5의 의미가 필요합니다.");
markdown.core.ruler.push("document-links", (state) => {
  const ids = new Map();
  for (let i = 0; i < state.tokens.length; i++) {
    const token = state.tokens[i];
    if (token.type === "heading_open") {
      const id = slug(state.tokens[i + 1].content);
      const count = ids.get(id) || 0;
      ids.set(id, count + 1);
      token.attrSet("id", count ? `${id}-${count}` : id);
    }
    for (const child of token.children || []) {
      if (child.type !== "link_open") continue;
      const href = child.attrGet("href");
      if (href?.startsWith(publicSite)) {
        const target = new URL(href);
        child.attrSet(
          "href",
          relative(
            state.env.output,
            target.pathname.slice(new URL(publicSite).pathname.length) || "index.html",
          ) + target.search + target.hash,
        );
        continue;
      }
      if (!href || /^(?:[a-z][a-z\d+.-]*:|#)/i.test(href)) continue;
      const [path, fragment] = href.split("#");
      const target = posix.normalize(
        posix.join(posix.dirname(state.env.source), decodeURIComponent(path)),
      );
      const localTarget = sources.has(target)
        ? htmlPath(target)
        : target === "recommendations/" || target === "recommendations"
          ? "recommendations/index.html"
          : target.startsWith("LICENSES/")
            ? target
            : null;
      child.attrSet(
        "href",
        (localTarget
          ? relative(state.env.output, localTarget)
          : sourceUrl(target)) + (fragment ? `#${fragment}` : ""),
      );
    }
  }
});
markdown.renderer.rules.heading_close = (tokens, idx, options, env, self) => {
  const heading = self.renderToken(tokens, idx, options);
  const rec = recommendationsBySource.get(env.source);
  if (!rec || tokens[idx].tag !== "h1") return heading;
  const href = relative(env.output, "TERMINOLOGY.html") + "#pn-룰";
  const fields = [["효력", escape(rec.effect)]];
  if (rec.replacement) {
    const target = recommendationsBySource.get(rec.replacement);
    fields.push(["대체 권장", `<a href="${escape(relative(env.output, htmlPath(target.source)))}">${escape(target.title)}</a>`]);
  }
  return `${heading}<div class="recommendation-metadata"><p class="pn-metadata"><a class="pn-badge" href="${href}"><span class="pn-code">${rec.pn}</span><span class="pn-caption"><span class="pn-label">반영 요청</span><span>${escape(pnLabels.get(rec.pn))}</span></span><span class="pn-link" aria-hidden="true">→</span></a></p><dl>${fields.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl></div>\n`;
};
markdown.renderer.rules.table_open = () =>
  '<div class="table-scroll" tabindex="0" role="region" aria-label="비교 표"><table>\n';
markdown.renderer.rules.table_close = () => "</table></div>\n";
const render = (source, text = recommendationsBySource.get(source)?.body ?? sources.get(source)) => {
  const body = markdown.render(text, { source, output: htmlPath(source) });
  const rec = recommendationsBySource.get(source);
  if (!rec) return body;
  const date = (value) => `<time datetime="${value}">${value.replaceAll("-", ".")}</time>`;
  const fields = [["승인", `${escape(rec.approvedBy)} · ${date(rec.approved)}`]];
  if (rec.author) fields.push(["작성자", escape(rec.author)]);
  if (rec.writtenAt) fields.push(["작성일", date(rec.writtenAt)]);
  return `${body}<details class="recommendation-metadata"><summary>판단 기록 정보</summary><dl>${fields.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl></details>`;
};
const titleOf = (source) => recommendationsBySource.get(source)?.title ?? sources.get(source).match(/^# (.+)$/m)[1];
function descriptionOf(source) {
  if (source === "PRINCIPLES.md") return purpose;
  if (source === "TERMINOLOGY.md")
    return "불꽃과 해방, 권장과 오라클, 정경과 정본 등 Compass Propaganda의 개념과 규범 표현을 설명합니다.";
  const tokens = markdown.parse(sources.get(source), {
    source,
    output: htmlPath(source),
  });
  const index = tokens.findIndex(
    (token) => token.type === "paragraph_open" && token.level === 0,
  );
  return (tokens[index + 1]?.children || [])
    .map((token) =>
      token.type === "text" || token.type === "code_inline"
        ? token.content
        : token.type === "softbreak" ? " " : "",
    )
    .join("")
    .trim() || purpose;
}
function navigationLink(current, target, label) {
  const active =
    current === target
      ? "page"
      : target === "recommendations/index.html" &&
          current.startsWith("recommendations/")
        ? "location"
        : null;
  return `<a href="${relative(current, target)}"${active ? ` aria-current="${active}"` : ""}>${label}</a>`;
}
function layout(path, title, body, description = purpose) {
  const href = (target) => relative(path, target);
  const pageTitle = title === "Compass Propaganda" ? title : `${title} — Compass Propaganda`;
  const canonical = new URL(path === "index.html" ? "./" : path, publicSite).href;
  const imageUrl = new URL("assets/social.png", publicSite).href;
  return `<!doctype html>
<html lang="ko" prefix="og: https://ogp.me/ns#"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(pageTitle)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${escape(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Compass Propaganda">
<meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${escape(pageTitle)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(canonical)}">
<meta property="og:image" content="${imageUrl}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="밝은 바탕 중앙에 작게 놓인 Compass Propaganda 나침반 심볼">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escape(pageTitle)}">
<meta name="twitter:description" content="${escape(description)}">
<meta name="twitter:image" content="${imageUrl}">
<meta name="twitter:image:alt" content="밝은 바탕 중앙에 작게 놓인 Compass Propaganda 나침반 심볼">
<meta name="theme-color" content="#fafaf7">
<link rel="icon" href="${href("assets/symbol.svg")}" type="image/svg+xml">
<link rel="stylesheet" href="${href("assets/style.css")}">
${path === "setup-oracle.html" ? `<link rel="stylesheet" href="${href("assets/setup-oracle.css")}"><script src="${href("assets/setup-oracle.js")}" defer></script>` : ""}
<script src="${href("assets/client.js")}" defer></script></head>
<body><a class="skip" href="#main">본문으로 건너뛰기</a><div class="shell">
<header class="header"><a class="brand" href="${href("index.html")}" aria-label="Compass Propaganda 홈">${symbol}<span>compass propaganda<span class="brand-korean">컴퍼스 프로파간다</span></span></a><nav aria-label="주 메뉴">${navigationLink(path, "PRINCIPLES.html", "교리")}${navigationLink(path, "recommendations/index.html", "권장")}${navigationLink(path, "setup-oracle.html", "오라클")}<a class="external" href="${repository}">GitHub ↗</a></nav></header>
${body}
<footer class="footer"><a class="footer-brand" href="${href("index.html")}">compass<br>propaganda<span>컴퍼스 프로파간다</span></a><div class="footer-links"><a href="${href("ONBOARDING.html")}">입문 안내</a><a href="${href("LICENSE.html")}">CC BY-SA 4.0</a><a href="${repository}">원문 저장소 ↗</a></div><a class="edition" href="${repository}/tree/${revision}"><span>원문 판본</span><span>${revision.slice(0, 7)} ↗</span></a></footer></div></body></html>`;
}
function sidebar(current) {
  const sections = [
    ...groups.map(([name, entries]) => [
      name,
      entries.map(([source, label]) => [htmlPath(source), label]),
    ]),
    [
      "권장과 자료",
      [
        ["recommendations/index.html", "권장 모음"],
        ["setup-oracle.html", "오라클에 자문 구하기"],
        ["PLAN.html", "설계 계획"],
        ["LICENSE.html", "라이선스"],
      ],
    ],
  ];
  const currentLabel =
    sections
      .flatMap(([, entries]) => entries)
      .find(([path]) => path === current)?.[1] ||
    (current.startsWith("recommendations/") ? "권장 모음" : "서고");
  return `<aside class="sidebar"><details open data-document-menu><summary>차례<span class="sidebar-current">${currentLabel}</span></summary><nav aria-label="차례">${sections.map(([name, entries]) => `<div class="sidebar-group"><p>${name}</p>${entries.map(([target, label]) => navigationLink(current, target, label)).join("")}</div>`).join("")}</nav></details></aside>`;
}
const currentRecommendations = recommendations.filter((rec) => rec.effect === "현행");
const archivedRecommendations = recommendations.filter((rec) => rec.effect !== "현행");
function recList(from, entries = currentRecommendations) {
  return entries
    .map(
      (rec) =>
        `<a class="recommendation" href="${relative(from, htmlPath(rec.source))}"><span class="recommendation-number">${String(rec.number).padStart(3, "0")}</span><div class="recommendation-content"><div class="recommendation-meta"><span class="pn-code" title="${escape(pnLabels.get(rec.pn))}">${rec.pn}</span><span>승인 <time datetime="${rec.approved}">${rec.approved.replaceAll("-", ".")}</time></span>${rec.effect !== "현행" ? `<span>${rec.effect}</span>` : ""}</div><h3>${escape(rec.title)}</h3><p>${escape(rec.text)}</p></div><span class="arrow" aria-hidden="true">→</span></a>`,
    )
    .join("");
}
function furtherReading(current) {
  const routes = {
    "ONBOARDING.html": ["PRINCIPLES.html", "setup-oracle.html"],
    "PRINCIPLES.html": ["recommendations/index.html", "APPROACH.html"],
    "TERMINOLOGY.html": ["PRINCIPLES.html", "recommendations/index.html"],
    "AI.html": ["ORACLE.html", "GOVERNANCE.html"],
    "ORACLE.html": ["setup-oracle.html", "oracle/README.html"],
    "oracle/README.html": ["setup-oracle.html", "ORACLE.html"],
    "PLAN.html": ["GOVERNANCE.html", "ORACLE.html"],
    "LICENSE.html": ["GOVERNANCE.html", "index.html"],
    "README.html": ["ONBOARDING.html", "PRINCIPLES.html"],
    "recommendations/TEMPLATE.html": ["GOVERNANCE.html", "recommendations/index.html"],
    "recommendations/index.html": ["PRINCIPLES.html", "setup-oracle.html"],
    "setup-oracle.html": ["ONBOARDING.html", "recommendations/index.html"],
  };
  let targets = routes[current];
  if (!targets && recommendationsBySource.has(current.replace(/\.html$/, ".md"))) {
    const index = currentRecommendations.findIndex((rec) => htmlPath(rec.source) === current);
    const next = currentRecommendations[index + 1] || currentRecommendations[0];
    targets = [next && htmlPath(next.source), "recommendations/index.html"];
  }
  if (!targets) {
    const entries = groups.find(([, entries]) => entries.some(([source]) => htmlPath(source) === current))?.[1] || [];
    const index = entries.findIndex(([source]) => htmlPath(source) === current);
    const next = entries[index + 1] || entries[0];
    targets = [next ? htmlPath(next[0]) : "ONBOARDING.html", "index.html"];
  }
  const labels = { "index.html": "서고", "setup-oracle.html": "오라클에 자문 구하기", "recommendations/index.html": "권장 모음" };
  const links = targets.filter((target) => target && target !== current).map((target) => {
    const label = labels[target] || titleOf(target.replace(/\.html$/, ".md"));
    return `<a href="${relative(current, target)}"><span>${escape(label)}</span><span aria-hidden="true">→</span></a>`;
  }).join("");
  return `<nav class="further-reading" aria-labelledby="further-reading-title"><h2 id="further-reading-title">더 알아보기</h2><div>${links}</div></nav>`;
}
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "assets"), { recursive: true });
await mkdir(resolve(output, "setup-oracle"), { recursive: true });
for (const file of ["style.css", "client.js", "setup-oracle.css", "setup-oracle.js", "symbol.svg", "flame.png", "social.png"])
  await copyFile(resolve(root, "site", file), resolve(output, "assets", file));
await mkdir(resolve(output, "assets/brands"), { recursive: true });
for (const file of await readdir(resolve(root, "site/brands"))) {
  if (file.endsWith(".svg")) await copyFile(resolve(root, "site/brands", file), resolve(output, "assets/brands", file));
}
for (const file of await readdir(resolve(root, "LICENSES"))) {
  await mkdir(resolve(output, "LICENSES"), { recursive: true });
  await copyFile(
    resolve(root, "LICENSES", file),
    resolve(output, "LICENSES", file),
  );
}
await copyFile(
  resolve(root, "dist/oracle.md"),
  resolve(output, "setup-oracle/oracle.md"),
);
execFileSync(
  "zip",
  [
    "-X",
    "-q",
    resolve(output, "setup-oracle/compass-propaganda.zip"),
    "compass-propaganda/SKILL.md",
    "compass-propaganda/references/oracle.md",
  ],
  { cwd: resolve(root, "dist") },
);
await writeFile(resolve(output, ".nojekyll"), "");
for (const source of documents) {
  const path = htmlPath(source);
  const title = titleOf(source);
  await mkdir(dirname(resolve(output, path)), { recursive: true });
  const rec = recommendationsBySource.get(source);
  const category = rec
    ? `권장 / ${String(rec.number).padStart(3, "0")}`
    : groups.find(([, entries]) =>
        entries.some(([path]) => path === source),
      )?.[0] || "서고";
  const body = `<main id="main" class="document-layout">${sidebar(path)}<article class="article"><div class="article-meta"><span>${category}${rec ? `<time datetime="${rec.approved}">승인 ${rec.approved.replaceAll("-", ".")}</time>` : ""}</span><a href="${sourceUrl(source)}">원문 보기 ↗</a></div><div class="prose">${render(source)}</div>${furtherReading(path)}</article></main>`;
  const description = rec
    ? `${rec.effect !== "현행" ? `${rec.effect}된 권장. ` : ""}${rec.text}`
    : descriptionOf(source);
  await writeFile(resolve(output, path), layout(path, title, body, description));
}
const home = `<main id="main" class="home">
<section class="cover" aria-labelledby="cover-title">
<img class="cover-flame" src="assets/flame.png" width="1536" height="1024" alt="" fetchpriority="high">
<div class="cover-copy">
<h1 id="cover-title" class="cover-purpose">${escape(purpose)}</h1>
<a class="text-link" href="ONBOARDING.html">입문 안내 <span aria-hidden="true">→</span></a>
</div>
</section>
<section class="section contents"><div class="section-label"><h2>서고</h2></div><div class="routes">
<a class="route" href="ONBOARDING.html"><h3>입문 안내</h3><p>교리의 요약과 권장을 읽는 방법</p><span class="arrow" aria-hidden="true">→</span></a>
<a class="route" href="PRINCIPLES.html"><h3>판단 원칙</h3><p>기본 교리와 공통의 판단 기준</p><span class="arrow" aria-hidden="true">→</span></a>
<a class="route" href="APPROACH.html"><h3>과학적 접근</h3><p>근거의 검토, 결과의 예측과 검증</p><span class="arrow" aria-hidden="true">→</span></a>
<a class="route" href="GOVERNANCE.html"><h3>운영과 참여</h3><p>권장의 승인과 발행, 제안과 수정</p><span class="arrow" aria-hidden="true">→</span></a></div></section>
<section class="section"><div class="section-label"><h2>권장</h2><a class="text-link" href="recommendations/index.html">권장 모음 <span aria-hidden="true">→</span></a></div>${recList("index.html")}</section>
<section class="section oracle-section"><h2>오라클</h2><div><p>자신의 AI에서 오라클과 대화하며 일상의 선택에 대해 자문을 구합니다. AI는 공개 권장과 공통 원칙을 참고해 답합니다.</p><a class="text-link" href="setup-oracle.html">오라클에 자문 구하기 <span aria-hidden="true">→</span></a></div></section>
</main>`;
await writeFile(
  resolve(output, "index.html"),
  layout("index.html", "Compass Propaganda", home),
);
const recPage = `<main id="main" class="document-layout">${sidebar("recommendations/index.html")}<article class="article"><div class="article-meta"><span>권장 모음 / 현행 ${currentRecommendations.length}편</span><span>승인일 최신순</span></div><div class="prose"><h1>권장</h1><p>자신에게 해당하는 권장과 적용 조건을 읽습니다. 이유가 궁금하면 판단 기록과 출처를 살펴볼 수 있습니다.</p></div><div class="list-note"><span>Pn은 반영을 요청하는 강도입니다.</span><a href="../TERMINOLOGY.html#pn-룰">Pn 룰 읽기 →</a></div>${recList("recommendations/index.html")}${archivedRecommendations.length ? `<section class="prose"><h2>철회·대체된 권장</h2><p>아래 권장은 현재 적용하지 않습니다.</p></section>${recList("recommendations/index.html", archivedRecommendations)}` : ""}${furtherReading("recommendations/index.html")}</article></main>`;
await writeFile(
  resolve(output, "recommendations/index.html"),
  layout("recommendations/index.html", "권장", recPage, "중앙이 승인한 권장과 적용 조건을 읽습니다. 반영 요청의 강도와 판단 이유, 출처를 함께 살펴볼 수 있습니다."),
);
// Preserve source bytes and relative links to the shared judgment criteria.
for (const source of [...recPaths, "PRINCIPLES.md", "TERMINOLOGY.md"]) {
  await writeFile(resolve(output, source), sources.get(source));
}
const recIndex = `# 권장 원문 인덱스

공식 저장소에서 생성한 권장 목록입니다. 현행 권장만 적용하며, 대체된 권장은 연결된 후속 권장을 읽고 그 효력과 조건을 확인합니다. 철회된 권장은 적용하지 않습니다. 후보를 찾은 뒤 원문 전체를 읽고 승인·적용 조건·예외를 확인합니다. 목록의 요지만으로 권장을 적용하지 않습니다.

빌드 기준 커밋: [${revision}](${repository}/tree/${revision})
원문은 아래 Markdown 주소에서 직접 읽습니다. 접근할 수 없으면 HTML 또는 저장소 원문을 읽습니다. 각 SHA-256은 배포된 Markdown 파일의 내용을 식별하며, 오라클 문서 묶음 식별자와는 별개입니다.
원문 맨 앞의 YAML 프런트 매터에서 pn·effect·approved_by·approved_at을 확인합니다. 대체된 권장은 replacement 경로로 후속 원문을 찾습니다.

${recommendations.map((rec) => `## ${String(rec.number).padStart(3, "0")}. ${rec.title}

- 효력: ${rec.effect}${rec.replacement ? `\n- [대체 권장](${publicSite}${rec.replacement})` : ""}
- 반영 요청: ${rec.pn} — ${pnLabels.get(rec.pn)}
- 승인자: ${rec.approvedBy}
- 승인일: ${rec.approved}
- 권장 요지: ${rec.text}
- [Markdown 원문](${publicSite}${rec.source})
- [HTML 본문](${publicSite}${htmlPath(rec.source)})
- [저장소 원문](${sourceUrl(rec.source)})
- SHA-256: ${createHash("sha256").update(sources.get(rec.source)).digest("hex")}
`).join("\n")}`;
await writeFile(resolve(output, "recommendations/index.md"), recIndex);
const prompts = Object.fromEntries(await Promise.all(
  ["install", "setup", "start", "other-start"].map(async (name) => [
    name, await readFile(resolve(root, `oracle/prompts/${name}.md`), "utf8"),
  ]),
));
await writeFile(resolve(output, "setup-oracle/install.md"), prompts.install);
const oracleText = await readFile(resolve(root, "dist/oracle.md"), "utf8");
const bundle = oracleText.match(/문서 묶음 식별자: (.+)/)[1];
const oracleSetup = `<main id="main" class="document-layout">${sidebar("setup-oracle.html")}<article class="article"><div class="article-meta"><span>설치·사용 안내</span><a href="oracle/README.html">참조 구현 안내 ↗</a></div><div class="prose"><h1>오라클에 자문 구하기</h1><p>공통 가치와 판단 원칙을 자신의 AI에서 사용합니다.<br>사용하는 AI를 고르면, 알맞은 시작 방법을 안내합니다.</p></div>
${renderOracleSetup(prompts, oracleText, escape)}
<p class="oracle-note">사용 방법은 <a href="ONBOARDING.html">입문 안내</a>에, 구성과 생성 절차는 <a href="oracle/README.html">참조 구현 안내</a>에 정리되어 있습니다.</p><details class="oracle-note"><summary>이 배포본의 원문과 식별자</summary><p><a href="${repository}/tree/${revision}">원문 보기 ↗</a></p><p class="source-line">${escape(bundle)}</p></details>${furtherReading("setup-oracle.html")}</article></main>`;
await writeFile(
  resolve(output, "setup-oracle.html"),
  layout("setup-oracle.html", "오라클에 자문 구하기", oracleSetup, "자신의 AI에서 Compass Propaganda 오라클에 자문을 구합니다. 서비스별 설치·설정 방법과 바로 시작할 수 있는 오라클 문서를 제공합니다."),
);
await writeFile(
  resolve(output, "downloads.html"),
  layout("downloads.html", "오라클에 자문 구하기", '<main id="main" class="prose"><h1>오라클에 자문 구하기</h1><p><a href="setup-oracle.html">오라클 설치·사용 안내로 이동하기 →</a></p></main>', "오라클 설치·사용 안내가 새 주소로 이동했습니다.")
    .replace("</head>", '<script>location.replace("setup-oracle.html" + location.hash)</script><noscript><meta http-equiv="refresh" content="0; url=setup-oracle.html"></noscript></head>'),
);
console.log(`Built ${documents.length + 4} pages and oracle setup artifacts in ${output}`);
