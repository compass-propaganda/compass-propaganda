# 참조 구현 안내

이 문서는 중앙이 제공하는 프롬프트·skill의 구성과 생성·설치를 설명합니다. 구현체가 따라야 할 판단 절차는 [오라클의 실행과 검증](../ORACLE.md)에 정합니다.

## 생성과 설치

에이전트에게 설치를 맡기려면 [입문 안내의 설치 프롬프트](../ONBOARDING.md#ai에-자신의-사례를-묻기)를 사용합니다.

직접 준비할 때는 저장소 루트에서 다음 명령을 실행합니다. [실행 지침](PROMPT.md), 판단 원칙과 용어가 하나의 프롬프트로 묶이고, [skill 진입점](SKILL.md)과 같은 공통 문서를 포함한 Agent Skills 형식의 배포본도 생성됩니다.[^skills] Node.js 20 이상을 사용하며 별도 패키지 설치는 필요하지 않습니다.

```sh
node scripts/build-oracle.mjs
node scripts/build-oracle.mjs --check
```

생성된 `dist/oracle.md`의 전체 내용을 다른 AI에 제공하고 자신의 사례를 덧붙입니다. 신도는 모델이나 계산 도구를 직접 설정하지 않아도 질문할 수 있습니다. AI가 원문 검색이나 계산을 할 수 없는 경우에는 확인하지 못한 부분을 밝히도록 지시합니다.

skill을 지원하는 AI에서는 `dist/compass-propaganda/` 폴더 전체를 해당 도구의 skill 설치 위치에 넣습니다. `SKILL.md`와 `references/oracle.md`를 함께 보관해야 합니다. 특정 AI 제공자의 API나 오라클 전용 서버는 필요하지 않습니다.

## 배포와 판본 확인

`dist/`는 Git에 포함하지 않는 생성물 경로입니다. 원문과 생성 도구를 저장소에서 관리하며, 사이트 빌드가 같은 원문으로 프롬프트와 skill 압축파일을 생성합니다. 완성된 파일은 [오라클 다운로드](https://compass-propaganda.github.io/compass-propaganda/downloads.html)에서 받습니다.

[문서 목록](manifest.json)은 입력 범위를 명시합니다. 생성 파일에는 각 원문의 내용과 SHA-256 해시, 묶음 식별자가 들어갑니다. 원문이 바뀌면 다시 생성해야 하며 `--check`는 변경을 감지합니다. 해시는 내용의 식별 수단이며 중앙의 신원을 인증하는 서명은 아닙니다.

이 도구는 문서 묶음과 skill을 생성하고 변경을 확인합니다. 문서 생성의 재현성은 AI의 판단을 재현하거나 검증한다는 뜻이 아닙니다. 검색과 사례별 판단은 각 신도가 사용하는 AI와 그 도구가 수행합니다. 중앙은 필요에 따라 GitHub 이슈나 PR에서 개선안을 검토합니다. [GitHub Actions](../.github/workflows/oracle.yml)는 생성 도구의 테스트와 생성을 실행하고 커밋별 결과를 보관합니다. PR의 생성물은 검토용이며, 중앙의 배포본은 승인 후 기본 브랜치에 반영한 커밋을 기준으로 식별합니다.

## 인용 자료

[^skills]: [Agent Skills 형식 명세](https://agentskills.io/specification). 확인일: 2026-09-05. 이름·설명을 포함한 `SKILL.md`와 동봉 참조 자료 구조를 따릅니다. 설치 위치와 실제 지원 범위는 사용하는 AI 도구에 따라 다릅니다.
