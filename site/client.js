// SPDX-License-Identifier: MIT
const documentMenu = document.querySelector("[data-document-menu]");
if (documentMenu) {
  const mobile = window.matchMedia("(max-width: 760px)");
  const setMenu = () => {
    documentMenu.open = !mobile.matches;
  };
  setMenu();
  mobile.addEventListener("change", setMenu);
}

for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    const text = document.getElementById(button.dataset.copy).textContent;
    const status = button.nextElementSibling;
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = "복사했습니다.";
    } catch {
      status.textContent = "아래 내용을 선택해 복사해 주세요.";
    }
  });
}
