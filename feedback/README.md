# 권장 반응

Cloudflare Workers와 D1에 동의·비동의 반응과 선택적 메모를 저장합니다. 공개 API는 집계만 반환하며, 메모는 Cloudflare 계정의 관리 권한으로 조회합니다. 사이트는 GitHub Pages에서 계속 제공됩니다.

## 로컬 실행

저장소 루트에서 실행합니다. Worker 도구에는 Node.js 22 이상이 필요합니다.

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix feedback
npm test --prefix feedback
cd feedback
npx wrangler d1 migrations apply DB --local --env local
npm run dev
```

다른 터미널에서 `FEEDBACK_URL=http://127.0.0.1:8787 npm run build`를 실행하고 사이트를 `http://127.0.0.1:4173`에서 제공합니다. 로컬 DB와 테스트 DB는 원격 데이터와 분리됩니다. `npm test --prefix feedback`은 실제 Workers 런타임과 로컬 D1에서 중복·동시 제출, 변경·취소, 입력 검증, 요청 제한과 저장 실패를 확인합니다.

## 연결과 배포

1. Workers Free 계정에서 전용 D1을 생성하고 `wrangler.jsonc`의 최상위 `database_id`를 바꿉니다. 현재의 0으로 채운 값은 미설정 값입니다.
2. `feedback/`에서 `npx wrangler d1 migrations apply DB --remote --env=''`로 스키마를 적용하고 `npm run deploy`로 Worker를 배포합니다.
3. 제공된 HTTPS 주소를 `site/integrations.json`의 `feedback_url`에 넣고 사이트를 빌드·배포합니다. API 주소가 비어 있으면 반응 UI를 생성하지 않습니다.

`prepare.mjs`는 현행 권장의 번호와 원문 해시를 Worker에 포함합니다. 권장 원문이나 효력이 바뀌면 Worker를 먼저 다시 배포하고 사이트를 배포합니다. 판본이 다른 페이지에서 보낸 반응은 저장하지 않고 새로고침을 안내합니다. `.github/workflows/feedback.yml`은 검증만 수행하며 Worker 배포는 위 명령으로 수행합니다.

## 반응과 메모

같은 브라우저에서는 권장마다 하나의 반응을 기억합니다. 반대 버튼을 누르면 변경하고, 같은 버튼을 다시 누르면 반응과 메모를 함께 삭제합니다. 반응을 남기면 바로 아래에 선택적 메모 입력란이 나타나고 전송 후 닫힙니다. API는 새 메모로 기존 메모를 대체하며 빈 메모는 삭제로 처리합니다. 사이트에서 빈 입력란은 제출하지 않습니다. 메모는 브라우저에 보관하지 않습니다. 홈과 권장 목록에는 집계만 표시합니다.

집계는 권장 번호별 누적값입니다. 저장한 반응에는 당시 원문의 해시가 남습니다. 개정 후 다시 반응하면 판본도 갱신하고 이전 판본에 남긴 메모는 지웁니다. Cloudflare 대시보드의 D1 콘솔이나 `wrangler d1 execute`에서 다음 쿼리로 메모를 읽을 수 있습니다.

```sql
SELECT recommendation, revision, value, note, updated_at
FROM votes
WHERE note <> ''
ORDER BY updated_at DESC;
```

조회 결과와 내보낸 데이터는 공개 저장소에 넣지 않습니다. 메모와 브라우저 식별자는 공개 API나 애플리케이션 로그에 반환하지 않습니다. 메모는 D1에 평문으로 저장되므로 해당 Cloudflare 계정의 관리자가 읽을 수 있습니다.

## 운영 범위

이 반응은 익명 의견이며 고유 신도 수나 정경의 승인 투표가 아닙니다. 브라우저 저장 공간을 지우거나 다른 기기를 쓰면 다시 반응할 수 있습니다. 요청 제한은 남용을 줄이지만 이를 완전히 막지는 못합니다.

권장별 무작위 브라우저 식별자의 해시만 D1에 저장합니다. IP는 Cloudflare의 짧은 요청 제한에 사용하며 D1에는 저장하지 않습니다. 허용한 사이트 origin만 브라우저에서 API에 접근할 수 있으나, CORS를 인증으로 간주하지 않습니다.

무료 범위는 [Workers 한도](https://developers.cloudflare.com/workers/platform/limits/)와 [D1 요금](https://developers.cloudflare.com/d1/platform/pricing/)을 따릅니다. 한도에 도달하면 반응 기능이 일시적으로 실패할 수 있습니다. 권장 본문은 계속 읽을 수 있고, 사이트는 저장에 실패한 반응을 성공으로 표시하지 않습니다.
