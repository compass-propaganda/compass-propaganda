// SPDX-License-Identifier: MIT
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
