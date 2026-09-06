// SPDX-License-Identifier: MIT
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
  if (!("showPopover" in HTMLElement.prototype)) continue;

  for (const [index, details] of [...table.querySelectorAll("details")].entries()) {
    const summary = details.querySelector("summary");
    const label = summary.textContent.trim();
    const cell = details.parentElement;
    const row = cell.parentElement;
    const column = headers[cell.cellIndex];
    const subject = row.parentElement === table.tHead
      ? "비교 기준"
      : row.cells[0].textContent.replace(/\[\d+\]/g, "").trim();
    const button = document.createElement("button");
    button.type = "button";
    button.className = "comparison-value";
    button.textContent = label;
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

if ("showPopover" in HTMLElement.prototype) {
  // Close an anchored note when its cell moves, but allow scrolling inside the note.
  window.addEventListener("scroll", (event) => {
    if (event.target instanceof Element && event.target.closest(".comparison-popover")) return;
    document.querySelector(".comparison-popover:popover-open")?.hidePopover();
  }, true);
  window.addEventListener("resize", () => {
    document.querySelector(".comparison-popover:popover-open")?.hidePopover();
  });
}
