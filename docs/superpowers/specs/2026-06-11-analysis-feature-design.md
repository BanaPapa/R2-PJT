# 분석(Agent Analysis) 기능 설계

작성일: 2026-06-11
상태: 승인됨 (구현 전)

## 1. 목적

KB 부동산 데이터 플랫폼에 **AI 분석 기능**을 도입한다. 사용자가 선택한(또는 현재 보고 있는) 지역·기간·지표 데이터를 묶어 분석을 요청하면, 상세한 자연어 분석 결과를 받아 화면에 표시한다.

**핵심 제약**: 실제 모델 API 연결은 추후 별도 구현한다. 우선은 **앱이 구동되는 동안 Claude(터미널 세션)가 직접 분석을 담당**한다. 이를 위해 앱(브라우저)과 Claude(터미널) 사이를 잇는 dev 전용 브릿지를 둔다.

## 2. 분석 방법 (2가지)

1. **모달 종합 분석** — 헤더의 "분석" 버튼으로 모달을 열고, 지역(멀티)·기간·포함할 지표 탭(주간 시세/거래, 월간 시세/거래/시장)을 직접 골라 분석.
2. **현재 화면 원클릭 분석** — 지금 보고 있는 모드·지표 탭·선택 지역·기간을 그대로 담아 즉시 분석. (모달의 별도 탭에서 한 번 클릭)

두 방법 모두 같은 모달 안의 두 탭(`[현재 화면]`, `[직접 선택]`)으로 제공한다.

## 3. 아키텍처

### 3.1 dev 브릿지 (Vite 플러그인)

`vite-plugins/analysis-bridge.ts` — `apply: 'serve'`(dev 전용). `configureServer`로 미들웨어 등록.

| 메서드 | 경로 | 동작 |
|--------|------|------|
| POST | `/api/analysis` | 본문(AnalysisRequest JSON)을 `.analysis/requests/<id>.json`에 저장. `{ id }` 반환. |
| GET | `/api/analysis/:id` | `.analysis/responses/<id>.md` 존재 시 `{ status:'done', result, model:'claude-code' }`, 없으면 `{ status:'pending' }`. |

- `id`: 타임스탬프 + 랜덤 (예: `20260611-153012-a1b2`).
- `.analysis/`는 프로젝트 루트의 dev 작업 디렉터리. `.gitignore`에 추가.
- 프로덕션 빌드에는 포함되지 않는다. 추후 이 두 엔드포인트만 실제 모델 호출로 교체하면 프론트엔드는 무수정으로 동작한다. (교체 지점이 명확한 단일 경계)

### 3.2 Claude를 실시간 모델로 — 자동 루프

- 백그라운드 감시 스크립트 `scripts/analysis-watch.mjs` (node, 의존성 없음): `.analysis/requests/`에 **응답이 아직 없는** 새 요청 파일이 생기면 그 경로를 stdout에 출력하고 종료한다. (폴링 간격 ~1s)
- 실행: Claude가 `run_in_background`로 감시 스크립트를 띄운다. 새 요청 발생 → 스크립트 종료 → 하네스가 Claude를 깨움.
- Claude 동작: 깨어나면 요청 JSON을 읽고 → 분석 마크다운을 `.analysis/responses/<id>.md`로 작성 → 감시 스크립트를 재실행(재무장).
- 분석 일관성 가이드: `docs/analysis-prompt.md`에 분석이 다뤄야 할 항목을 명시한다.
  - 전체 추세 요약 (한 문단)
  - 지표별·지역별 판독 (최신값, 기간 증감, 방향)
  - 지역 간 비교 (상대 강도/순위)
  - 주목할 변곡점·구간 (급등/급락 시점)
  - 신호·리스크 해석 (지수>100 등 의미)
  - 결론 (쉬운 말 요약)
  - 출력 언어: 한국어, 마크다운.

**전제**: 앱(`npm run dev`)과 이 Claude 세션이 함께 가동 중인 동안만 분석이 동작한다. 세션이 없으면 요청은 `.analysis/requests/`에 남아 다음 세션에서 처리 가능.

### 3.3 프론트엔드 (FSD)

```
src/entities/analysis/
  model/analysis.types.ts      # AnalysisRequest, AnalysisResponse, 요약통계 타입
  api/analysis.api.ts          # postAnalysis(payload) → id, pollAnalysis(id, opts) → result
  index.ts
src/features/analysis/
  lib/collect.ts               # 스토어→AnalysisRequest 패키징 + 요약통계 + 샘플링
  lib/summarize.ts             # 순수 함수: 시계열→요약통계, 균등 샘플링
  ui/AnalysisModal.tsx         # 두 탭(현재 화면/직접 선택), 결과 렌더
  ui/AnalysisResult.tsx        # 마크다운 결과 표시 + 로딩/에러 상태
  index.ts
```

