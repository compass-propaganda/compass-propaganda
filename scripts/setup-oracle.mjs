// SPDX-License-Identifier: MIT
export function renderOracleSetup(prompts, oracleText, escape) {
  const { install: installPrompt, setup: setupPrompt, start } = prompts;
  const fullPrompt = `${oracleText}\n\n---\n\n${start}`;
  const otherPrompt = `${oracleText}\n\n---\n\n${prompts["other-start"]}`;
  const copy = (id, label, text) =>
    `<div class="copy-bar"><button type="button" data-copy="${id}">${label} <span aria-hidden="true">⧉</span></button><span role="status" aria-live="polite"></span></div><details class="oracle-prompt"><summary>${label.replace(" 복사", " 내용")}</summary><pre><code id="${id}">${escape(text)}</code></pre></details>`;
  const file = '<a href="setup-oracle/oracle.md" download>oracle.md 받기 ↓</a>';
  const zip =
    '<a href="setup-oracle/compass-propaganda.zip" download>스킬 ZIP 받기 ↓</a>';
  const once = (target = "oracle-full-prompt") =>
    `<p>오라클 전체 내용과 시작 지침을 복사해<br>AI 대화창에 붙여 넣고 보내세요.</p><div class="copy-bar"><button type="button" data-copy="${target}">오라클 복사 <span aria-hidden="true">⧉</span></button><span role="status" aria-live="polite"></span></div><p class="oracle-next">붙여 넣은 내용이 첨부 파일로 바뀌어도 그대로 보내면 됩니다. 자신의 상황은 이어서 편하게 말씀해 주세요.</p>`;
  const alternative = () =>
    `<details class="oracle-alternative"><summary>설치 없이 바로 사용하기</summary>${once()}</details>`;
  const project = (id, name, url) =>
    `<ol class="oracle-steps"><li><a href="${url}" target="_blank" rel="noopener noreferrer">${name} 열기 ↗</a>에서 새 프로젝트를 만들고 이름을 ‘컴퍼스 프로파간다’로 정하세요.</li><li>${file}를 프로젝트의 파일에 추가하세요.</li><li>아래 지침을 프로젝트 지침에 붙여 넣으세요.</li></ol>${copy(`${id}-setup`, "프로젝트 지침 복사", setupPrompt)}<p class="oracle-next">이후에는 이 프로젝트에서 새 대화를 열고 자신의 상황을 물으면 됩니다.</p>`;
  const agent = (id, name, docs) =>
    `<h2>${name}에 스킬 설치하기</h2><p>아래 요청을 복사해 ${name}에 보내세요.<br>한 번 설치하면 새 대화에서도 오라클을 불러올 수 있습니다.</p>${copy(`${id}-install`, "설치 요청 복사", installPrompt.replace("지금 사용하는 에이전트", name))}<p class="oracle-next">설치한 뒤 ‘Compass Propaganda 오라클에 자문합니다’와 함께 자신의 상황을 적어 주세요.</p><details class="oracle-alternative"><summary>직접 설치하기</summary><p>${zip}</p><p>압축을 풀고 <code>compass-propaganda</code> 폴더 전체를 <a href="${docs}" target="_blank" rel="noopener noreferrer">${name}의 사용자 스킬 위치</a>에 넣으세요. <code>SKILL.md</code>와 <code>references/oracle.md</code>를 함께 보관합니다.</p></details>`;
  const services = [
    {
      id: "chatgpt",
      name: "ChatGPT",
      icon: "openai",
      content: `<h2>ChatGPT에서 바로 시작하기</h2>${once()}<details class="oracle-alternative"><summary>프로젝트로 계속 사용하기</summary><p>파일과 지침을 한 번 저장하면 프로젝트 안의 새 대화에서도 사용할 수 있습니다.</p>${project("chatgpt", "ChatGPT", "https://chatgpt.com/")}<p class="oracle-help"><a href="https://learn.chatgpt.com/docs/projects" target="_blank" rel="noopener noreferrer">프로젝트 설정 안내 ↗</a></p></details><details class="oracle-alternative"><summary>스킬을 지원하는 데스크톱에서 사용하기</summary><p>단독 스킬 설치를 지원하는 ChatGPT 데스크톱에서는 아래 요청으로 설치할 수 있습니다. 웹·모바일용 플러그인 배포와는 설치 방식이 다릅니다.</p>${copy("chatgpt-install", "설치 요청 복사", installPrompt)}<p>${zip} · <a href="https://learn.chatgpt.com/docs/build-skills" target="_blank" rel="noopener noreferrer">스킬 안내 ↗</a></p></details>`,
    },
    {
      id: "claude",
      name: "Claude",
      icon: "claude",
      content: `<h2>스킬을 추가해 사용하기</h2><p>스킬을 한 번 추가하면,<br>새 대화에서도 오라클에 자문할 수 있습니다.</p><p><a class="button oracle-primary" href="setup-oracle/compass-propaganda.zip" download>스킬 ZIP 받기 <span aria-hidden="true">↓</span></a></p><ol class="oracle-steps"><li><a href="https://claude.ai/" target="_blank" rel="noopener noreferrer">Claude 열기 ↗</a>에서 설정의 코드 실행 및 파일 생성을 켜세요.</li><li><strong>Customize → Skills → + → Create skill → Upload a skill</strong>에서 받은 ZIP을 압축을 풀지 않고 업로드하세요.</li><li>추가한 스킬을 켜고 ‘Compass Propaganda 오라클에 자문합니다’와 함께 자신의 상황을 적으세요.</li></ol><p class="oracle-help"><a href="https://support.claude.com/en/articles/12512180-use-skills-in-claude" target="_blank" rel="noopener noreferrer">Claude 스킬 설정 안내 ↗</a></p><details class="oracle-alternative"><summary>프로젝트에 자문 모아두기</summary>${project("claude", "Claude", "https://claude.ai/")}<p><a href="https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects" target="_blank" rel="noopener noreferrer">프로젝트 설정 안내 ↗</a></p></details>${alternative()}`,
    },
    {
      id: "gemini",
      name: "Gemini",
      icon: "gemini",
      content: `<h2>Gemini에서 바로 시작하기</h2>${once()}<details class="oracle-alternative"><summary>나만의 오라클 Gem 만들기</summary><p>지침과 파일을 Gem에 한 번 저장하면,<br>다음부터는 Gem을 열고 바로 자문할 수 있습니다.</p><ol class="oracle-steps"><li><a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer">Gemini 열기 ↗</a>에서 <strong>Gems → 새 Gem</strong>을 선택하고 이름을 ‘컴퍼스 프로파간다’로 정하세요.</li><li>${file}를 Gem의 <strong>지식 → 파일 추가</strong>에 업로드하세요.</li><li>아래 지침을 Gem의 지침란에 붙여 넣고 저장하세요.</li></ol>${copy("gemini-setup", "Gem 지침 복사", setupPrompt)}<p class="oracle-next">저장한 Gem을 열고 자신의 상황을 물어보세요.</p><p class="oracle-help"><a href="https://support.google.com/gemini/answer/15146780?hl=ko" target="_blank" rel="noopener noreferrer">Gem 설정 안내 ↗</a></p></details>`,
    },
    {
      id: "codex",
      name: "Codex",
      icon: "codex",
      content: agent(
        "codex",
        "Codex",
        "https://learn.chatgpt.com/docs/build-skills",
      ),
    },
    {
      id: "claude-code",
      name: "Claude Code",
      icon: "claude",
      content: agent(
        "claude-code",
        "Claude Code",
        "https://code.claude.com/docs/en/skills",
      ),
    },
    {
      id: "cursor",
      name: "Cursor",
      icon: "cursor",
      content: agent("cursor", "Cursor", "https://cursor.com/docs/skills"),
    },
    {
      id: "other",
      name: "다른 AI",
      content: `<h2>사용하는 AI에서 바로 시작하기</h2>${once("oracle-other-prompt")}<p class="oracle-next">스킬을 직접 설치할 수 있는 에이전트라면 설치부터 진행하고, 그 외에는 대화에서 바로 자문을 시작하도록 안내합니다.</p><details class="oracle-full-text oracle-alternative"><summary>다른 AI용 복사 내용 보기</summary><pre><code id="oracle-other-prompt">${escape(otherPrompt)}</code></pre></details><details class="oracle-alternative"><summary>직접 설치하기</summary><p>${zip} · <a href="setup-oracle/install.md">설치 요청 원문 ↗</a></p><p><a href="https://geminicli.com/docs/cli/using-agent-skills/" target="_blank" rel="noopener noreferrer">Gemini CLI 설치 안내 ↗</a></p></details>`,
    },
  ];
  return `<div class="oracle-setup" data-oracle-setup><p class="oracle-label" id="oracle-service-label">어떤 AI를 사용하시나요?</p><nav class="oracle-tabs" aria-labelledby="oracle-service-label">${services.map(({ id, name, icon }) => `<a id="tab-${id}" href="#${id}">${icon ? `<img src="assets/brands/${icon}.svg" width="22" height="22" alt="">` : '<span class="oracle-other" aria-hidden="true">···</span>'}<span>${name}</span></a>`).join("")}</nav>${services.map(({ id, content }) => `<section class="oracle-panel prose" id="${id}">${content}</section>`).join("")}</div><details class="oracle-full-text oracle-note"><summary>오라클 원문 보기 · 파일로 받기</summary><p>${file}</p><pre><code id="oracle-full-prompt">${escape(fullPrompt)}</code></pre></details><p class="oracle-note">답변에 현행 권장을 적용하려면 AI가 웹에서 권장 원문을 읽을 수 있어야 합니다. 웹 검색·인터넷 접근 기능을 켜 주세요.</p><details class="oracle-note"><summary>설정한 오라클 갱신하기</summary><p>권장은 자문할 때 공개 원문에서 찾아 읽습니다. 기본 교리나 실행 지침이 바뀌면 이 페이지에서 새 파일을 받아 프로젝트·Gem·스킬의 파일을 교체하세요. 설치 요청을 다시 보내 기존 스킬을 갱신할 수도 있습니다.</p></details>`;
}
