# 분석 결과 기반 질문하기(Q&A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 분석 결과 화면에서 결과·원본 데이터에 근거해 멀티턴으로 질문/답변하는 기능을 추가한다.

**Architecture:** 기존 분석 브리지(`POST/GET /api/analysis` + 폴링)를 재사용하고 요청에 `kind:'ask'`를 더해 러너가 분기한다. Q&A 컨텍스트는 경량화(요약+성긴 시계열)해 전송하며, 저장된 분석은 수집 파라미터로 재수집해 데이터를 되살린다. UI는 결과 모달 하단 채팅 패널.

**Tech Stack:** React 18 + TypeScript, Zustand, Vite dev 미들웨어 플러그인, vitest + @testing-library/react, gpt-tokenizer.

**커밋 정책:** 사용자 전역 규칙상 명시 요청 전엔 커밋하지 않는다. 각 Task의 "Commit" 스텝은 working tree를 정리해 두는 의미이며, 실제 `git commit`은 사용자가 승인하는 체크포인트에서 일괄 수행한다.

---

## File Structure

- `src/entities/analysis/model/analysis.types.ts` — `AskTurn`, `AskRequest`, `AnalysisRequest.kind` 추가 (Task 1)
- `src/entities/analysis/index.ts` — 신규 타입/함수 export (Task 1, 3)
- `src/features/analysis/lib/summarize.ts` — `toAskContext` 경량화 (Task 2)
- `src/entities/analysis/api/analysis.api.ts` — `postAnalysis` 일반화 + `runAsk` (Task 3)
- `docs/analysis-qa-prompt.md` — Q&A 시스템 프롬프트 (Task 4)
- `vite-plugins/analysis-runner.ts` — `buildAskMessages` + `kind` 분기 (Task 5)
- `vite-plugins/analysis-bridge.ts` — ask 필드 러너 전달 (Task 6)
- `src/features/analysis/model/saved.types.ts` — `SavedAnalysis.collect` (Task 7)
- `src/features/analysis/lib/estimate.ts` — `estimateAskInputTokens` (Task 8)
- `src/features/analysis/ui/AskPanel.tsx` — 채팅 UI (Task 9)
- `src/features/analysis/ui/AnalysisModal.tsx` — 데이터 보관·재수집·AskPanel 렌더 (Task 10)

---

## Task 1: Q&A 타입 정의

**Files:**
- Modify: `src/entities/analysis/model/analysis.types.ts`
- Modify: `src/entities/analysis/index.ts`

- [ ] **Step 1: `analysis.types.ts`에 타입 추가**

`AnalysisRequest` 인터페이스에 `kind?: 'analysis';`를 추가하고, 파일 끝에 아래를 추가한다.

```ts
// 한 번의 질문/답변 턴
export interface AskTurn {
  role: 'user' | 'assistant';
  text: string;
}

// 분석 결과 기반 질문 요청. 브리지는 AnalysisRequest와 동일 엔드포인트로 받는다.
export interface AskRequest {
  id?: string;
  kind: 'ask';
  generatedAt: string;
  scope: AnalysisScope;
  datasets: AnalysisDataset[]; // 경량 컨텍스트(요약 + 성긴 시계열)
  resultMarkdown: string;      // 직전 분석 결과(전체 탭)
  history: AskTurn[];          // 직전까지의 Q/A
  question: string;
  provider?: string;
  model?: string | null;
}
```

`AnalysisRequest`에 `kind` 추가:

```ts
export interface AnalysisRequest {
  id?: string;
  kind?: 'analysis'; // 미지정=analysis. ask와 구분용.
  generatedAt: string;
  scope: AnalysisScope;
  datasets: AnalysisDataset[];
  provider?: string;
  model?: string | null;
}
```

- [ ] **Step 2: `index.ts` export 추가**

