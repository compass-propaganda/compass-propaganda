// SPDX-License-Identifier: MIT
import { createHash } from "node:crypto";

export function validateIntegrations(config, localPreview = false) {
  if (config.feedback_url) {
    const url = new URL(config.feedback_url);
    const local = localPreview && ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:";
    if ((url.protocol !== "https:" && !local) || url.username || url.password || url.search || url.hash || url.pathname !== "/")
      throw new Error("feedback_url에는 HTTPS API origin이 필요합니다.");
  }
  if (config.follow_it_action) {
    const url = new URL(config.follow_it_action);
    if (url.protocol !== "https:" || url.hostname !== "api.follow.it" || url.username || url.password || url.hash)
      throw new Error("follow_it_action에는 follow.it에서 제공한 가입 폼 주소가 필요합니다.");
  }
}

export function renderFeedback(rec, source, api, escape) {
  if (!api || rec?.effect !== "현행") return "";
  const hash = createHash("sha256").update(source).digest("hex");
  return `<div class="feedback" data-feedback="${escape(api.replace(/\/$/, ""))}" data-recommendation="${rec.number}" data-revision="${hash}"><div class="feedback-buttons" role="group" aria-label="권장에 대한 반응"><button type="button" data-vote="1" aria-label="동의" title="동의" aria-pressed="false" disabled><span aria-hidden="true">▲</span><span class="feedback-vote-label">동의</span><span data-count>—</span></button><button type="button" data-vote="-1" aria-label="비동의" title="비동의" aria-pressed="false" disabled><span aria-hidden="true">▼</span><span class="feedback-vote-label">비동의</span><span data-count>—</span></button></div><form class="feedback-composer" hidden><textarea maxlength="500" rows="2" placeholder="몇 자 덧붙이기" aria-label="중앙만 읽는 선택적 메모"></textarea><button type="submit">보내기</button></form><p role="status" aria-live="polite"></p></div>`;
}

export function renderVoteSummary(rec, api, escape) {
  if (!api || rec.effect !== "현행") return "";
  return `<span class="vote-summary" data-feedback-summary="${escape(api.replace(/\/$/, ""))}" data-recommendation="${rec.number}" aria-label="반응 수 불러오는 중"><span><span aria-hidden="true">▲</span> <span data-count="agree">—</span></span><span><span aria-hidden="true">▼</span> <span data-count="disagree">—</span></span></span>`;
}

export function renderSubscription(action, escape) {
  if (!action) return "";
  return `<section class="subscription" aria-labelledby="subscription-title"><h2 id="subscription-title">주보를 받아보세요</h2><p>교단의 새 소식을 이메일로 전합니다.</p><form action="${escape(action)}" method="post"><label for="subscription-email">이메일</label><div class="subscription-fields"><input id="subscription-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com"><button type="submit">구독하기</button></div></form><p>follow.it에서 발송하며, 구독 확인 메일이 도착합니다. 메일에 다른 추천 콘텐츠가 포함될 수 있습니다. 언제든 구독을 해지할 수 있습니다.</p></section>`;
}
