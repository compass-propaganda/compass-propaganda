// SPDX-License-Identifier: MIT
// Visual groupings within each comparison column, not ratings of the subjects.
// Use labels rather than column positions so reordered tables keep their meaning.
const comparisonTones = new Map([
  ["목적·관심", new Map([
    ["개인의 삶", "teal"],
    ["소비자 이익", "teal"],
    ["공동의 이익", "blue"],
    ["판단의 설명", "amber"],
    ["신앙의 전승", "violet"],
    ["괴로움 소멸", "rose"],
  ])],
  ["판단 근거", new Map([
    ["가치·자료", "blue"],
    ["관찰·모델", "blue"],
    ["시험·조사", "blue"],
    ["결과 비교", "amber"],
    ["실용·토론", "amber"],
    ["철학·도덕", "amber"],
    ["경전·전승", "violet"],
    ["경전·수행", "violet"],
  ])],
  ["참여·실천", new Map([
    ["일상 실천", "teal"],
    ["공동 탐구", "blue"],
    ["결과 비교", "amber"],
    ["탐색 종료", "amber"],
    ["구매 선택", "amber"],
    ["신앙 실천", "violet"],
    ["수행", "violet"],
    ["의례·봉사", "violet"],
  ])],
]);

function comparisonTone(column, label) {
  // Boolean answers keep their existing check/dash treatment.
  if (label === "예" || label === "아니오") return undefined;
  if (label === "미명시" || label === "판본별") return "neutral";
  const tones = comparisonTones.get(column);
  // New categories remain readable; unrelated columns are not decorated.
  return tones ? tones.get(label) ?? "neutral" : undefined;
}

const comparisonSupportsPopover = "showPopover" in HTMLElement.prototype;

for (const table of document.querySelectorAll(".comparison table")) {
  const headers = [...table.tHead.rows[0].cells].map((cell) =>
    (cell.querySelector("summary") ?? cell).textContent.trim(),
  );
  for (const cell of table.tHead.rows[0].cells) cell.scope = "col";
  for (const row of table.tBodies[0].rows) {
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.append(...row.cells[0].childNodes);
    row.cells[0].replaceWith(heading);
  }

  for (const [index, details] of [...table.querySelectorAll("details")].entries()) {
    const summary = details.querySelector("summary");
    const label = summary.textContent.trim();
    const cell = details.parentElement;
    const row = cell.parentElement;
    const column = headers[cell.cellIndex];
    const isHeader = row.parentElement === table.tHead;
    const tone = isHeader ? undefined : comparisonTone(column, label);
    if (tone) summary.dataset.tone = tone;
    // Keep native disclosures usable and colored without Popover support.
    if (!comparisonSupportsPopover) continue;
    const subject = isHeader
      ? "비교 기준"
      : row.cells[0].textContent.replace(/\[\d+\]/g, "").trim();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "comparison-value";
    button.textContent = label;
    if (tone) button.dataset.tone = tone;
    button.setAttribute("aria-label", `${subject} · ${column}: ${label}, 설명 보기`);
    const answer = { 예: "yes", 아니오: "no" }[label];
    if (answer) {
      button.dataset.answer = answer;
      button.textContent = answer === "yes" ? "✓" : "—";
    }
    const popover = document.createElement("div");
    popover.className = "comparison-popover";
    popover.id = `comparison-note-${index}`;
    popover.popover = "auto";
    const title = document.createElement("strong");
    title.textContent = `${subject} · ${column}`;
    const text = document.createElement("p");
    summary.remove();
    text.append(...details.childNodes);
    popover.append(title, text);
    button.popoverTargetElement = popover;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      if (popover.matches(":popover-open")) {
        popover.hidePopover();
        return;
      }
      popover.showPopover();
      const anchor = button.getBoundingClientRect();
      const { width, height } = popover.getBoundingClientRect();
      const gap = 10;
      popover.style.left = `${Math.max(gap, Math.min(anchor.left + anchor.width / 2 - width / 2, document.documentElement.clientWidth - width - gap))}px`;
      const top = anchor.bottom + gap + height <= window.innerHeight - gap
        ? anchor.bottom + gap : anchor.top - height - gap;
      popover.style.top = `${Math.max(gap, top)}px`;
    });
    details.replaceWith(button, popover);
  }
}

if (comparisonSupportsPopover) {
  // Close an anchored note when its cell moves, but allow scrolling inside the note.
  window.addEventListener("scroll", (event) => {
    if (event.target instanceof Element && event.target.closest(".comparison-popover")) return;
    document.querySelector(".comparison-popover:popover-open")?.hidePopover();
  }, true);
  window.addEventListener("resize", () => {
    document.querySelector(".comparison-popover:popover-open")?.hidePopover();
  });
}
