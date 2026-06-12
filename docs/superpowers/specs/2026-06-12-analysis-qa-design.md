# 분석 결과 기반 질문하기 (Q&A) — 설계

작성일: 2026-06-12
관련: [[project-analysis-feature]], 분석 모달(`AnalysisModal`), 프로바이더 어댑터(`adapter.chat`)

## 목표

분석 결과 화면에서 사용자가 그 결과·데이터에 대해 **이어서 질문**하고 답을 받는 멀티턴 Q&A를 추가한다. 답변은 분석 결과 마크다운과 원본 `datasets`에만 근거하며 할루시네이션을 금지한다.

## 결정 사항 (확정)

- **컨텍스트**: 분석 결과 마크다운 + 원본 데이터. 단 Q&A용은 **경량 컨텍스트**(요약통계 + 성긴 시계열 ~40포인트/시리즈)로 재샘플해 전송.
- **대화 방식**: 멀티턴(히스토리 유지, 턴마다 재전송).
- **UI 위치**: 결과 모달 하단 채팅(입력창 + 답변 누적).
- **백엔드**: 기존 분석 브리지 재사용 + `kind` 분기(접근 A). 어댑터 시그니처(`system`,`user`) 불변.
- **저장분석 재오픈**: 저장 레코드에 **수집 파라미터**를 보관하고, 열 때 `collectFor`로 데이터를 **재수집**해 메모리에 띄운다(저장은 가볍게, Q&A는 데이터 풀로).
- **토큰 절감(후속)**: 프롬프트 캐싱(Anthropic `cache_control`/OpenAI 자동 prefix 캐시 등)은 프로바이더별 차이로 후속 적용. 임베딩/벡터화는 소규모 숫자 시계열엔 부적합하여 채택하지 않음(요약통계가 올바른 압축).

## 아키텍처

기존 분석 파이프라인을 재사용한다.

```
[AskPanel 입력]
  → postAsk({ kind:'ask', scope, datasets, resultMarkdown, history, question, provider, model })
  → POST /api/analysis (기존 엔드포인트, kind로 분기)
     → 저장 후 (provider면) runProviderAnalysis 분기:
        kind==='ask' → buildAskMessages(system=Q&A가이드, user=컨텍스트+히스토리+질문)
        → adapter.chat(system, user) → 응답 .md 작성
  → pollAnalysis(id) (기존 폴링 재사용)
  → AskPanel 스레드에 assistant 답변 누적
```

claude-bridge 프로바이더면 분석과 동일하게 응답파일을 사람이 작성(감시 스크립트 흐름).

## 컴포넌트 / 변경 단위

### 1. `docs/analysis-qa-prompt.md` (신규)
Q&A 시스템 프롬프트. 원칙: 제공된 결과·`datasets` 값에만 근거, 없는 수치·사실 금지(없으면 "데이터에 없음"), 한국어 마크다운, 질문에 직접·간결하게 답.

### 2. `src/entities/analysis/model/analysis.types.ts` (확장)
```ts
export interface AskTurn { role: 'user' | 'assistant'; text: string }

export interface AskRequest {
  id?: string;
  kind: 'ask';
  generatedAt: string;
  scope: AnalysisScope;
  datasets: AnalysisDataset[];      // 빈 배열 허용(저장분석 재오픈 시)
  resultMarkdown: string;           // 직전 분석 결과(전체 탭)
  history: AskTurn[];               // 직전까지의 Q/A
  question: string;
  provider?: string;
  model?: string | null;
}
```
기존 `AnalysisRequest`에는 선택적 `kind?: 'analysis'`를 두어 분기 구분(미지정=analysis).

`AskRequest.datasets`는 **경량 컨텍스트**(요약 + 성긴 시계열)다. 프론트에서 전송 직전 재샘플한다(아래 7).

### 2b. `src/features/analysis/model/saved.types.ts` (확장)
`SavedAnalysis`에 재수집용 파라미터를 추가한다.
```ts
collect?: CollectForParams; // 저장 시점의 tabs/regions/regionLabels/기간/기준일
```
`collect`가 있으면 재오픈 시 `collectFor(collect)`로 데이터를 재수집해 Q&A 컨텍스트로 쓴다. 없으면(구버전 저장) 결과 마크다운만.

### 3. `src/entities/analysis/api/analysis.api.ts` (확장)
- `postAsk(payload: AskRequest): Promise<string>` — POST /api/analysis (재사용).
- `runAsk(payload, opts): Promise<AnalysisResult>` — `postAsk` + 기존 `pollAnalysis`.

### 4. `vite-plugins/analysis-runner.ts` (확장)
- `buildAskMessages(root, req)` 추가: system=`docs/analysis-qa-prompt.md`, user=결과+datasets+history+question을 구조화한 문자열.
- `runProviderAnalysis`에서 `req.kind==='ask'`면 `buildAskMessages`, 아니면 기존 `buildMessages` 사용. 나머지(자격증명·chat·응답쓰기) 동일.

