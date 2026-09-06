// SPDX-License-Identifier: MIT
async function request(endpoint, data) {
  const response = await fetch(endpoint, {
    method: data === undefined ? "GET" : "POST",
    headers: data === undefined ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    credentials: "omit",
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "잠시 후 다시 시도해 주세요.");
  if (![result.agree, result.disagree].every((count) => Number.isSafeInteger(count) && count >= 0))
    throw new Error("반응 수를 읽지 못했습니다.");
  return result;
}

for (const summary of document.querySelectorAll("[data-feedback-summary]")) {
  request(`${summary.dataset.feedbackSummary}/recommendations/${summary.dataset.recommendation}`).then((counts) => {
    for (const count of summary.querySelectorAll("[data-count]")) count.textContent = counts[count.dataset.count];
    summary.setAttribute("aria-label", `동의 ${counts.agree}, 비동의 ${counts.disagree}`);
  }).catch(() => { summary.setAttribute("aria-label", "반응 수를 읽지 못했습니다."); });
}

for (const section of document.querySelectorAll("[data-feedback]")) {
  const buttons = [...section.querySelectorAll("[data-vote]")];
  const status = section.querySelector('[role="status"]');
  const form = section.querySelector("form");
  const textarea = form.querySelector("textarea");
  const submit = form.querySelector('button[type="submit"]');
  const key = `compass-propaganda:feedback:${section.dataset.recommendation}`;
  let visitor;
  let value = 0;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    visitor = saved?.visitor;
    if (typeof visitor !== "string" || !/^[a-f0-9]{32}$/.test(visitor))
      visitor = [...crypto.getRandomValues(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    if ([-1, 0, 1].includes(saved?.value)) value = saved.value;
    localStorage.setItem(key, JSON.stringify({ visitor, value }));
  } catch {
    status.textContent = "반응을 남기려면 브라우저의 사이트 저장 공간을 허용해 주세요.";
    continue;
  }
  const busy = (state) => {
    section.setAttribute("aria-busy", String(state));
    textarea.disabled = state;
    for (const button of section.querySelectorAll("button")) button.disabled = state;
    submit.disabled = state || !textarea.value.trim();
  };
  const show = (counts) => {
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.vote) === value));
      button.querySelector("[data-count]").textContent = counts[Number(button.dataset.vote) === 1 ? "agree" : "disagree"];
      button.setAttribute("aria-label", `${Number(button.dataset.vote) === 1 ? "동의" : "비동의"} ${button.querySelector("[data-count]").textContent}`);
    }
  };
  const endpoint = `${section.dataset.feedback}/recommendations/${section.dataset.recommendation}`;
  async function save(next, note) {
    busy(true);
    status.textContent = "";
    try {
      const result = await request(endpoint, { visitor, revision: section.dataset.revision, value: next, ...(note === undefined ? {} : { note }) });
      value = next;
      show(result);
      form.hidden = !value || note !== undefined;
      if (form.hidden) textarea.value = "";
      try { localStorage.setItem(key, JSON.stringify({ visitor, value })); }
      catch { status.textContent += " 브라우저에 선택을 기억하지 못했습니다."; }
    } catch (error) {
      status.textContent = error.name === "TimeoutError" ? "연결이 지연되고 있습니다. 다시 시도해 주세요." : error.message;
    } finally { busy(false); }
  }
  for (const button of buttons) button.addEventListener("click", () => {
    const next = Number(button.dataset.vote);
    save(next === value ? 0 : next);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (value && textarea.value.trim()) save(value, textarea.value.trim());
  });
  textarea.addEventListener("input", () => {
    submit.disabled = section.getAttribute("aria-busy") === "true" || !textarea.value.trim();
  });
  request(endpoint).then((counts) => { show(counts); busy(false); }).catch(() => {
    status.textContent = "반응 수를 읽지 못했습니다. 버튼을 누르면 다시 연결합니다.";
    busy(false);
  });
}
