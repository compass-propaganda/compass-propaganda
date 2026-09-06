# AI 활용

성직자는 자료 조사, 초안, 반론 탐색과 설명에 AI를 활용할 수 있습니다. 이 문서는 중앙이 권장을 조사·작성할 때의 검토와 기록을 정합니다. 사용의 가치는 작업 시간과 검토 부담, 결과의 정확성을 함께 비교하여 평가합니다.[^ai-writing]

신도의 사례에 답하는 구현체의 규칙은 [오라클의 실행과 검증](ORACLE.md)에 정리합니다.

반복적으로 맡길 작업은 사람이 단독으로 수행한 경우, AI가 단독으로 수행한 경우, 사람이 AI를 활용한 경우를 같은 기준으로 비교합니다. 사람이 승인하는 책임 구조와 결합된 작업의 성능은 별도로 평가합니다.[^human-ai]

## 원칙에 따른 제안과 검토

AI에 적용할 교리, 확인한 자료와 사안의 조건을 제공하고, 제안이 어떤 원칙에 부합하거나 충돌하는지 비평·수정하게 합니다.[^constitutional]

| 작업 | AI에 맡길 수 있는 부분 | 검토할 내용 |
| --- | --- | --- |
| 권장 참조 | 공개 권장 검색, 적용 조건과 판단 이유의 비교 | 원문·승인·수정 및 철회 여부, 직접 적용과 유사 사례를 참고한 [소견](TERMINOLOGY.md#opinion)의 구분 |
| 자료 조사 | 검색어 제안, 자료 후보 수집, 주장별 요약 | 출처의 실재 여부, 원문이 뒷받침하는 주장과 적용 범위 |
| 선택 비교 | 대안과 반례 제안, 계산 코드 작성, 원칙과의 충돌 탐색 | 입력값과 가정, 코드 실행 결과, 가치기준의 적용 |
| 권장 작성 | 설명 초안, 적용 조건과 변경 사항 정리 | 승인할 결론, 예외, 실제로 확인한 근거와 변경 이유 |

AI가 제시한 출처와 계산은 직접 확인합니다.[^ai-risk] 검토자가 선호하는 결론에 맞춘 응답을 걸러내기 위해 반례를 살피고, 같은 사실에 검토자의 의견만 바꿔 제시했을 때 결론이 달라지는지도 확인합니다.[^sycophancy] 교단의 가치기준을 적용하는 일과 검토자의 예상 답에 맞추는 일을 구분합니다.

## 기록과 승인

AI가 서술한 추론만으로 실제 판단 과정을 모두 파악했다고 보지 않습니다.[^faithfulness] 확인한 출처, 실제 계산 결과와 승인자가 채택한 이유를 연결해 기록합니다. 발행은 사람이 승인합니다.

AI 사용 범위와 승인자가 확인한 출처·판단 이유를 남깁니다. 결론이 특정 AI 실행에 의존하면 그 판단을 검토하는 데 필요한 입력·출력과 확인 가능한 모델 식별자를 함께 보관합니다. 단순한 문장 편집까지 전체 대화 기록을 요구하지 않습니다. 공개 기록에서는 사적 정보를 제외합니다.

AI가 작성한 문서의 작성자는 `AI`로 표기합니다. 실행 기록에서 확인할 수 있는 구체적인 모델명과 추론 설정은 AI 사용 기록에 구분하여 적습니다.

같은 질문을 AI에 다시 보내는 것만으로 계산을 재현했다고 보지 않습니다. 자료와 계산의 기록 및 재현 조건은 [과학적 접근](APPROACH.md#계산과-판단-기록)을 따릅니다.

AI 모델을 교체할 때에는 같은 사례에서 결과의 변화를 확인하고, 모델과 실행 조건의 차이를 기록합니다. 승인과 발행은 [운영과 참여](GOVERNANCE.md#제안에서-발행까지)를 따릅니다.

## 인용 자료

자료 확인일: 2026-09-05.

[^ai-writing]: Shakked Noy & Whitney Zhang (2023). *Experimental evidence on the productivity effects of generative artificial intelligence*. [Science 게재본 DOI](https://doi.org/10.1126/science.adh2586), [저자 공개 작업논문](https://economics.mit.edu/sites/default/files/inline-files/Noy_Zhang_1.pdf). 공개본(2023-03-02)의 실험 설계와 결과를 확인했습니다. 전문직 글쓰기 과제에서 AI 접근을 무작위로 배정했을 때 작업 시간이 줄고 평가된 글의 품질이 개선되었습니다. 과학적 판단이나 삶의 권장 효과를 시험한 연구는 아니므로, 교단의 업무에서는 검토 시간을 포함한 효과를 별도로 평가합니다.

[^constitutional]: Yuntao Bai et al. (2022). *Constitutional AI: Harmlessness from AI Feedback*. [저자들의 연구 설명과 논문 링크](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback). 연구진이 공개한 초록의 원칙 목록, 자기 비평·수정, AI 피드백을 이용한 학습 절차를 참고합니다. 논문은 모델을 훈련하는 방법을 다루며, 프롬프트에 교리를 넣는 것만으로 같은 결과를 얻는다는 증거는 아닙니다. 원칙의 타당성과 새로운 사안에서의 준수 여부는 별도로 검토합니다.

[^human-ai]: Michelle Vaccaro, Abdullah Almaatouq & Thomas Malone (2024). [*When combinations of humans and AI are useful: A systematic review and meta-analysis*](https://arxiv.org/abs/2405.06087). 저자 공개본의 초록을 확인했습니다. 인간과 AI의 결합은 평균적으로 둘 중 더 나은 단독 수행을 넘지 못했으며 작업 종류에 따른 차이가 있었습니다. 결합의 이점을 업무별로 검증할 근거로 참고합니다.

[^ai-risk]: NIST (2024). [*Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile*, NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf), §2.2·2.7 및 MS-2.5-003. 허위 내용을 확신 있게 생성하는 현상과 자동화에 대한 과도한 신뢰를 구분하고, 생성물의 출처와 인용을 검증하도록 제안합니다. 이 문서는 위험 관리 지침이며 특정 모델의 오류율을 측정한 실험은 아닙니다. 사람이 승인한다는 사실만으로 검증을 마쳤다고 보지 않습니다.

[^sycophancy]: Mrinank Sharma et al. (2023). *Towards Understanding Sycophancy in Language Models*. [저자들의 연구 설명과 논문 링크](https://www.anthropic.com/news/towards-understanding-sycophancy-in-language-models). 공개 초록에서 당시 다섯 AI 비서의 네 가지 과제를 대상으로 사용자의 견해에 맞추는 응답과 인간 선호의 관계를 조사한 결과를 참고합니다. 사실 확인보다 동의를 선호할 수 있다는 관찰을 교단의 반례·일관성 검토에 연결합니다. 이 검토 절차가 영합을 완전히 제거한다고 가정하지 않습니다.

[^faithfulness]: Anthropic (2025). [*Reasoning models don't always say what they think*](https://www.anthropic.com/research/reasoning-models-dont-say-think). 연구진의 실험 설명을 확인했습니다. Claude 3.7 Sonnet과 DeepSeek R1이 주어진 힌트에 영향을 받고도 추론 설명에서 그 사용을 밝히지 않는 사례를 다룹니다. 제한된 힌트·객관식 과제의 결과이며, 모든 설명이 무가치하다는 뜻은 아닙니다. 설명문을 실제 자료 접근·도구 실행·계산의 기록과 구분하는 근거로 참고합니다.
