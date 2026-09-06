# 사이트 빌드

`scripts/build-site.mjs`가 저장소의 Markdown 원문에서 HTML과 문서 내 링크·각주를 생성하고, `site/`의 정적 자산을 복사합니다.

## 빌드와 배포

```sh
npm ci --ignore-scripts
npm test
npm run build
node scripts/check-site.mjs
```

Node.js 20 이상과 `zip` 명령이 필요합니다. `dist/site/`가 정적 배포 경로이며, `setup-oracle/`에는 같은 빌드로 생성한 프롬프트와 skill 압축파일이 들어갑니다. 권장 원문은 이 두 파일에 포함하지 않습니다.

`recommendations/index.md`에는 최신 승인일 순으로 권장 요지·Pn·승인자·승인일·원문 주소·내용 해시와 빌드 기준 커밋을 생성합니다. HTML로 발행하는 문서는 `APPROACH.md`를 포함해 같은 경로에 Markdown 원문도 복사합니다. 권장 파일의 YAML 프런트 매터와 본문 바이트를 유지하므로 인덱스와 반응 API의 원문 해시는 바뀌지 않습니다. AI는 인덱스에서 후보를 찾고 개별 원문 전체를 읽습니다. 인덱스의 외부 조회용 주소는 공식 배포 주소를 사용합니다.

`.github/workflows/pages.yml`은 PR에서 빌드를 검증하고, 기본 브랜치에 반영되면 GitHub Pages에 배포합니다. 생성물은 Git에서 제외합니다. 탐색 링크와 자산 경로는 상대 경로로 작성하여 저장소 이름이 붙은 Pages 주소에서도 사용할 수 있습니다. canonical과 공유 메타데이터에는 공식 배포 주소를 사용합니다.

