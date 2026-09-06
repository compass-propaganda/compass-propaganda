# 사이트 빌드

`scripts/build-site.mjs`가 저장소의 Markdown 원문에서 HTML과 문서 내 링크·각주를 생성하고, `site/`의 정적 자산을 복사합니다.

## 빌드와 배포

```sh
npm ci
npm test
npm run build
node scripts/check-site.mjs
```

Node.js 20 이상과 `zip` 명령이 필요합니다. `dist/site/`가 정적 배포 경로이며, `setup-oracle/`에는 같은 빌드로 생성한 프롬프트와 skill 압축파일이 들어갑니다. 권장 원문은 이 두 파일에 포함하지 않습니다.

`recommendations/index.md`에는 최신 승인일 순으로 권장 요지·Pn·승인자·승인일·원문 주소·내용 해시와 빌드 기준 커밋을 생성합니다. 번호가 붙은 권장 파일과 이들이 참조하는 `PRINCIPLES.md`, `TERMINOLOGY.md`는 YAML 프런트 매터를 포함하여 같은 경로에 Markdown 원문 그대로 복사합니다. AI는 인덱스에서 후보를 찾고 개별 원문 전체를 읽습니다. 인덱스의 외부 조회용 주소는 공식 배포 주소를 사용합니다.

`.github/workflows/pages.yml`은 PR에서 빌드를 검증하고, 기본 브랜치에 반영되면 GitHub Pages에 배포합니다. 생성물은 Git에서 제외합니다. 탐색 링크와 자산 경로는 상대 경로로 작성하여 저장소 이름이 붙은 Pages 주소에서도 사용할 수 있습니다. canonical과 공유 메타데이터에는 공식 배포 주소를 사용합니다.

`scripts/recommendations.mjs`가 [운영과 참여](../GOVERNANCE.md#제안에서-발행까지)에 따른 YAML 프런트 매터를 파싱합니다. 사이트는 그 결과로 Pn 뱃지·효력·작성·승인 정보와 대체 링크를 표시하고 인덱스를 생성합니다. 제목과 번호는 본문과 파일명에서 읽습니다. 홈과 현행 목록에는 현행 권장만 표시하고, 철회·대체된 권장은 별도로 남깁니다. 알 수 없는 필드, 필수 값 누락·중복, 잘못된 날짜와 값, 대체 대상 누락과 순환 참조는 빌드 오류로 처리합니다.

## 검색과 공유 메타데이터

페이지마다 제목·설명·canonical, [Open Graph](https://ogp.me/)와 공유 카드 메타데이터를 생성합니다. 설명은 원문의 첫 문단을 사용하며, 권장은 권장 요지를 사용합니다. 홈·판단 원칙에는 목적을, 용어·목록·오라클 설치·사용 안내에는 해당 페이지의 소개를 사용합니다.

공유 이미지는 `symbol.svg`에서 만든 `social.png`를 복사합니다. 심볼을 바꾸면 저장소 루트에서 다음 명령으로 다시 생성할 수 있습니다. SVG 렌더러는 이 작업에서만 사용하며 일반 사이트 빌드에는 필요하지 않습니다.

```sh
node --input-type=module <<'JS' | npx --yes @resvg/resvg-js-cli@2.6.2-beta.1 - site/social.png
import {readFileSync} from 'node:fs';
const symbol = readFileSync('site/symbol.svg', 'utf8').replace('<svg ', '<svg x="512" y="227" width="176" height="176" color="#30343a" ');
process.stdout.write(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#fafaf7"/>${symbol}</svg>`);
JS
```

`check-site.mjs`는 페이지별 메타데이터와 대표 주소, 공유 이미지의 존재·크기를 확인합니다.

## 오라클 사용 안내

`scripts/setup-oracle.mjs`가 서비스별 시작 방법을 표시합니다. 설치·시작·프로젝트 지침은 `oracle/prompts/`의 Markdown 원문을 읽으며, 원문의 역할은 [참조 구현 안내](../oracle/README.md#프롬프트-원문)에 정리합니다. 설치 요청 원문은 `setup-oracle/install.md`로도 공개합니다. `site/setup-oracle.js`가 서비스 선택과 키보드 탐색을 제공하며, JavaScript가 없으면 모든 안내를 순서대로 읽을 수 있습니다. 파일 다운로드는 스크립트 없이도 동작합니다.

일반 채팅의 복사문은 생성된 `dist/oracle.md` 전체에 시작 지침을 덧붙입니다. 별도 요약본을 유지하지 않으며, 상황 입력용 placeholder를 넣지 않습니다. 서비스 기능·설치 화면은 각 안내에 연결한 공식 문서를 기준으로 확인합니다. 프로젝트·Gem에 파일을 저장하는 것과 자문에서 공개 권장 원문을 조회하는 것은 별도로 검증합니다. 아이콘의 출처와 조건은 `site/brands/README.md`에 기록합니다.