```ts
export type {
  SeriesSummary,
  SeriesPoint,
  RegionSeries,
  AnalysisTab,
  AnalysisDataset,
  AnalysisScope,
  AnalysisRequest,
  AnalysisResult,
  TokenUsage,
  AskTurn,
  AskRequest,
} from './model/analysis.types';
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add src/entities/analysis/model/analysis.types.ts src/entities/analysis/index.ts
git commit -m "feat(analysis): Q&A 요청 타입(AskRequest/AskTurn) 추가"
```

---

## Task 2: Q&A 컨텍스트 경량화 (`toAskContext`)

**Files:**
- Modify: `src/features/analysis/lib/summarize.ts`
- Test: `tests/features/analysis/ask-context.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/features/analysis/ask-context.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toAskContext } from '../../../src/features/analysis/lib/summarize';
import type { AnalysisDataset } from '../../../src/entities/analysis';

function bigDataset(): AnalysisDataset {
  const series = Array.from({ length: 100 }, (_, i) => ({ date: `2026-01-${i + 1}`, value: i }));
  return {
    tab: 'weekly-price',
    metric: 'saleIndex',
    label: '매매지수',
    unit: '',
    byRegion: {
      서울: {
        summary: { latest: 99, start: 0, changeAbs: 99, changePct: null, min: 0, max: 99, mean: 49.5, direction: 'up' },
        series,
        sampled: false,
      },
    },
  };
}

describe('toAskContext', () => {
  it('시리즈를 40포인트 이하로 줄이고 요약은 보존한다', () => {
    const [d] = toAskContext([bigDataset()], 40);
    const rs = d!.byRegion['서울']!;
    expect(rs.series.length).toBeLessThanOrEqual(40);
    expect(rs.summary.latest).toBe(99); // 요약 유지
    expect(rs.sampled).toBe(true);
  });

  it('이미 짧은 시리즈는 그대로 둔다', () => {
    const small: AnalysisDataset = { ...bigDataset(), byRegion: { 서울: { summary: bigDataset().byRegion['서울']!.summary, series: [{ date: '2026-01-01', value: 1 }], sampled: false } } };
    const [d] = toAskContext([small], 40);
    expect(d!.byRegion['서울']!.series.length).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/features/analysis/ask-context.test.ts`
Expected: FAIL — `toAskContext` 미정의.

- [ ] **Step 3: `summarize.ts`에 구현 추가**

파일 끝에 추가(같은 파일의 `sampleSeries`, `roundValue` 재사용):

```ts
// Q&A 컨텍스트 경량화: 각 시리즈를 perSeries 포인트로 재샘플(요약통계는 보존).
// 분석(4,000포인트)보다 훨씬 작게 보내 멀티턴 토큰 누적을 줄인다.
export function toAskContext(datasets: AnalysisDataset[], perSeries = 40): AnalysisDataset[] {
  return datasets.map(d => {
    const byRegion: AnalysisDataset['byRegion'] = {};
    for (const [region, rs] of Object.entries(d.byRegion)) {
      const { series, sampled } = sampleSeries(rs.series, perSeries);
      byRegion[region] = {
        summary: rs.summary,
        series: series.map(p => ({ date: p.date, value: roundValue(p.value) })),
        sampled: sampled || rs.sampled,
      };
    }
    return { ...d, byRegion };
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/features/analysis/ask-context.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/analysis/lib/summarize.ts tests/features/analysis/ask-context.test.ts
git commit -m "feat(analysis): Q&A용 경량 컨텍스트 변환 toAskContext 추가"
```

---

## Task 3: Q&A API (`postAnalysis` 일반화 + `runAsk`)

**Files:**
- Modify: `src/entities/analysis/api/analysis.api.ts`
- Modify: `src/entities/analysis/index.ts`

- [ ] **Step 1: `postAnalysis` 시그니처 일반화 + `runAsk` 추가**

`analysis.api.ts` 상단 import에 `AskRequest` 추가:

```ts
import type { AnalysisRequest, AnalysisResult, AskRequest } from '../model/analysis.types';
```

`postAnalysis`의 파라미터 타입을 union으로 바꾼다(본문 동일):

```ts
export async function postAnalysis(payload: AnalysisRequest | AskRequest): Promise<string> {
```

파일 끝에 추가:

