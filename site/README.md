# 사이트 빌드

`scripts/build-site.mjs`가 저장소의 Markdown 원문에서 HTML과 문서 내 링크·각주를 생성하고, `site/`의 정적 자산을 복사합니다.

## 빌드와 배포

```sh
npm ci
npm test
npm run build
node scripts/check-site.mjs
```

Node.js 20 이상과 `zip` 명령이 필요합니다. `dist/site/`가 정적 배포 경로이며, `downloads/`에는 같은 빌드로 생성한 프롬프트와 skill 압축파일이 들어갑니다. 권장 원문은 이 두 파일에 포함하지 않습니다.

`recommendations/index.md`에는 최신 승인일 순으로 권장 요지·Pn·승인일·원문 주소·내용 해시와 빌드 기준 커밋을 생성합니다. 번호가 붙은 권장 파일과 이들이 참조하는 `PRINCIPLES.md`, `TERMINOLOGY.md`는 같은 경로에 Markdown 원문 그대로 복사합니다. AI는 인덱스에서 후보를 찾고 개별 원문 전체를 읽습니다. 인덱스의 외부 조회용 주소는 공식 배포 주소를 사용합니다.

`.github/workflows/pages.yml`은 PR에서 빌드를 검증하고, 기본 브랜치에 반영되면 GitHub Pages에 배포합니다. 생성물은 Git에서 제외합니다. 모든 사이트 내부 경로는 상대 경로로 작성하여 저장소 이름이 붙은 Pages 주소에서도 사용할 수 있습니다.
