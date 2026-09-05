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
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";

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
    const pnMetadata =
      recPaths.includes(state.env.source) &&
      token.type === "inline" &&
      /^Pn: \[P[1-5]\]\(\.\.\/TERMINOLOGY\.md#pn-룰\)$/.test(token.content);
    if (pnMetadata) {
      token.type = "pn_badge";
      token.meta = { pn: token.content.match(/\[(P[1-5])\]/)[1] };
      state.tokens[i - 1].attrJoin("class", "pn-metadata");
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
markdown.renderer.rules.pn_badge = (tokens, idx, options, env) => {
  const pn = tokens[idx].meta.pn;
  const href = relative(env.output, "TERMINOLOGY.html") + "#pn-룰";
  return `<a class="pn-badge" href="${href}"><span class="pn-code">${pn}</span><span class="pn-caption"><span class="pn-label">반영 요청</span><span>${escape(pnLabels.get(pn))}</span></span><span class="pn-link" aria-hidden="true">→</span></a>`;
};
markdown.renderer.rules.table_open = () =>
  '<div class="table-scroll" tabindex="0" role="region" aria-label="비교 표"><table>\n';
markdown.renderer.rules.table_close = () => "</table></div>\n";
const originalFence = markdown.renderer.rules.fence;
markdown.renderer.rules.fence = (tokens, idx, options, env, self) => {
  if (env.source === "ONBOARDING.md" && tokens[idx].info.trim() === "text") {
    return `<div class="copy-bar"><button type="button" data-copy="install-request">설치 요청 복사 <span aria-hidden="true">⧉</span></button><span role="status" aria-live="polite"></span></div><pre><code id="install-request">${escape(tokens[idx].content)}</code></pre>`;
  }
  return originalFence(tokens, idx, options, env, self);
};
const render = (source, text = sources.get(source)) =>
  markdown.render(text, { source, output: htmlPath(source) });
const titleOf = (source) => sources.get(source).match(/^# (.+)$/m)[1];
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
function layout(path, title, body) {
  const href = (target) => relative(path, target);
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(purpose)}"><meta name="theme-color" content="#fafaf7"><title>${escape(title)}${title === "Compass Propaganda" ? "" : " — Compass Propaganda"}</title><link rel="icon" href="${href("assets/symbol.svg")}" type="image/svg+xml"><link rel="stylesheet" href="${href("assets/style.css")}"><script src="${href("assets/client.js")}" defer></script></head>
<body><a class="skip" href="#main">본문으로 건너뛰기</a><div class="shell">
<header class="header"><a class="brand" href="${href("index.html")}" aria-label="Compass Propaganda 홈">${symbol}<span>compass propaganda<span class="brand-korean">컴퍼스 프로파간다</span></span></a><nav aria-label="주 메뉴">${navigationLink(path, "PRINCIPLES.html", "교리")}${navigationLink(path, "recommendations/index.html", "권장")}${navigationLink(path, "downloads.html", "오라클")}<a class="external" href="${repository}">GitHub ↗</a></nav></header>
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
        ["downloads.html", "오라클 받기"],
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
const recommendations = recPaths
  .map((source) => {
    const content = sources.get(source);
    const approved = content.match(
      /^- 승인(?:자·승인일)?: [^\n]+, (\d{4}-\d{2}-\d{2})\.?$/m,
    )?.[1];
    if (
      !approved ||
      !Number.isFinite(Date.parse(approved)) ||
      new Date(approved).toISOString().slice(0, 10) !== approved
    ) {
      throw new Error(
        `${source}: 승인 기록에 유효한 YYYY-MM-DD 날짜가 필요합니다.`,
      );
    }
    return {
      source,
      title: titleOf(source),
      pn: content.match(/Pn: \[(P[1-5])/)[1],
      text: content.match(/## 권장\s+([^\n]+)/)[1],
      approved,
      number: Number(posix.basename(source).match(/^\d+/)[0]),
    };
  })
  .sort((a, b) => b.approved.localeCompare(a.approved) || b.number - a.number);
function recList(from) {
  return recommendations
    .map(
      (rec) =>
        `<a class="recommendation" href="${relative(from, htmlPath(rec.source))}"><span class="recommendation-number">${String(rec.number).padStart(3, "0")}</span><div class="recommendation-content"><div class="recommendation-meta"><span class="pn-code" title="${escape(pnLabels.get(rec.pn))}">${rec.pn}</span><span>승인 <time datetime="${rec.approved}">${rec.approved.replaceAll("-", ".")}</time></span></div><h3>${escape(rec.title)}</h3><p>${escape(rec.text)}</p></div><span class="arrow" aria-hidden="true">→</span></a>`,
    )
    .join("");
}
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "assets"), { recursive: true });
await mkdir(resolve(output, "downloads"), { recursive: true });
for (const file of ["style.css", "client.js", "symbol.svg", "flame.png"])
  await copyFile(resolve(root, "site", file), resolve(output, "assets", file));
for (const file of await readdir(resolve(root, "LICENSES"))) {
  await mkdir(resolve(output, "LICENSES"), { recursive: true });
  await copyFile(
    resolve(root, "LICENSES", file),
    resolve(output, "LICENSES", file),
  );
}
await copyFile(
  resolve(root, "dist/oracle.md"),
  resolve(output, "downloads/oracle.md"),
);
execFileSync(
  "zip",
  [
    "-X",
    "-q",
    resolve(output, "downloads/compass-propaganda.zip"),
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
  const rec = recommendations.find((item) => item.source === source);
  const category = rec
    ? `권장 / ${String(rec.number).padStart(3, "0")}`
    : groups.find(([, entries]) =>
        entries.some(([path]) => path === source),
      )?.[0] || "서고";
  const body = `<main id="main" class="document-layout">${sidebar(path)}<article class="article"><div class="article-meta"><span>${category}${rec ? `<time datetime="${rec.approved}">승인 ${rec.approved.replaceAll("-", ".")}</time>` : ""}</span><a href="${sourceUrl(source)}">원문 보기 ↗</a></div><div class="prose">${render(source)}</div></article></main>`;
  await writeFile(resolve(output, path), layout(path, title, body));
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
<section class="section oracle-section"><h2>오라클</h2><div><p>사용하는 AI에 프롬프트나 skill을 제공하고 사례를 묻습니다. AI는 공개 권장과 공통 원칙을 참고해 답합니다.</p><a class="text-link" href="downloads.html">오라클 받기 <span aria-hidden="true">→</span></a></div></section>
</main>`;
await writeFile(
  resolve(output, "index.html"),
  layout("index.html", "Compass Propaganda", home),
);
const recPage = `<main id="main" class="document-layout">${sidebar("recommendations/index.html")}<article class="article"><div class="article-meta"><span>권장 모음 / ${recommendations.length}편</span><span>승인일 최신순</span></div><div class="prose"><h1>권장</h1><p>자신에게 해당하는 권장과 적용 조건을 읽습니다. 이유가 궁금하면 판단 기록과 출처를 살펴볼 수 있습니다.</p></div><div class="list-note"><span>Pn은 반영을 요청하는 강도입니다.</span><a href="../TERMINOLOGY.html#pn-룰">Pn 룰 읽기 →</a></div>${recList("recommendations/index.html")}</article></main>`;
await writeFile(
  resolve(output, "recommendations/index.html"),
  layout("recommendations/index.html", "권장", recPage),
);
const installPrompt = sources
  .get("ONBOARDING.md")
  .match(/```text\n([\s\S]*?)```/)[1];
const bundle = (await readFile(resolve(root, "dist/oracle.md"), "utf8")).match(
  /문서 묶음 식별자: (.+)/,
)[1];
const downloads = `<main id="main" class="document-layout">${sidebar("downloads.html")}<article class="article"><div class="article-meta"><span>참조 구현 / 다운로드</span><a href="oracle/README.html">구성·설치 안내 ↗</a></div><div class="prose"><h1>오라클 받기</h1><p>공통 가치와 판단 원칙을 자신의 AI에서 사용합니다.<br>권장은 질문할 때 공식 저장소에서 찾아 읽습니다.</p>
<section class="installation"><h2>에이전트에게 설치 맡기기</h2><p>아래 요청을 복사해 지금 사용하는 에이전트에게 전달하세요.</p><div class="copy-bar"><button type="button" data-copy="install-request">설치 요청 복사 <span aria-hidden="true">⧉</span></button><span role="status" aria-live="polite"></span></div><details><summary>설치 요청 내용</summary><pre><code id="install-request">${escape(installPrompt)}</code></pre></details></section></div>
<div class="download-grid"><section class="download-card"><span class="file-format" aria-hidden="true">MD</span><div><h2>프롬프트</h2><p>파일 전체를 AI에 첨부하거나 붙여 넣고 자신의 사례를 적습니다.</p></div><a class="button" href="downloads/oracle.md" download>oracle.md <span aria-hidden="true">↓</span></a></section><section class="download-card"><span class="file-format" aria-hidden="true">ZIP</span><div><h2>Agent Skill</h2><p>압축을 풀고 폴더 전체를 사용하는 에이전트의 skill 위치에 설치합니다.</p></div><a class="button" href="downloads/compass-propaganda.zip" download>skill.zip <span aria-hidden="true">↓</span></a></section></div>
<p class="download-note">사용 방법은 <a href="ONBOARDING.html">입문 안내</a>에, 구성과 생성 절차는 <a href="oracle/README.html">참조 구현 안내</a>에 정리되어 있습니다.</p><details class="download-note"><summary>이 배포본의 원문과 식별자</summary><p><a href="${repository}/tree/${revision}">원문 보기 ↗</a></p><p class="source-line">${escape(bundle)}</p></details></article></main>`;
await writeFile(
  resolve(output, "downloads.html"),
  layout("downloads.html", "오라클 받기", downloads),
);
console.log(
  `Built ${documents.length + 3} pages and oracle downloads in ${output}`,
);