`scripts/recommendations.mjs`가 [운영과 참여](../GOVERNANCE.md#제안에서-발행까지)에 따른 YAML 프런트 매터를 파싱합니다. 사이트는 그 결과로 Pn 뱃지·효력·작성·승인 정보와 대체 링크를 표시하고 인덱스를 생성합니다. 제목과 번호는 본문과 파일명에서 읽습니다. 홈과 현행 목록에는 현행 권장만 표시하고, 철회·대체된 권장은 별도로 남깁니다. 알 수 없는 필드, 필수 값 누락·중복, 잘못된 날짜와 값, 대체 대상 누락과 순환 참조는 빌드 오류로 처리합니다.

## 원어와 대응어 병기

검색과 개념 식별에 도움이 되는 학술 개념·인명·저작명을 골라, 문서의 첫 주요 등장이나 정의하는 자리에서 병기합니다. 통용되는 영어 대응어와 원전 언어를 구분하고, `lang`에는 실제로 적은 언어를 지정합니다. 영어는 `en`, 프랑스어는 `fr`, 로마자 팔리어는 `pi-Latn`처럼 표기합니다. 한국어로 만든 교단 고유 개념에는 새 영문명을 임의로 붙이지 않습니다.

```html
역량 접근<span class="original-term" lang="en">capability approach</span>
```

한국어 뒤에 일반 공백과 `span`을 두며 괄호를 추가하지 않습니다. 제목은 한국어로 유지하고 첫 설명에 병기하여 기존 목차·문서 조각 주소를 보존합니다. 같은 표현을 매번 반복하지 않으며, 이미 원어로 표기한 참고문헌 전체를 소형 병기로 바꾸지 않습니다.

`site/style.css`의 `.prose .original-term`은 기존 보조색 `--muted`, 본문의 85% 크기와 500 굵기를 사용합니다. 표·각주에서 지나치게 작아지지 않도록 기본 루트 글자 크기 기준 13px의 하한을 두며, 사용자 글자 확대에 따라 함께 커집니다. 별도 서체·위첨자·배지·일괄 이탤릭은 쓰지 않습니다. 원어는 본문과 같은 기준선에 두고, 긴 표현은 공백에서 자연스럽게 줄을 바꾸되 화면보다 긴 낱말도 넘치지 않게 합니다. 인쇄에서도 기존 보조색 변수를 따릅니다.

스타일은 해당 클래스에만 적용하며 모든 `span[lang]`에 적용하지 않습니다. 원어는 실제 텍스트로 유지하여 복사·검색·보조기술에서 읽을 수 있게 하고, `aria-hidden`이나 CSS 생성 콘텐츠로 대체하지 않습니다. 공개 Markdown과 오라클 묶음에도 같은 원문의 병기가 남습니다.

## 참고 자료 비교표

`REFERENCES.md`의 비교표는 각 셀의 `<details><summary>요약</summary>설명</details>`에 짧은 표시와 전체 설명을 함께 둡니다. `site/comparison.js`가 `예`·`아니오`를 체크·대시로 표시하고, 클릭·터치·키보드로 여는 설명창을 제공합니다. 유형은 요약 문구 그대로 표시합니다. JavaScript나 Popover API를 사용할 수 없으면 기본 펼침 요소로 읽습니다.

표는 좁은 화면에서 가로로 넘길 수 있으며 사례 열은 고정합니다. 설명창은 표의 스크롤 영역에 잘리지 않도록 브라우저의 Popover API로 표시합니다. 인쇄할 때는 전체 설명을 함께 출력합니다.

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

`check-site.mjs`는 메타데이터·HTML 링크·공유 이미지와 함께 공개 Markdown의 원문 일치, 권장이 참조한 로컬 원문의 존재, 내부 문서의 발행 제외를 확인합니다. 원문 링크를 추가할 때에는 연결 대상이 공개 문서인지도 확인합니다. 저장소 전용 자료를 권장에서 인용할 때에는 저장소 URL을 사용합니다.

## 오라클 사용 안내

발행 대상과 차례의 공통 목록은 `scripts/site-documents.mjs`에서 관리합니다. `PLAN.md`, 작성 양식과 구현 문서는 저장소에만 두며 사이트 차례·HTML·개별 Markdown 발행 대상에서 제외합니다. HTML에서 이 자료를 참조하는 링크는 저장소 원문으로 연결합니다. 실행 규칙은 별도의 서고 페이지가 아니라 오라클 설치용 문서 묶음에 포함합니다. 사이트 이용자에게 필요한 자문 방식·웹 접근·갱신 안내는 `setup-oracle.html`에서 간략히 설명합니다.

`scripts/setup-oracle.mjs`가 서비스별 시작 방법을 표시합니다. 설치·시작·프로젝트 지침은 `oracle/prompts/`의 Markdown 원문을 읽으며, 원문의 역할은 [참조 구현 안내](../oracle/README.md#프롬프트-원문)에 정리합니다. 설치 요청 원문은 `setup-oracle/install.md`로도 공개합니다. `site/setup-oracle.js`가 서비스 선택과 키보드 탐색을 제공하며, JavaScript가 없으면 모든 안내를 순서대로 읽을 수 있습니다. 파일 다운로드는 스크립트 없이도 동작합니다.

일반 채팅의 복사문은 생성된 `dist/oracle.md` 전체에 시작 지침을 덧붙입니다. 별도 요약본을 유지하지 않으며, 상황 입력용 placeholder를 넣지 않습니다. 서비스 기능·설치 화면은 각 안내에 연결한 공식 문서를 기준으로 확인합니다. 프로젝트·Gem에 파일을 저장하는 것과 자문에서 공개 권장 원문을 조회하는 것은 별도로 검증합니다. 아이콘의 출처와 조건은 `site/brands/README.md`에 기록합니다.

## 주보와 참여

`scripts/bulletins.mjs`가 [주보 원문](../bulletins/README.md) 중 발행한 글만 사이트와 `feed.xml`에 반영합니다. 일반 문서의 수정은 새 RSS 항목을 만들지 않습니다. 이메일 구독은 공개 RSS를 follow.it에 등록한 뒤, 제공받은 가입 폼 주소를 `site/integrations.json`의 `follow_it_action`에 설정하여 연결합니다. 서비스가 제공한 폼의 필드도 `scripts/participation.mjs`와 대조합니다. 미설정 상태에서는 이메일 가입 폼을 표시하지 않습니다.

`feedback_url`에는 [권장 반응 API](../feedback/README.md)의 HTTPS origin을 설정합니다. 원문 해시와 번호는 사이트와 Worker가 같은 권장 파일에서 생성합니다. `site/feedback.js`가 반응 변경·취소와 메모 제출을 처리하며, 메모는 사이트 생성물에 포함하지 않습니다. `FEEDBACK_URL` 환경 변수는 로컬 연결을 확인할 때 설정 파일 대신 사용할 수 있습니다.

`follow_it_verification`은 follow.it의 피드 소유 확인용 공개 코드이며 각 페이지의 메타 태그로 생성합니다. 피드는 `https://follow.it/compass-propaganda`에서 제공하고, 이메일 가입은 서비스가 발급한 `follow_it_action`으로 `email` 필드를 전송합니다. 구독자 주소는 사이트나 저장소에 저장하지 않습니다.