```ts
// 질문 요청 + 결과 폴링. 엔드포인트·폴링은 분석과 동일하게 재사용.
export async function runAsk(payload: AskRequest, opts: PollOptions = {}): Promise<AnalysisResult> {
  const id = await postAnalysis(payload);
  return pollAnalysis(id, opts);
}
```

- [ ] **Step 2: `index.ts`에 `runAsk` export**

첫 줄을 다음으로 교체:

```ts
export { postAnalysis, pollAnalysis, runAnalysis, runAsk, type PollOptions } from './api/analysis.api';
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add src/entities/analysis/api/analysis.api.ts src/entities/analysis/index.ts
git commit -m "feat(analysis): runAsk API 추가(분석 폴링 재사용)"
```

---

## Task 4: Q&A 시스템 프롬프트

**Files:**
- Create: `docs/analysis-qa-prompt.md`

- [ ] **Step 1: 프롬프트 작성**

```markdown
# 질문 응답 가이드 (분석 결과 기반 Q&A)

분석 결과와 원본 데이터에 대한 후속 질문에 답할 때 따르는 규칙이다.

## 입력 (user 메시지)

- `## 직전 분석 결과`: 앞서 생성된 분석 보고서(마크다운).
- `## 원본 데이터(JSON)`: `{ scope, datasets }`. datasets는 지표별 `byRegion[region]={summary, series}`.
- `## 이전 대화`: 직전까지의 질문/답변.
- `## 새 질문`: 지금 답할 질문.

## 답변 원칙

- **데이터에만 근거한다.** 결과·datasets의 값에서만 인용하고, 없는 수치·사실·지역·기간을 지어내지 않는다. 근거가 없으면 "제공된 데이터로는 알 수 없습니다"라고 답한다.
- 한국어 마크다운으로, 질문에 **직접·간결하게** 답한다. 불필요한 재설명 금지.
- 수치 인용 시 단위·기간을 그대로 따른다(임의 환산·왜곡 금지). 천단위 `,`와 단위를 함께 표기.
- 이전 대화 맥락을 고려하되, 모든 주장은 데이터로 뒷받침한다.
- 결측(`null`)·해당 지표 없음은 "데이터 없음"으로 명시한다.
- 투자 단정·권유는 피하고 관찰된 사실과 그 의미 중심으로 답한다.
```

- [ ] **Step 2: Commit**

```bash
git add docs/analysis-qa-prompt.md
git commit -m "feat(analysis): Q&A 시스템 프롬프트 추가"
```

---

## Task 5: 러너 ask 분기 (`buildAskMessages`)

**Files:**
- Modify: `vite-plugins/analysis-runner.ts`
- Test: `tests/vite-plugins/ask-runner.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/vite-plugins/ask-runner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildAskMessages } from '../../vite-plugins/analysis-runner';