### 5. `vite-plugins/analysis-bridge.ts` (소폭)
POST 핸들러에서 저장 레코드에 `kind`·ask 필드 보존. provider 분기 시 `kind`,`question`,`history`,`resultMarkdown` 전달.

### 6. `src/features/analysis/ui/AskPanel.tsx` (신규)
- props: `scope`, `datasets`, `resultMarkdown`, `provider`, `model`.
- 상태: `turns: AskTurn[]`, `pending`, `error`, `input`.
- 제출 시 `runAsk` 호출, 답변을 `turns`에 누적. 진행 중 취소(AbortController).
- 입력창 하단 sticky, 답변은 `Markdown`(줄바꿈 렌더 재사용)으로 표시.
- 전송 전 예상 입력 토큰 표시(아래 7).
- `datasets`가 비면 "원본 데이터 없이 결과 요약 기준으로 답합니다" 안내.

### 7. 경량 컨텍스트 + 토큰 추정
- `src/features/analysis/lib/collect.ts`(또는 `summarize.ts`)에 `toAskContext(datasets, perSeries=40)` 추가: 각 시리즈를 ~40포인트로 재샘플(요약은 유지). 분석 4,000포인트 예산 대신 Q&A 전용 경량 예산.
- `estimate.ts`에 `estimateAskInputTokens(payload, count)` 추가: ask user 문자열 + Q&A 시스템 프롬프트(`?raw`) 토큰화. AskPanel에서 `loadTokenCounter`로 동적 로드해 입력창 옆 표시. 멀티턴 누적이 보이도록 매 턴 갱신.

### 8. `src/features/analysis/ui/AnalysisModal.tsx` (연결)
- 분석 완료 시 그 요청의 `datasets`와 **수집 파라미터**를 상태에 보관. 저장 시 파라미터를 `SavedAnalysis.collect`에 함께 저장.
- 저장분석 재오픈(`openSaved`) 시 `collect`가 있으면 `collectFor`로 비동기 재수집해 `resultDatasets`를 채운다(로딩 표시). 없으면 결과 마크다운만.
- done 단계 본문 하단에 `<AskPanel>` 렌더(결과 아래). 모달이 닫히거나 "다시 분석" 시 스레드 초기화.
- `resultDatasets`는 Q&A 전송 직전 `toAskContext`로 경량화해 사용.

## 데이터 흐름 상세

1. 분석 done → `setResultDatasets(payload.datasets)`, `resultMarkdown=result`.
2. 사용자 질문 입력 → `turns`에 user 추가, `runAsk` 호출.
3. 응답 도착 → `turns`에 assistant 추가. 다음 질문은 갱신된 `turns`를 history로 전송.
4. 멀티턴: 매 호출마다 `scope+datasets+resultMarkdown+history+question` 재전송(스테이트리스).

## 에러 처리

- 프로바이더 오류(429 등): 해당 질문만 실패, 스레드 유지, 입력 복원 후 재시도 가능. 메시지는 분석과 동일 처리.
- 빈 질문 제출 차단. datasets 없음은 차단이 아니라 안내(결과 기준 답변).
- 폴링 타임아웃: 분석과 동일(5분) 메시지.

## 테스트

- `toAskContext`: 시리즈를 ~40포인트로 재샘플하되 요약(summary)은 보존하는지(단위).
- `buildAskMessages`: history·datasets·resultMarkdown·question 직렬화가 빠짐없이 포함되는지(러너 단위 테스트, 기존 `tests/vite-plugins/analysis-runner.test.ts` 확장).
- `estimateAskInputTokens`: 히스토리가 늘면 토큰 증가(단위 테스트).
- `AskPanel`: 질문 제출 → 답변 누적 렌더, 빈 입력 차단, datasets 없음 안내(RTL).
- `kind` 분기: analysis/ask가 올바른 시스템 프롬프트를 고르는지.
- 저장분석 재오픈: `collect` 있으면 재수집 호출, 없으면 마크다운만(단위/통합).

## 의도된 단순화 (YAGNI)

- 스레드 영속화 없음(모달 닫으면 휘발). 대화 저장은 후속.
- 탭별 분리 컨텍스트 없음 — 전체 결과(모든 탭) + 경량화된 전체 datasets를 컨텍스트로 사용.
- 프롬프트 캐싱 미적용(후속). 임베딩/벡터화는 부적합으로 비채택.
- 구버전 저장분석(`collect` 없음)은 결과 마크다운만으로 답하고 그 사실을 안내.

## 위험 / 비용

- 멀티턴 + 데이터 재전송으로 입력 토큰이 누적 → **경량 컨텍스트(~40포인트/시리즈)** 로 기본 절감 + 예상 토큰 상시 표시로 사용자 인지.
- 무료 모델은 지시 준수·컨텍스트 한도 이슈 가능 → 컨텍스트 한도 근접 경고(기존 estimate의 overContext) 재사용.
- 재수집은 정적 JSON 비동기 로드 → 재오픈 직후 잠깐 "데이터 불러오는 중" 후 질문 가능.
