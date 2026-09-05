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
    for (const child of token.children || []) {
      if (child.type !== "link_open") continue;
      if (pnMetadata) child.attrJoin("class", "pn");
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
markdown.renderer.rules.table_open = () =>
  '<div class="table-scroll" tabindex="0" role="region" aria-label="비교 표"><table>\n';
markdown.renderer.rules.table_close = () => "</table></div>\n";
const originalFence = markdown.renderer.rules.fence;
markdown.renderer.rules.fence = (tokens, idx, options, env, self) => {
  if (env.source === "ONBOARDING.md" && tokens[idx].info.trim() === "text") {
    return `<div class="copy-bar"><button type="button" data-copy="install-request">설치 요청 복사</button><span role="status" aria-live="polite"></span></div><pre><code id="install-request">${escape(tokens[idx].content)}</code></pre>`;
  }
  return originalFence(tokens, idx, options, env, self);
};
const render = (source, text = sources.get(source)) =>
  markdown.render(text, { source, output: htmlPath(source) });
const titleOf = (source) => sources.get(source).match(/^# (.+)$/m)[1];
function layout(path, title, body) {
  const href = (target) => relative(path, target);
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escape(purpose)}"><meta name="theme-color" content="#ffffff"><title>${escape(title)}${title === "Compass Propaganda" ? "" : " — Compass Propaganda"}</title><link rel="icon" href="${href("assets/symbol.svg")}" type="image/svg+xml"><link rel="stylesheet" href="${href("assets/style.css")}"><script src="${href("assets/client.js")}" defer></script></head>
<body><a class="skip" href="#main">본문으로 건너뛰기</a><div class="shell"><header class="header"><a class="brand" href="${href("index.html")}" aria-label="Compass Propaganda 홈">${symbol}<span>compass<br>propaganda</span></a><nav aria-label="주 메뉴"><a href="${href("PRINCIPLES.html")}">교리</a><a href="${href("recommendations/index.html")}">권장</a><a class="nav-action" href="${href("downloads.html")}">오라클 ↗</a><a class="external" href="${repository}">GitHub ↗</a></nav></header>${body}<footer class="footer"><span>Compass Propaganda<br>컴퍼스 프로파간다</span><div class="footer-links"><a href="${href("ONBOARDING.html")}">입문 안내</a><a href="${href("LICENSE.html")}">CC BY-SA 4.0</a><a href="${repository}">원문 저장소 ↗</a></div></footer></div></body></html>`;
}
function sidebar(current) {
  const href = (target) => relative(current, target);
  return `<aside class="sidebar"><details open><summary>문서 목차</summary>${groups.map(([name, entries]) => `<div class="sidebar-group"><p>${name}</p>${entries.map(([source, label]) => `<a href="${href(htmlPath(source))}"${current === htmlPath(source) ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</div>`).join("")}<div class="sidebar-group"><p>권장과 자료</p><a href="${href("recommendations/index.html")}">권장 모음</a><a href="${href("downloads.html")}">오라클 받기</a><a href="${href("PLAN.html")}">설계 계획</a></div></details></aside>`;
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
        `<a class="recommendation" href="${relative(from, htmlPath(rec.source))}"><span class="pn">${rec.pn}</span><div><h3>${escape(rec.title)}</h3><p>${escape(rec.text)}</p><div class="recommendation-date">승인 <time datetime="${rec.approved}">${rec.approved.replaceAll("-", ".")}</time></div></div><span class="arrow" aria-hidden="true">↗</span></a>`,
    )
    .join("");
}
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "assets"), { recursive: true });
await mkdir(resolve(output, "downloads"), { recursive: true });
for (const file of ["style.css", "client.js", "symbol.svg"])
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
  const body = `<main id="main" class="document-layout">${sidebar(path)}<article class="article"><div class="article-meta"><span>COMPASS PROPAGANDA / 문서</span><a href="${sourceUrl(source)}">원문 보기 ↗</a></div><div class="prose">${render(source)}</div></article></main>`;
  await writeFile(resolve(output, path), layout(path, title, body));
}
const mission = purpose;
const home = `<main id="main"><section class="hero"><div><div class="eyebrow">An open source religion</div><h1>권장합니다.<br><span>근거는 공개합니다.</span></h1><p>복잡한 비교와 근거 검토를 함께 맡고,<br>각자의 삶에서 믿고 참고할 수 있는 선택을 권합니다.</p><div class="hero-actions"><a class="button" href="ONBOARDING.html">입문 안내 <span aria-hidden="true">↗</span></a><a href="PRINCIPLES.html">판단 원칙 읽기</a></div></div><div class="hero-symbol">${symbol}</div></section><section class="statement"><div class="eyebrow">Our purpose / 목적</div><p>${escape(mission)}</p></section><section class="section"><div class="routes"><a class="route" href="PRINCIPLES.html"><span class="number">01 / PRINCIPLES</span><h3>무엇을 믿는가 ↗</h3><p>고통과 즐거움, 자율성과 관계.<br>판단의 출발점이 되는 공동의 가치.</p></a><a class="route" href="APPROACH.html"><span class="number">02 / APPROACH</span><h3>어떻게 판단하는가 ↗</h3><p>사실과 가치 선택을 구분하고,<br>근거와 반례로 판단을 고치는 방법.</p></a><a class="route" href="GOVERNANCE.html"><span class="number">03 / PARTICIPATION</span><h3>어떻게 함께하는가 ↗</h3><p>참여와 실천은 자유입니다.<br>질문하고, 수정하고, 다르게 생각할 수 있습니다.</p></a></div></section><section class="section"><div class="section-label"><h2>일상의 권장</h2><a href="recommendations/index.html">모두 읽기 ↗</a></div>${recList("index.html")}</section><section class="section"><div class="oracle-strip"><div><h2>오라클 사용하기</h2><p>사용하는 AI에 프롬프트나 skill을 제공하고 사례를 묻습니다.<br>AI는 공개 권장과 공통 원칙을 참고해 답합니다.</p></div><a class="button" href="downloads.html">오라클 받기 <span aria-hidden="true">↗</span></a></div></section></main>`;
await writeFile(
  resolve(output, "index.html"),
  layout("index.html", "Compass Propaganda", home),
);
const recPage = `<main id="main" class="document-layout">${sidebar("recommendations/index.html")}<article class="article"><div class="prose"><h1>권장</h1><p>자신에게 해당하는 권장과 적용 조건을 읽습니다. 이유가 궁금하면 판단 기록과 출처를 살펴볼 수 있습니다.</p><p>Pn은 반영을 요청하는 강도입니다. <a href="../TERMINOLOGY.html#pn-룰">Pn 룰 읽기 ↗</a></p></div>${recList("recommendations/index.html")}</article></main>`;
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
const downloads = `<main id="main" class="document-layout">${sidebar("downloads.html")}<article class="article"><div class="prose"><h1>오라클 받기</h1><p>공통 가치와 판단 원칙을 자신의 AI에서 사용합니다.<br>권장은 질문할 때 공식 저장소에서 찾아 읽습니다.</p><h2>에이전트에게 설치 맡기기</h2><p>아래 요청을 복사해 지금 사용하는 에이전트에게 전달하세요.</p><div class="copy-bar"><button type="button" data-copy="install-request">설치 요청 복사</button><span role="status" aria-live="polite"></span></div><details><summary>설치 요청 내용</summary><pre><code id="install-request">${escape(installPrompt)}</code></pre></details></div><div class="download-grid"><section class="download-card"><h2>프롬프트</h2><p>파일 전체를 AI에 첨부하거나 붙여 넣고 자신의 사례를 적습니다.</p><a class="button secondary" href="downloads/oracle.md" download>oracle.md <span aria-hidden="true">↓</span></a></section><section class="download-card"><h2>Agent Skill</h2><p>압축을 풀고 폴더 전체를 사용하는 에이전트의 skill 위치에 설치합니다.</p><a class="button secondary" href="downloads/compass-propaganda.zip" download>skill.zip <span aria-hidden="true">↓</span></a></section></div><p class="download-note">사용 방법은 <a href="ONBOARDING.html">입문 안내</a>에, 구성과 생성 절차는 <a href="oracle/README.html">참조 구현 안내</a>에 정리되어 있습니다.</p><details class="download-note"><summary>이 배포본의 원문과 식별자</summary><p><a href="${repository}/tree/${revision}">원문 보기 ↗</a></p><p class="source-line">${escape(bundle)}</p></details></article></main>`;
await writeFile(
  resolve(output, "downloads.html"),
  layout("downloads.html", "오라클 받기", downloads),
);
console.log(
  `Built ${documents.length + 3} pages and oracle downloads in ${output}`,
);