- 헤더(`App.tsx`)에 "분석" 버튼 추가 → 모달 토글.
- 결과 마크다운 렌더는 **자체 경량 렌더러**(제목/문단/리스트/볼드/표 정도)로 처리한다. 외부 의존성(`react-markdown` 등)은 추가하지 않는다.

## 4. 데이터 모델

```ts
// 한 시계열의 요약통계
interface SeriesSummary {
  latest: number | null;      // 최신값
  start: number | null;       // 구간 시작값
  changeAbs: number | null;   // latest - start
  changePct: number | null;   // (latest/start - 1) * 100
  min: number | null;
  max: number | null;
  mean: number | null;
  direction: 'up' | 'down' | 'flat'; // 추세 방향
}

interface RegionSeries {
  summary: SeriesSummary;
  series: Array<{ date: string; value: number | null }>; // 200포인트 초과 시 균등 샘플링
}

interface Dataset {
  tab: 'weekly-price' | 'weekly-trade' | 'monthly-price' | 'monthly-trade' | 'monthly-market';
  metric: string;   // 예: 'saleIndex', 'avgSale'
  label: string;    // 사람이 읽는 지표명
  unit: string;
  byRegion: Record<string, RegionSeries>;
}

interface AnalysisRequest {
  id?: string;
  generatedAt: string;
  scope: {
    mode: 'weekly' | 'monthly' | 'mixed';
    regions: string[];
    regionLabels: Record<string, string>;
    period: { from: string; to: string };
    tabs: string[];
  };
  datasets: Dataset[];
}

interface AnalysisResponse {
  status: 'pending' | 'done' | 'error';
  result?: string;  // 마크다운
  model?: string;
  error?: string;
}
```

## 5. 데이터 수집 (`collect.ts`)

- 대시보드가 이미 쓰는 빌더(`buildChartData`, `fieldRows`, `combineRows`, `forecastRows`, `combineAverage`, 증감/누적 파생)를 재사용해 탭·지표별 시계열을 생성한다.
- 선택 기간(`from~to`)으로 슬라이스한다.
- 각 시계열에 `summarize()`로 요약통계를 계산한다.
- 시계열 길이가 임계치(기본 200) 초과면 균등 간격으로 샘플링(첫·끝 보존)해 페이로드를 제한한다.
- `[현재 화면]`: 현재 `mode`·`weeklyTab`·`selectedRegions`·`fromDate~toDate` 기준 단일 탭 데이터.
- `[직접 선택]`: 선택된 여러 탭을 모아 `datasets`로 묶음. (월간 데이터가 미로드면 로드 후 수집)

## 6. 데이터 흐름

```
[분석 클릭]
  → collect() : 스토어 → AnalysisRequest
  → postAnalysis() : POST /api/analysis → { id }
  → pollAnalysis(id) : GET /api/analysis/:id 반복(간격 ~1.5s, 타임아웃 5분)
        ⟂ (그 사이) 감시 스크립트가 요청 감지 → Claude 깨움 → 분석 → 응답파일 작성
  → status:'done' 수신 → 모달에 마크다운 결과 표시
```

## 7. 에러 처리

- POST/GET 네트워크 실패 → 모달에 에러 메시지 + 재시도 버튼.
- 폴링 타임아웃(5분) → "분석이 지연되고 있습니다" + [계속 대기]/[재시도].
- 빈 선택(지역/탭 없음) → 분석 버튼 비활성 + 안내.
- 감시 스크립트는 잘못된/부분 기록된 JSON에 견고(파싱 실패 시 스킵·다음 폴링).
- 응답 파일은 원자적 쓰기(임시파일 → rename) 권장으로 부분 읽기 방지.

## 8. 테스트

- `summarize.ts`의 순수 함수(요약통계·샘플링)에 단위 테스트 추가. (vitest 신규 도입)
- `collect.ts`는 스토어 모킹 최소화를 위해 빌더 입력→출력 형태 검증 위주.
- 브릿지 미들웨어·모달·자동 루프는 수동 검증 (요청→응답 파일→화면 표시 1회 왕복 확인).

## 9. 범위 밖 (YAGNI)

- 실제 모델 API 연결 (추후 별도).
- 분석 결과 영구 저장/히스토리.
- 대화형 후속 질문(채팅). (이번 2가지 방법에 포함 안 됨)
- 인증·과금·레이트리밋.

## 10. 변경/추가 파일 요약

- 신규: `vite-plugins/analysis-bridge.ts`, `scripts/analysis-watch.mjs`, `docs/analysis-prompt.md`, `src/entities/analysis/*`, `src/features/analysis/*`
- 수정: `vite.config.ts`(플러그인 등록), `src/app/App.tsx`(분석 버튼/모달), `.gitignore`(`.analysis/`)
