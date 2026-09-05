# 사이트 빌드

루트의 Markdown이 문서 원문이며, `scripts/build-site.mjs`가 HTML과 문서 내 링크·각주를 생성합니다. 로고는 `symbol.svg`, 화면과 복사 동작은 `style.css`·`client.js`에서 관리합니다.

```sh
npm ci
npm test
npm run build
node scripts/check-site.mjs
```

Node.js 20 이상과 `zip` 명령이 필요합니다. `dist/site/`가 정적 배포 경로이며, `downloads/`에는 같은 빌드로 생성한 프롬프트와 skill 압축파일이 들어갑니다. 권장 원문은 이 두 파일에 포함하지 않습니다.

`.github/workflows/pages.yml`은 PR에서 빌드를 검증하고, 기본 브랜치에 반영되면 GitHub Pages에 배포합니다. 생성물은 Git에서 제외합니다. 모든 사이트 내부 경로는 상대 경로로 작성하여 저장소 이름이 붙은 Pages 주소에서도 사용할 수 있습니다.