describe('buildAskMessages', () => {
  it('결과·데이터·히스토리·질문을 모두 포함한다', async () => {
    const { system, user } = await buildAskMessages(process.cwd(), {
      kind: 'ask',
      scope: { mode: 'weekly', regions: ['서울'], regionLabels: { 서울: '서울' }, period: { from: 'a', to: 'b' }, tabs: ['weekly-price'] },
      datasets: [{ tab: 'weekly-price', metric: 'm', label: 'L', unit: '', byRegion: {} }],
      resultMarkdown: '## 결론\n상승세입니다.',
      history: [{ role: 'user', text: '왜 올랐어?' }, { role: 'assistant', text: '수요 때문입니다.' }],
      question: '서울은 어때?',
    });
    expect(system.length).toBeGreaterThan(20);
    expect(user).toContain('상승세입니다');
    expect(user).toContain('왜 올랐어?');
    expect(user).toContain('서울은 어때?');
    expect(user).toContain('"metric": "m"');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/vite-plugins/ask-runner.test.ts`
Expected: FAIL — `buildAskMessages` 미정의.

- [ ] **Step 3: `analysis-runner.ts` 수정**

`AnalysisRequestLike`에 ask 필드 추가:

```ts
interface AnalysisRequestLike {
  id?: string;
  kind?: string;
  scope: unknown;
  datasets: unknown;
  resultMarkdown?: string;
  history?: { role: string; text: string }[];
  question?: string;
  provider?: string;
  model?: string | null;
}
```

`buildMessages` 아래에 추가:

```ts
export async function buildAskMessages(root: string, req: AnalysisRequestLike): Promise<{ system: string; user: string }> {
  const system = await fs
    .readFile(path.join(root, 'docs/analysis-qa-prompt.md'), 'utf8')
    .catch(() => '당신은 부동산 데이터 분석가입니다. 제공된 분석 결과와 데이터에만 근거해 한국어로 답하세요.');
  const history = (req.history ?? [])
    .map(t => `${t.role === 'user' ? '질문' : '답변'}: ${t.text}`)
    .join('\n\n');
  const user = [
    '## 직전 분석 결과',
    req.resultMarkdown ?? '(없음)',
    '',
    '## 원본 데이터(JSON)',
    JSON.stringify({ scope: req.scope, datasets: req.datasets }, null, 2),
    '',
    '## 이전 대화',
    history || '(없음)',
    '',
    '## 새 질문',
    req.question ?? '',
  ].join('\n');
  return { system, user };
}
```

`runProviderAnalysis` 내 메시지 빌드 라인을 분기로 교체:

```ts
const { system, user } =
  req.kind === 'ask' ? await buildAskMessages(root, req) : await buildMessages(root, req);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/vite-plugins/ask-runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vite-plugins/analysis-runner.ts tests/vite-plugins/ask-runner.test.ts
git commit -m "feat(analysis): 러너 ask 분기 + buildAskMessages"
```

---

## Task 6: 브리지가 ask 필드 전달

**Files:**
- Modify: `vite-plugins/analysis-bridge.ts`

- [ ] **Step 1: POST 핸들러의 `runProviderAnalysis` 호출 수정**

`if (provider && provider !== 'claude-bridge') { ... }` 블록의 호출을 교체:

```ts
void runProviderAnalysis(root, id, {
  id,
  kind: parsed.kind as string | undefined,
  scope: parsed.scope,
  datasets: parsed.datasets,
  resultMarkdown: parsed.resultMarkdown as string | undefined,
  history: parsed.history as { role: string; text: string }[] | undefined,
  question: parsed.question as string | undefined,
  provider: parsed.provider as string | undefined,
  model: (parsed.model ?? null) as string | null,
});
```

- [ ] **Step 2: 타입체크 + 기존 브리지 테스트**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run tests/vite-plugins`
Expected: 에러 없음, 기존 테스트 통과.

- [ ] **Step 3: Commit**

```bash
git add vite-plugins/analysis-bridge.ts
git commit -m "feat(analysis): 브리지가 ask 컨텍스트를 러너로 전달"
```

---

## Task 7: 저장 분석에 수집 파라미터 보관

**Files:**
- Modify: `src/features/analysis/model/saved.types.ts`

- [ ] **Step 1: `SavedAnalysis`에 `collect` 추가**

import 추가 + 필드 추가:

```ts
import type { TokenUsage } from '../../../entities/analysis';
import type { CollectForParams } from '../lib/collect';

export interface SavedAnalysis {
  id: string;
  name: string;
  createdAt: number;
  scopeLabel: string;
  provider: string;
  model: string;
  usage?: TokenUsage;
  markdown: string;
  collect?: CollectForParams; // 재오픈 시 데이터 재수집용(tabs/regions/기간/기준일). 구버전엔 없음.
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 에러 없음(`save`는 `Omit<...,'id'|'createdAt'>`라 `collect` 자동 허용).

- [ ] **Step 3: Commit**

```bash
git add src/features/analysis/model/saved.types.ts
git commit -m "feat(analysis): 저장분석에 수집 파라미터(collect) 보관"
```

---

## Task 8: Q&A 입력 토큰 추정

**Files:**
- Modify: `src/features/analysis/lib/estimate.ts`
- Test: `tests/features/analysis/estimate-ask.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/features/analysis/estimate-ask.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { encode } from 'gpt-tokenizer';
import { estimateAskInputTokens } from '../../../src/features/analysis/lib/estimate';
import type { AskRequest } from '../../../src/entities/analysis';

const count = (t: string) => encode(t).length;

function base(history: AskRequest['history']): AskRequest {
  return {
    kind: 'ask',
    generatedAt: '',
    scope: { mode: 'weekly', regions: ['서울'], regionLabels: { 서울: '서울' }, period: { from: 'a', to: 'b' }, tabs: ['weekly-price'] },
    datasets: [],
    resultMarkdown: '결론입니다.',
    history,
    question: '서울은 어때?',
  };
}

describe('estimateAskInputTokens', () => {
  it('히스토리가 길수록 토큰이 늘어난다', () => {
    const few = estimateAskInputTokens(base([]), count);
    const many = estimateAskInputTokens(base([{ role: 'user', text: '아주 긴 질문 '.repeat(50) }]), count);
    expect(many).toBeGreaterThan(few);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/features/analysis/estimate-ask.test.ts`
Expected: FAIL — `estimateAskInputTokens` 미정의.

- [ ] **Step 3: `estimate.ts` 수정**

상단 import에 추가:

```ts
import qaPrompt from '../../../../docs/analysis-qa-prompt.md?raw';
import type { AskRequest } from '../../../entities/analysis';
```

파일 끝에 추가(러너 `buildAskMessages`의 user 직렬화와 동일 형식):

```ts
// Q&A 전송 페이로드의 입력 토큰 추정(Q&A 시스템 프롬프트 + 직렬화된 user 메시지).
export function estimateAskInputTokens(req: AskRequest, count: TokenCounter): number {
  const history = req.history.map(t => `${t.role === 'user' ? '질문' : '답변'}: ${t.text}`).join('\n\n');
  const user = [
    '## 직전 분석 결과',
    req.resultMarkdown,
    '',
    '## 원본 데이터(JSON)',
    JSON.stringify({ scope: req.scope, datasets: req.datasets }, null, 2),
    '',
    '## 이전 대화',
    history || '(없음)',
    '',
    '## 새 질문',
    req.question,
  ].join('\n');
  return count(qaPrompt) + count(user) + 8;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/features/analysis/estimate-ask.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/analysis/lib/estimate.ts tests/features/analysis/estimate-ask.test.ts
git commit -m "feat(analysis): Q&A 입력 토큰 추정 estimateAskInputTokens"
```

---

## Task 9: AskPanel 채팅 컴포넌트

**Files:**
- Create: `src/features/analysis/ui/AskPanel.tsx`
- Test: `tests/features/analysis/ask-panel.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/features/analysis/ask-panel.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AskPanel } from '../../../src/features/analysis/ui/AskPanel';
import type { AnalysisScope } from '../../../src/entities/analysis';

vi.mock('../../../src/entities/analysis', async (orig) => {
  const actual = await orig<typeof import('../../../src/entities/analysis')>();
  return { ...actual, runAsk: vi.fn(async () => ({ id: 'x', status: 'done', result: '답변입니다.' })) };
});

const scope: AnalysisScope = { mode: 'weekly', regions: ['서울'], regionLabels: { 서울: '서울' }, period: { from: 'a', to: 'b' }, tabs: ['weekly-price'] };

describe('AskPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('질문을 보내면 답변이 스레드에 누적된다', async () => {
    render(<AskPanel scope={scope} datasets={[]} resultMarkdown="결론" dataAvailable />);
    fireEvent.change(screen.getByPlaceholderText(/질문/), { target: { value: '서울은?' } });
    fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }));
    await waitFor(() => expect(screen.getByText('답변입니다.')).toBeInTheDocument());
    expect(screen.getByText('서울은?')).toBeInTheDocument();
  });

  it('빈 질문은 보내지 않는다', () => {
    const { container } = render(<AskPanel scope={scope} datasets={[]} resultMarkdown="결론" dataAvailable />);
    fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }));
    expect(container.querySelectorAll('[data-role="assistant"]').length).toBe(0);
  });

  it('데이터가 없으면 안내를 표시한다', () => {
    render(<AskPanel scope={scope} datasets={[]} resultMarkdown="결론" dataAvailable={false} />);
    expect(screen.getByText(/원본 데이터 없이/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/features/analysis/ask-panel.test.tsx`
Expected: FAIL — `AskPanel` 미정의.

- [ ] **Step 3: `AskPanel.tsx` 구현**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { runAsk, type AnalysisScope, type AnalysisDataset, type AskTurn, type AskRequest } from '../../../entities/analysis';
import { useProviderStore } from '../../../entities/provider';
import { toAskContext } from '../lib/summarize';
import { estimateAskInputTokens, loadTokenCounter, type TokenCounter } from '../lib/estimate';
import { Markdown } from './AnalysisResult';

interface AskPanelProps {
  scope: AnalysisScope;
  datasets: AnalysisDataset[]; // 원본(전송 시 경량화). 비어 있으면 결과 마크다운만.
  resultMarkdown: string;
  dataAvailable: boolean;      // 원본 데이터 사용 가능 여부(재수집 성공/신규 분석)
}

export function AskPanel({ scope, datasets, resultMarkdown, dataAvailable }: AskPanelProps) {
  const selectedProviderId = useProviderStore(s => s.selectedProviderId);
  const selectedModelId = useProviderStore(s => s.selectedModelId);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const lightDatasets = useMemo(() => toAskContext(datasets), [datasets]);

  // 다음 질문 예상 입력 토큰
  const [count, setCount] = useState<TokenCounter | null>(null);
  useEffect(() => {
    let active = true;
    loadTokenCounter().then(fn => active && setCount(() => fn));
    return () => { active = false; };
  }, []);
  const estTokens = useMemo(() => {
    if (!count) return null;
    const req: AskRequest = { kind: 'ask', generatedAt: '', scope, datasets: lightDatasets, resultMarkdown, history: turns, question: input };
    return estimateAskInputTokens(req, count);
  }, [count, scope, lightDatasets, resultMarkdown, turns, input]);

  const ask = async () => {
    const q = input.trim();
    if (!q || pending) return;
    const history = turns;
    setTurns([...history, { role: 'user', text: q }]);
    setInput('');
    setPending(true);
    setError('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const payload: AskRequest = {
        kind: 'ask',
        generatedAt: new Date().toISOString(),
        scope,
        datasets: lightDatasets,
        resultMarkdown,
        history,
        question: q,
        provider: selectedProviderId,
        model: selectedModelId,
      };
      const res = await runAsk(payload, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setTurns(t => [...t, { role: 'assistant', text: res.result ?? '' }]);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error ? e.message : '질문에 실패했습니다.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h3 className="mb-2 text-sm font-bold text-gray-800">결과에 대해 질문하기</h3>
      {!dataAvailable && (
        <p className="mb-2 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          원본 데이터 없이 결과 요약을 기준으로 답합니다. 세부 수치 질문은 정확하지 않을 수 있습니다.
        </p>
      )}

      <div className="space-y-3">
        {turns.map((t, i) => (
          <div key={i} data-role={t.role} className={t.role === 'user' ? 'text-right' : ''}>
            {t.role === 'user' ? (
              <span className="inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white">{t.text}</span>
            ) : (
              <div className="rounded-lg bg-gray-50 px-3 py-2"><Markdown text={t.text} /></div>
            )}
          </div>
        ))}
        {pending && <p className="text-xs text-gray-400">답변을 기다리는 중…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="sticky bottom-0 mt-3 bg-white pt-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(); } }}
            placeholder="결과/데이터에 대해 질문하세요 (Enter 전송, Shift+Enter 줄바꿈)"
            rows={2}
            className="min-h-0 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => void ask()}
            disabled={pending || !input.trim()}
            className="flex-none rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            질문 보내기
          </button>
        </div>
        {estTokens != null && (
          <p className="mt-1 text-[11px] text-gray-400">예상 입력 ~{Math.round(estTokens).toLocaleString()} tok (멀티턴 누적)</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/features/analysis/ask-panel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/analysis/ui/AskPanel.tsx tests/features/analysis/ask-panel.test.tsx
git commit -m "feat(analysis): 결과 Q&A 채팅 패널 AskPanel"
```

---

## Task 10: AnalysisModal 연결 (데이터 보관·재수집·렌더)

**Files:**
- Modify: `src/features/analysis/ui/AnalysisModal.tsx`

- [ ] **Step 1: import + 상태 추가**

import에 추가:

```ts
import { AskPanel } from './AskPanel';
import { collectFor, type CollectForParams } from '../lib/collect';
import type { AnalysisDataset } from '../../../entities/analysis';
```

(이미 `collectFor`/`collectCurrentView`가 import돼 있으면 중복 추가하지 말고 `CollectForParams`만 추가.)

상태 추가(다른 useState 근처, 조기 반환 위):

```ts
const [resultDatasets, setResultDatasets] = useState<AnalysisDataset[] | null>(null);
const [resultDataLoading, setResultDataLoading] = useState(false);
const lastCollectRef = useRef<CollectForParams | null>(null);
```

- [ ] **Step 2: 현재 화면 수집 파라미터 캡처 헬퍼 추가**

`buildCustomRequest` 근처(조기 반환 위)에 추가:

```ts
// 현재 화면(스토어 기반) 분석의 재수집 파라미터. 저장분석 재오픈 시 collectFor로 재현.
const currentCollectParams = (): CollectForParams => {
  const weekly = useAppStore.getState();
  const monthly = useMonthlyStore.getState();
  const sub = weeklyTab === 'price' ? 'price' : weeklyTab === 'trade' ? 'trade' : 'market';
  const tab = `${mode}-${sub}` as AnalysisTab;
  const regionLabels: Record<string, string> = {};
  for (const r of curRegions) regionLabels[r] = curLabels[r] ?? r;
  return {
    tabs: [tab],
    regions: curRegions,
    regionLabels,
    weeklyPeriod: { from: weekly.fromDate, to: weekly.toDate },
    monthlyPeriod: { from: monthly.fromDate, to: monthly.toDate },
    weeklyBaseDate: weekly.baseDate,
    monthlyBaseDate: monthly.baseDate,
  };
};

// 직접 선택 수집 파라미터.
const customCollectParams = (): CollectForParams => {
  const weekly = useAppStore.getState();
  const monthly = useMonthlyStore.getState();
  const regionLabels: Record<string, string> = {};
  for (const r of pickedRegions) regionLabels[r.key] = r.label;
  return {
    tabs: Array.from(selTabs),
    regions: pickedRegions.map(r => r.key),
    regionLabels,
    weeklyPeriod: weeklyOverride ?? { from: weekly.fromDate, to: weekly.toDate },
    monthlyPeriod: monthlyOverride ?? { from: monthly.fromDate, to: monthly.toDate },
    weeklyBaseDate: weeklyOverride?.base ?? weekly.baseDate,
    monthlyBaseDate: monthlyOverride?.base ?? monthly.baseDate,
  };
};
```

`buildCustomRequest`를 `customCollectParams` 재사용으로 교체:

```ts
const buildCustomRequest = (): Promise<AnalysisRequest> => collectFor(customCollectParams());
```

- [ ] **Step 3: analyze 함수가 collect 파라미터 기록**

```ts
const analyzeCurrent = () => {
  if (!withinRegionLimit(curRegions.length)) return;
  lastCollectRef.current = currentCollectParams();
  runWith(() => collectCurrentView());
};

const analyzeCustom = () => {
  if (!withinRegionLimit(pickedRegions.length)) return;
  lastCollectRef.current = customCollectParams();
  runWith(buildCustomRequest);
};
```

- [ ] **Step 4: `runWith` done 분기에서 datasets 보관**

`setResultScope(payload.scope);` 다음 줄에 추가:

```ts
setResultDatasets(payload.datasets);
```

- [ ] **Step 5: 모달 열림 초기화에 상태 리셋**

`open` 초기화 useEffect의 `setResultScope(null);` 근처에 추가:

```ts
setResultDatasets(null);
setResultDataLoading(false);
lastCollectRef.current = null;
```

- [ ] **Step 6: 저장에 collect 포함**

`saveCurrent`의 `saveAnalysis({ ... })` 객체에 추가:

```ts
collect: lastCollectRef.current ?? undefined,
```

- [ ] **Step 7: 저장분석 재오픈 시 재수집**

`openSaved`를 다음으로 교체:

```ts
const openSaved = (item: SavedAnalysis) => {
  setResult(item.markdown);
  setResultModel(item.model);
  setResultUsage(item.usage);
  setResultScope(null);
  setResultDatasets(null);
  setSavedId(item.id);
  setShowSaved(false);
  setPhase('done');
  if (item.collect) {
    setResultDataLoading(true);
    collectFor(item.collect)
      .then(req => { setResultScope(req.scope); setResultDatasets(req.datasets); })
      .catch(() => {})
      .finally(() => setResultDataLoading(false));
  }
};
```

- [ ] **Step 8: done 단계에 AskPanel 렌더**

`{phase === 'done' && (<ResultBoundary>...</ResultBoundary>)}` 블록을 다음으로 교체:

```tsx
{phase === 'done' && (
  <ResultBoundary>
    <AnalysisReport text={result} scale={fontScale} />
    {resultDataLoading ? (
      <p className="mt-6 border-t border-gray-200 pt-4 text-xs text-gray-400">질문용 데이터를 불러오는 중…</p>
    ) : resultScope ? (
      <AskPanel
        scope={resultScope}
        datasets={resultDatasets ?? []}
        resultMarkdown={result}
        dataAvailable={!!resultDatasets && resultDatasets.length > 0}
      />
    ) : null}
  </ResultBoundary>
)}
```

(주의: `resultScope`는 신규 분석 시 `payload.scope`로 설정됨. 저장 재오픈은 재수집 성공 시 채워짐. 둘 다 없으면 AskPanel 생략.)

- [ ] **Step 9: 타입체크 + 전체 분석 테스트**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run tests/features/analysis tests/vite-plugins`
Expected: 에러 없음, 전체 통과.

- [ ] **Step 10: 브라우저 수동 검증**

dev 서버에서 분석 실행 → 결과 하단에 "결과에 대해 질문하기" 입력창 확인 → 질문 전송 시 답변 누적. 저장 후 재오픈 → "데이터 불러오는 중" 후 질문 가능. (claude-bridge면 응답을 감시 흐름으로 작성, provider면 자동.)

- [ ] **Step 11: Commit**

```bash
git add src/features/analysis/ui/AnalysisModal.tsx
git commit -m "feat(analysis): 결과 모달에 Q&A 패널 연결 + 저장분석 데이터 재수집"
```

---

## Self-Review 체크 결과

- **스펙 커버리지:** kind 분기(T5,6), 경량 컨텍스트(T2,9,10), 멀티턴(T9), 결과 하단 UI(T9,10), 저장분석 재수집(T7,10), 토큰 추정(T8,9), Q&A 프롬프트(T4), 할루시네이션 금지(T4) — 모두 태스크로 매핑됨.
- **플레이스홀더:** 없음(모든 스텝에 실제 코드/명령 포함).
- **타입 일관성:** `AskRequest`/`AskTurn`(T1) → api(T3)·러너(T5)·estimate(T8)·AskPanel(T9)에서 동일 시그니처 사용. `CollectForParams`(collect.ts) → saved.types(T7)·모달(T10) 동일. `toAskContext`(T2) → AskPanel(T9) 사용. `buildAskMessages`(T5) user 형식 ↔ `estimateAskInputTokens`(T8) 형식 일치.
- **YAGNI/단순화:** 스레드 영속·프롬프트 캐싱은 후속. 구버전 저장분석은 마크다운만.
