# 차트 슬롯 저장 + 지역 선택 기억 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주간/월간에서 선택한 지역·옵션을 세션 간 기억하고, 각 모드별 최대 10개 슬롯에 현재 화면(지역+검색옵션+6개 차트 구성)을 저장/불러오기 한다.

**Architecture:** 두 zustand 스토어(`useAppStore` 주간, `useMonthlyStore` 공용/월간)에 `persist` 미들웨어를 붙여 선택/옵션만 localStorage에 저장. 슬롯은 별도 `useSlotStore`(persist)가 `weekly[10]`/`monthly[10]` 배열로 보유. 슬롯은 정적 JSON에서 차트를 재생성할 수 있는 파라미터(스냅샷)만 저장한다. 복원 시 Y축 자동초기화 effect와의 경쟁은 일회성 가드 `skipYRangeClear`로 해결.

**Tech Stack:** React 19, zustand 5 (+persist middleware), TypeScript, Vitest + @testing-library/react (신규 도입), localStorage.

---

## File Structure

```
src/features/chart-slots/
  model/types.ts          // ChartSetSnapshot, YRange, SlotMode
  model/slot-store.ts     // useSlotStore (persist)
  lib/capture.ts          // capture(mode), apply(snapshot) — 두 스토어 조율
  lib/name.ts             // generateSlotName, summarizeRegions
  ui/SlotControls.tsx     // 헤더 [저장][슬롯▾] + 팝오버 컨테이너
  ui/SlotPopover.tsx      // 10슬롯 목록 UI
  index.ts                // barrel
tests/features/chart-slots/
  name.test.ts
  capture.test.ts
  slot-store.test.ts
  skip-clear.test.ts
```

기존 파일 수정:
- `src/shared/lib/store.ts` — persist 적용
- `src/shared/lib/monthly-store.ts` — persist 적용 + `skipYRangeClear` 상태/액션
- `src/widgets/chart-dashboard/ChartDashboard.tsx` — clear effect 가드
- `src/widgets/monthly-chart-dashboard/MonthlyChartDashboard.tsx` — clear effect 가드
- `src/widgets/monthly-market-dashboard/MonthlyMarketDashboard.tsx` — clear effect 가드
- `src/app/providers/StoreProvider.tsx` — 복원된 월간 모드 init
- `src/app/App.tsx` — 헤더에 `SlotControls` 삽입
- `package.json` — vitest 스크립트/의존성

---

## Task 0: 테스트 환경 도입 (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: 의존성 설치**

Run:
```bash
npm i -D vitest@^2 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```
Expected: 설치 완료, `package.json` devDependencies 갱신.

- [ ] **Step 2: 테스트 스크립트 추가**

`package.json`의 `scripts`에 추가:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: vitest 설정 작성**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 4: 테스트 setup 작성**

Create `tests/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';

// jsdom에는 matchMedia가 없어 recharts/일부 컴포넌트가 참조 시 실패 → 스텁.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
```

- [ ] **Step 5: 스모크 테스트 작성**

Create `tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: 실행 확인**

Run: `npm test`
Expected: PASS (1 passed).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/setup.ts tests/smoke.test.ts
git commit -m "test: Vitest + testing-library 테스트 환경 도입"
```

---

## Task 1: 슬롯 타입 정의

**Files:**
- Create: `src/features/chart-slots/model/types.ts`

- [ ] **Step 1: 타입 작성**

Create `src/features/chart-slots/model/types.ts`:
```ts
import type { ChartOptions } from '../../../shared/config';
import type { WeeklyTab } from '../../../shared/lib/monthly-store';

export type SlotMode = 'weekly' | 'monthly';

export interface YRange {
  min: number;
  max: number;
}

// 슬롯 1개가 담는 전체 스냅샷 — 정적 JSON에서 6개 차트를 재생성할 파라미터.
export interface ChartSetSnapshot {
  id: string;
  name: string;
  mode: SlotMode;
  createdAt: number;
  schemaVersion: number;

  selectedRegions: string[];
  regionLabels: Record<string, string>;
  fromDate: string;
  toDate: string;
  baseDate: string;
  weeklyTab: WeeklyTab;

  tradeMaOn: boolean;
  tradeMaWindow: number;
  baseLineOn: boolean;

  yRanges: Record<string, YRange>;
  tradeYRanges: Record<string, YRange>;
  chartOptions: Record<string, ChartOptions>;
}

export const SLOT_COUNT = 10;
export const SNAPSHOT_SCHEMA_VERSION = 1;

// 모드별 prefix — capture/apply가 yRanges·chartOptions를 필터링/병합할 때 사용.
export const MODE_PREFIXES: Record<SlotMode, string[]> = {
  weekly: ['wp:', 'wt:'],
  monthly: ['mp:', 'mt:', 'mk:'],
};
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc -b --noEmit`
Expected: 에러 없음 (`WeeklyTab`는 monthly-store에서 이미 export됨).

- [ ] **Step 3: Commit**

```bash
git add src/features/chart-slots/model/types.ts
git commit -m "feat: 차트 슬롯 스냅샷 타입 정의"
```

---

## Task 2: 슬롯 이름 생성 유틸

**Files:**
- Create: `src/features/chart-slots/lib/name.ts`
- Test: `tests/features/chart-slots/name.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/features/chart-slots/name.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { summarizeRegions, generateSlotName } from '../../../src/features/chart-slots/lib/name';
import type { ChartSetSnapshot } from '../../../src/features/chart-slots/model/types';

const base: Omit<ChartSetSnapshot, 'selectedRegions' | 'regionLabels' | 'fromDate' | 'toDate'> = {
  id: 'x', name: '', mode: 'weekly', createdAt: 0, schemaVersion: 1,
  baseDate: '', weeklyTab: 'price', tradeMaOn: true, tradeMaWindow: 13,
  baseLineOn: true, yRanges: {}, tradeYRanges: {}, chartOptions: {},
};

describe('summarizeRegions', () => {
  it('단일 지역은 라벨만', () => {
    expect(summarizeRegions(['서울특별시'], { 서울특별시: '서울특별시' })).toBe('서울특별시');
  });
  it('여러 지역은 "대표 외 N"', () => {
    expect(
      summarizeRegions(['서울특별시', '전국', '경기도'], {
        서울특별시: '서울특별시', 전국: '전국', 경기도: '경기도',
      }),
    ).toBe('서울특별시 외 2');
  });
  it('빈 선택은 "(빈 선택)"', () => {
    expect(summarizeRegions([], {})).toBe('(빈 선택)');
  });
});

describe('generateSlotName', () => {
  it('지역 요약 + 연도 구간', () => {
    const snap: ChartSetSnapshot = {
      ...base,
      selectedRegions: ['서울특별시', '전국'],
      regionLabels: { 서울특별시: '서울특별시', 전국: '전국' },
      fromDate: '2023-01-01', toDate: '2026-01-12',
    };
    expect(generateSlotName(snap)).toBe('서울특별시 외 1 · 2023–2026');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/features/chart-slots/name.test.ts`
Expected: FAIL ("Cannot find module .../lib/name").

- [ ] **Step 3: 구현 작성**

Create `src/features/chart-slots/lib/name.ts`:
```ts
import type { ChartSetSnapshot } from '../model/types';

// 선택 지역을 "대표 외 N" 형태로 요약. 라벨이 있으면 라벨 사용.
export function summarizeRegions(
  selectedRegions: string[],
  regionLabels: Record<string, string>,
): string {
  if (selectedRegions.length === 0) return '(빈 선택)';
  const first = regionLabels[selectedRegions[0]!] ?? selectedRegions[0]!;
  if (selectedRegions.length === 1) return first;
  return `${first} 외 ${selectedRegions.length - 1}`;
}

function yearOf(date: string): string {
  return date.slice(0, 4);
}

// 자동 슬롯 이름: "대표지역 외 N · 시작연도–종료연도".
export function generateSlotName(snapshot: ChartSetSnapshot): string {
  const regions = summarizeRegions(snapshot.selectedRegions, snapshot.regionLabels);
  const from = yearOf(snapshot.fromDate);
  const to = yearOf(snapshot.toDate);
  const period = from && to ? ` · ${from}–${to}` : '';
  return `${regions}${period}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/features/chart-slots/name.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/chart-slots/lib/name.ts tests/features/chart-slots/name.test.ts
git commit -m "feat: 슬롯 이름/지역 요약 유틸"
```

---

## Task 3: monthly-store에 skipYRangeClear 가드 추가

**Files:**
- Modify: `src/shared/lib/monthly-store.ts`
- Test: `tests/features/chart-slots/skip-clear.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/features/chart-slots/skip-clear.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useMonthlyStore } from '../../../src/shared/lib/monthly-store';

describe('skipYRangeClear 가드', () => {
  beforeEach(() => {
    useMonthlyStore.setState({ skipYRangeClear: new Set<string>() });
  });

  it('설정한 prefix는 한 번만 소비된다', () => {
    useMonthlyStore.getState().armSkipYRangeClear(['wp:']);
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('wp:')).toBe(true);
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('wp:')).toBe(false);
  });

  it('설정하지 않은 prefix는 소비되지 않는다', () => {
    useMonthlyStore.getState().armSkipYRangeClear(['mp:', 'mk:']);
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('wp:')).toBe(false);
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('mp:')).toBe(true);
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('mk:')).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/features/chart-slots/skip-clear.test.ts`
Expected: FAIL (`armSkipYRangeClear is not a function`).

- [ ] **Step 3: 인터페이스에 가드 필드 추가**

`src/shared/lib/monthly-store.ts`의 `interface MonthlyStore` 안 `baseLineOn: boolean;` 줄 바로 아래에 추가:
```ts
  // 슬롯 복원 시 clearYRanges 자동초기화를 일회성으로 건너뛰기 위한 가드(prefix 집합).
  skipYRangeClear: Set<string>;
```
같은 인터페이스의 `setBaseLineOn: (on: boolean) => void;` 줄 바로 아래에 추가:
```ts
  armSkipYRangeClear: (prefixes: string[]) => void;
  consumeSkipYRangeClear: (prefix: string) => boolean;
```

- [ ] **Step 4: 초기값 추가**

`src/shared/lib/monthly-store.ts`의 store 본문에서 `baseLineOn: true,` 줄 바로 아래에 추가:
```ts
  skipYRangeClear: new Set<string>(),
```

- [ ] **Step 5: 액션 구현 추가**

`setBaseLineOn: on => set({ baseLineOn: on }),` 줄 바로 아래에 추가:
```ts
  armSkipYRangeClear: prefixes =>
    set(s => {
      const next = new Set(s.skipYRangeClear);
      for (const p of prefixes) next.add(p);
      return { skipYRangeClear: next };
    }),
  consumeSkipYRangeClear: prefix => {
    const has = get().skipYRangeClear.has(prefix);
    if (has) {
      set(s => {
        const next = new Set(s.skipYRangeClear);
        next.delete(prefix);
        return { skipYRangeClear: next };
      });
    }
    return has;
  },
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run tests/features/chart-slots/skip-clear.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/lib/monthly-store.ts tests/features/chart-slots/skip-clear.test.ts
git commit -m "feat: 슬롯 복원용 skipYRangeClear 일회성 가드"
```

---

## Task 4: 세 대시보드 clear effect에 가드 적용

**Files:**
- Modify: `src/widgets/chart-dashboard/ChartDashboard.tsx:102-104`
- Modify: `src/widgets/monthly-chart-dashboard/MonthlyChartDashboard.tsx:139-141`
- Modify: `src/widgets/monthly-market-dashboard/MonthlyMarketDashboard.tsx:106-108`

> 이 Task는 effect 동작 변경이므로 단위 테스트 대신 통합 동작은 Task 7(capture/apply)에서 검증한다. 여기서는 타입체크/수동확인만.

- [ ] **Step 1: ChartDashboard 수정**

`src/widgets/chart-dashboard/ChartDashboard.tsx`에서 `clearYRanges`를 가져오는 줄 아래에 `consumeSkipYRangeClear`도 가져온다. 기존:
```ts
  const clearYRanges = useMonthlyStore(s => s.clearYRanges);
```
바로 아래에 추가:
```ts
  const consumeSkipYRangeClear = useMonthlyStore(s => s.consumeSkipYRangeClear);
```
그리고 effect를 다음으로 교체:
```ts
  useEffect(() => {
    if (consumeSkipYRangeClear('wp:')) return; // 슬롯 복원 직후 1회 건너뜀
    clearYRanges('wp:');
  }, [clearYRanges, consumeSkipYRangeClear, fromDate, toDate, baseDate, selectedRegions]);
```

- [ ] **Step 2: MonthlyChartDashboard 수정**

`src/widgets/monthly-chart-dashboard/MonthlyChartDashboard.tsx`의 구조분해(`useMonthlyStore()`)에서 `clearYRanges,` 아래에 `consumeSkipYRangeClear,`를 추가하고 effect를 교체:
```ts
  useEffect(() => {
    if (consumeSkipYRangeClear('mp:')) return;
    clearYRanges('mp:');
  }, [clearYRanges, consumeSkipYRangeClear, fromDate, toDate, baseDate, selectedRegions]);
```

- [ ] **Step 3: MonthlyMarketDashboard 수정**

`src/widgets/monthly-market-dashboard/MonthlyMarketDashboard.tsx`에서 동일 패턴. `clearYRanges`를 가져오는 부분에 `consumeSkipYRangeClear`를 추가하고 effect를 교체:
```ts
  useEffect(() => {
    if (consumeSkipYRangeClear('mk:')) return;
    clearYRanges('mk:');
  }, [clearYRanges, consumeSkipYRangeClear, fromDate, toDate, baseDate, selectedRegions]);
```
> 주의: 해당 파일이 `clearYRanges`/`consumeSkipYRangeClear`를 `useMonthlyStore(s => ...)` 셀렉터로 가져오는지 구조분해로 가져오는지 기존 코드 스타일에 맞춰 추가한다.

- [ ] **Step 4: 타입체크**

Run: `npx tsc -b --noEmit`
Expected: 에러 없음.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/chart-dashboard/ChartDashboard.tsx src/widgets/monthly-chart-dashboard/MonthlyChartDashboard.tsx src/widgets/monthly-market-dashboard/MonthlyMarketDashboard.tsx
git commit -m "feat: 차트 대시보드 clearYRanges에 복원 가드 적용"
```

---

## Task 5: 두 스토어에 persist 적용 (선택 기억)

**Files:**
- Modify: `src/shared/lib/store.ts`
- Modify: `src/shared/lib/monthly-store.ts`

> `Set`은 JSON 직렬화되지 않으므로 `skipYRangeClear`는 partialize에서 제외한다(런타임 전용 가드).

- [ ] **Step 1: useAppStore에 persist 적용**

`src/shared/lib/store.ts` 상단 import에 추가:
```ts
import { persist } from 'zustand/middleware';
```
`export const useAppStore = create<AppStore>((set, get) => ({ ... }));`를 persist로 감싼다. 즉 `create<AppStore>()(persist((set, get) => ({ ...기존 본문... }), { ...설정 }))` 형태로 변경:
```ts
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ...기존 본문 그대로...
    }),
    {
      name: 'kb-weekly',
      partialize: s => ({
        selectedRegions: s.selectedRegions,
        regionLabels: s.regionLabels,
        fromDate: s.fromDate,
        toDate: s.toDate,
        baseDate: s.baseDate,
      }),
    },
  ),
);
```

- [ ] **Step 2: useMonthlyStore에 persist 적용**

`src/shared/lib/monthly-store.ts` 상단 import에 추가:
```ts
import { persist } from 'zustand/middleware';
```
`useMonthlyStore`를 동일 방식으로 감싼다:
```ts
export const useMonthlyStore = create<MonthlyStore>()(
  persist(
    (set, get) => ({
      // ...기존 본문 그대로...
    }),
    {
      name: 'kb-monthly',
      partialize: s => ({
        mode: s.mode,
        weeklyTab: s.weeklyTab,
        tradeMaOn: s.tradeMaOn,
        tradeMaWindow: s.tradeMaWindow,
        baseLineOn: s.baseLineOn,
        yRanges: s.yRanges,
        tradeYRanges: s.tradeYRanges,
        chartOptions: s.chartOptions,
        selectedRegions: s.selectedRegions,
        regionLabels: s.regionLabels,
        fromDate: s.fromDate,
        toDate: s.toDate,
        baseDate: s.baseDate,
      }),
    },
  ),
);
```
> `skipYRangeClear`는 partialize 목록에 넣지 않는다(직렬화 불가, 런타임 전용).

- [ ] **Step 3: 타입체크 + 빌드 확인**

Run: `npx tsc -b --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 수동 동작 확인 (개발 서버)**

Run: `npm run dev` 후 브라우저에서 지역 추가 → 새로고침 → 선택 유지 확인. localStorage에 `kb-weekly`/`kb-monthly` 키 생성 확인.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/store.ts src/shared/lib/monthly-store.ts
git commit -m "feat: 주간/월간 선택·옵션 localStorage 영속화"
```

---

## Task 6: 복원된 월간 모드 초기 로드

**Files:**
- Modify: `src/app/providers/StoreProvider.tsx`

- [ ] **Step 1: StoreProvider에 월간 init 추가**

`src/app/providers/StoreProvider.tsx`를 다음으로 교체:
```tsx
import React, { useEffect } from 'react';
import { useAppStore } from '../../shared/lib/store';
import { useMonthlyStore } from '../../shared/lib/monthly-store';

interface StoreProviderProps {
  children: React.ReactNode;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  const { loadRegions, loadStatus, loadWeeklyData, loadTradeData, loadDates } = useAppStore();

  // Initialize on app start
  useEffect(() => {
    loadRegions();
    loadStatus();
    loadDates();
    loadWeeklyData();
    loadTradeData();

    // 영속화된 모드가 월간이면 월간 데이터도 즉시 로드(setMode 경유 없이 복원된 경우).
    const m = useMonthlyStore.getState();
    if (m.mode === 'monthly' && m.allDates.length === 0) {
      void m.loadDates().then(() => m.loadPriceData());
      void m.loadTradeRegions();
      void m.loadTradeData();
      void m.loadMarketData();
    }
  }, []);

  return <>{children}</>;
};
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc -b --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 수동 확인**

`npm run dev` → 월간 모드로 전환 → 새로고침 → 월간 차트가 빈 화면 없이 바로 로드되는지 확인.

- [ ] **Step 4: Commit**

```bash
git add src/app/providers/StoreProvider.tsx
git commit -m "feat: 복원된 월간 모드 초기 데이터 로드"
```

---

## Task 7: capture / apply (두 스토어 조율)

**Files:**
- Create: `src/features/chart-slots/lib/capture.ts`
- Test: `tests/features/chart-slots/capture.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/features/chart-slots/capture.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../../src/shared/lib/store';
import { useMonthlyStore } from '../../../src/shared/lib/monthly-store';
import { capture, apply } from '../../../src/features/chart-slots/lib/capture';
import { DEFAULT_CHART_OPTIONS } from '../../../src/shared/config';

beforeEach(() => {
  // 데이터 로더는 네트워크/JSON 접근 → no-op으로 대체.
  useAppStore.setState({
    selectedRegions: ['서울특별시', '전국'],
    regionLabels: { 서울특별시: '서울특별시', 전국: '전국' },
    fromDate: '2023-01-01', toDate: '2026-01-12', baseDate: '2026-01-12',
    loadWeeklyData: async () => {}, loadTradeData: async () => {},
  });
  useMonthlyStore.setState({
    mode: 'weekly', weeklyTab: 'price',
    tradeMaOn: true, tradeMaWindow: 13, baseLineOn: true,
    yRanges: { 'wp:saleIndex': { min: 90, max: 110 }, 'mp:saleAptIndex': { min: 80, max: 120 } },
    tradeYRanges: { buyerAdvantage: { min: 0, max: 200 } },
    chartOptions: { 'wp:saleIndex': { ...DEFAULT_CHART_OPTIONS, type: 'bar' } },
    skipYRangeClear: new Set<string>(),
    selectedRegions: ['경기도'], regionLabels: { 경기도: '경기도' },
    fromDate: '2015-01', toDate: '2026-01', baseDate: '2026-01',
    loadPriceData: async () => {}, loadTradeData: async () => {},
    loadTradeRegions: async () => {}, loadMarketData: async () => {}, loadDates: async () => {},
  });
});

describe('capture(weekly)', () => {
  it('주간 선택은 useAppStore에서, wp:/wt: prefix만 담는다', () => {
    const snap = capture('weekly');
    expect(snap.mode).toBe('weekly');
    expect(snap.selectedRegions).toEqual(['서울특별시', '전국']);
    expect(snap.fromDate).toBe('2023-01-01');
    expect(snap.yRanges).toEqual({ 'wp:saleIndex': { min: 90, max: 110 } });
    expect(snap.chartOptions['wp:saleIndex']?.type).toBe('bar');
    expect(snap.tradeYRanges).toEqual({ buyerAdvantage: { min: 0, max: 200 } });
  });
});

describe('capture(monthly)', () => {
  it('월간 선택은 useMonthlyStore에서, mp:/mt:/mk: prefix만 담는다', () => {
    const snap = capture('monthly');
    expect(snap.selectedRegions).toEqual(['경기도']);
    expect(snap.fromDate).toBe('2015-01');
    expect(snap.yRanges).toEqual({ 'mp:saleAptIndex': { min: 80, max: 120 } });
  });
});

describe('apply(weekly snapshot)', () => {
  it('주간 선택/옵션을 복원하고 wp: 가드를 설정한다', () => {
    const snap = capture('weekly');
    // 상태를 흐트러뜨린 뒤 복원
    useAppStore.setState({ selectedRegions: [], regionLabels: {} });
    useMonthlyStore.setState({ yRanges: {}, chartOptions: {}, mode: 'monthly' });

    apply(snap);

    expect(useAppStore.getState().selectedRegions).toEqual(['서울특별시', '전국']);
    expect(useMonthlyStore.getState().mode).toBe('weekly');
    expect(useMonthlyStore.getState().yRanges['wp:saleIndex']).toEqual({ min: 90, max: 110 });
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('wp:')).toBe(true);
  });

  it('다른 모드(mp:) override는 병합 보존한다', () => {
    const snap = capture('weekly');
    useMonthlyStore.setState({ yRanges: { 'mp:saleAptIndex': { min: 1, max: 2 } } });
    apply(snap);
    expect(useMonthlyStore.getState().yRanges['mp:saleAptIndex']).toEqual({ min: 1, max: 2 });
    expect(useMonthlyStore.getState().yRanges['wp:saleIndex']).toEqual({ min: 90, max: 110 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/features/chart-slots/capture.test.ts`
Expected: FAIL ("Cannot find module .../lib/capture").

- [ ] **Step 3: 구현 작성**

Create `src/features/chart-slots/lib/capture.ts`:
```ts
import { useAppStore } from '../../../shared/lib/store';
import { useMonthlyStore } from '../../../shared/lib/monthly-store';
import { generateSlotName } from './name';
import {
  MODE_PREFIXES,
  SNAPSHOT_SCHEMA_VERSION,
  type ChartSetSnapshot,
  type SlotMode,
} from '../model/types';
import type { ChartOptions } from '../../../shared/config';
import type { YRange } from '../model/types';

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// 지정 prefix들로 시작하는 키만 추려 새 객체로 반환(불변).
function pickByPrefix<T>(map: Record<string, T>, prefixes: string[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(map)) {
    if (prefixes.some(p => k.startsWith(p))) out[k] = v;
  }
  return out;
}

// 지정 prefix 키들을 base에서 제거한 뒤 patch를 덮어써 병합(불변).
function mergeByPrefix<T>(
  base: Record<string, T>,
  patch: Record<string, T>,
  prefixes: string[],
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(base)) {
    if (!prefixes.some(p => k.startsWith(p))) out[k] = v;
  }
  return { ...out, ...patch };
}

// 현재 화면 상태를 스냅샷으로 캡처. 주간 선택/기간은 useAppStore, 월간은 useMonthlyStore.
export function capture(mode: SlotMode): ChartSetSnapshot {
  const m = useMonthlyStore.getState();
  const prefixes = MODE_PREFIXES[mode];

  const sel =
    mode === 'weekly'
      ? (() => {
          const a = useAppStore.getState();
          return { selectedRegions: a.selectedRegions, regionLabels: a.regionLabels, fromDate: a.fromDate, toDate: a.toDate, baseDate: a.baseDate };
        })()
      : { selectedRegions: m.selectedRegions, regionLabels: m.regionLabels, fromDate: m.fromDate, toDate: m.toDate, baseDate: m.baseDate };

  const snapshot: ChartSetSnapshot = {
    id: uuid(),
    name: '',
    mode,
    createdAt: Date.now(),
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    ...sel,
    weeklyTab: m.weeklyTab,
    tradeMaOn: m.tradeMaOn,
    tradeMaWindow: m.tradeMaWindow,
    baseLineOn: m.baseLineOn,
    yRanges: pickByPrefix<YRange>(m.yRanges, prefixes),
    tradeYRanges: { ...m.tradeYRanges },
    chartOptions: pickByPrefix<ChartOptions>(m.chartOptions, prefixes),
  };
  snapshot.name = generateSlotName(snapshot);
  return snapshot;
}

// 스냅샷을 현재 상태로 복원. clearYRanges 경쟁 방지 가드를 설정한 뒤 데이터 로드.
export function apply(snapshot: ChartSetSnapshot): void {
  const prefixes = MODE_PREFIXES[snapshot.mode];
  const m = useMonthlyStore.getState();

  // 1) 복원 가드(이 모드 prefix의 자동 clear를 1회 건너뜀)
  m.armSkipYRangeClear(prefixes);

  // 2) 옵션 병합 + 모드/탭
  useMonthlyStore.setState(s => ({
    mode: snapshot.mode,
    weeklyTab: snapshot.weeklyTab,
    tradeMaOn: snapshot.tradeMaOn,
    tradeMaWindow: snapshot.tradeMaWindow,
    baseLineOn: snapshot.baseLineOn,
    yRanges: mergeByPrefix(s.yRanges, snapshot.yRanges, prefixes),
    chartOptions: mergeByPrefix(s.chartOptions, snapshot.chartOptions, prefixes),
    tradeYRanges: { ...snapshot.tradeYRanges },
  }));

  // 3) 선택/기간 복원 (모드별 스토어)
  if (snapshot.mode === 'weekly') {
    useAppStore.setState({
      selectedRegions: snapshot.selectedRegions,
      regionLabels: snapshot.regionLabels,
      fromDate: snapshot.fromDate,
      toDate: snapshot.toDate,
      baseDate: snapshot.baseDate,
    });
    void useAppStore.getState().loadWeeklyData();
    void useAppStore.getState().loadTradeData();
  } else {
    useMonthlyStore.setState({
      selectedRegions: snapshot.selectedRegions,
      regionLabels: snapshot.regionLabels,
      fromDate: snapshot.fromDate,
      toDate: snapshot.toDate,
      baseDate: snapshot.baseDate,
    });
    const mm = useMonthlyStore.getState();
    if (mm.allDates.length === 0) void mm.loadDates();
    void mm.loadPriceData();
    void mm.loadTradeData();
    void mm.loadTradeRegions();
    void mm.loadMarketData();
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/features/chart-slots/capture.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/chart-slots/lib/capture.ts tests/features/chart-slots/capture.test.ts
git commit -m "feat: 슬롯 capture/apply 상태 조율 로직"
```

---

## Task 8: 슬롯 스토어 (useSlotStore)

**Files:**
- Create: `src/features/chart-slots/model/slot-store.ts`
- Test: `tests/features/chart-slots/slot-store.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/features/chart-slots/slot-store.test.ts`:
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSlotStore } from '../../../src/features/chart-slots/model/slot-store';
import * as captureMod from '../../../src/features/chart-slots/lib/capture';
import { SLOT_COUNT, type ChartSetSnapshot } from '../../../src/features/chart-slots/model/types';

function fakeSnap(mode: 'weekly' | 'monthly', name = 'snap'): ChartSetSnapshot {
  return {
    id: 'id-' + name, name, mode, createdAt: 0, schemaVersion: 1,
    selectedRegions: ['서울특별시'], regionLabels: { 서울특별시: '서울특별시' },
    fromDate: '2023-01-01', toDate: '2026-01-01', baseDate: '2026-01-01',
    weeklyTab: 'price', tradeMaOn: true, tradeMaWindow: 13, baseLineOn: true,
    yRanges: {}, tradeYRanges: {}, chartOptions: {},
  };
}

beforeEach(() => {
  useSlotStore.setState({
    weekly: Array(SLOT_COUNT).fill(null),
    monthly: Array(SLOT_COUNT).fill(null),
  });
  vi.restoreAllMocks();
});

describe('useSlotStore', () => {
  it('saveToSlot은 capture 결과를 해당 인덱스에 넣는다', () => {
    vi.spyOn(captureMod, 'capture').mockReturnValue(fakeSnap('weekly', 'A'));
    useSlotStore.getState().saveToSlot('weekly', 2);
    expect(useSlotStore.getState().weekly[2]?.name).toBe('A');
    expect(useSlotStore.getState().monthly[2]).toBeNull();
  });

  it('loadSlot은 apply를 호출한다', () => {
    const snap = fakeSnap('weekly', 'B');
    useSlotStore.setState(s => {
      const weekly = [...s.weekly]; weekly[0] = snap; return { weekly };
    });
    const applySpy = vi.spyOn(captureMod, 'apply').mockImplementation(() => {});
    useSlotStore.getState().loadSlot('weekly', 0);
    expect(applySpy).toHaveBeenCalledWith(snap);
  });

  it('deleteSlot은 null로 비운다', () => {
    useSlotStore.setState(s => {
      const weekly = [...s.weekly]; weekly[1] = fakeSnap('weekly'); return { weekly };
    });
    useSlotStore.getState().deleteSlot('weekly', 1);
    expect(useSlotStore.getState().weekly[1]).toBeNull();
  });

  it('renameSlot은 이름만 바꾼다', () => {
    useSlotStore.setState(s => {
      const weekly = [...s.weekly]; weekly[0] = fakeSnap('weekly', 'old'); return { weekly };
    });
    useSlotStore.getState().renameSlot('weekly', 0, 'new');
    expect(useSlotStore.getState().weekly[0]?.name).toBe('new');
  });

  it('범위 밖 인덱스는 무시한다', () => {
    vi.spyOn(captureMod, 'capture').mockReturnValue(fakeSnap('weekly'));
    useSlotStore.getState().saveToSlot('weekly', SLOT_COUNT);
    expect(useSlotStore.getState().weekly.every(s => s === null)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/features/chart-slots/slot-store.test.ts`
Expected: FAIL ("Cannot find module .../slot-store").

- [ ] **Step 3: 구현 작성**

Create `src/features/chart-slots/model/slot-store.ts`:
```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { capture, apply } from '../lib/capture';
import { SLOT_COUNT, type ChartSetSnapshot, type SlotMode } from './types';

type SlotArray = (ChartSetSnapshot | null)[];

interface SlotStore {
  weekly: SlotArray;
  monthly: SlotArray;
  saveToSlot: (mode: SlotMode, index: number) => void;
  loadSlot: (mode: SlotMode, index: number) => void;
  deleteSlot: (mode: SlotMode, index: number) => void;
  renameSlot: (mode: SlotMode, index: number, name: string) => void;
}

function emptySlots(): SlotArray {
  return Array(SLOT_COUNT).fill(null);
}

function inRange(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < SLOT_COUNT;
}

// 불변 업데이트: 해당 인덱스만 교체한 새 배열 반환.
function replaceAt(arr: SlotArray, index: number, value: ChartSetSnapshot | null): SlotArray {
  const next = [...arr];
  next[index] = value;
  return next;
}

export const useSlotStore = create<SlotStore>()(
  persist(
    (set, get) => ({
      weekly: emptySlots(),
      monthly: emptySlots(),

      saveToSlot: (mode, index) => {
        if (!inRange(index)) return;
        const snap = capture(mode);
        set(s => ({ [mode]: replaceAt(s[mode], index, snap) }) as Partial<SlotStore>);
      },

      loadSlot: (mode, index) => {
        if (!inRange(index)) return;
        const snap = get()[mode][index];
        if (snap) apply(snap);
      },

      deleteSlot: (mode, index) => {
        if (!inRange(index)) return;
        set(s => ({ [mode]: replaceAt(s[mode], index, null) }) as Partial<SlotStore>);
      },

      renameSlot: (mode, index, name) => {
        if (!inRange(index)) return;
        set(s => {
          const cur = s[mode][index];
          if (!cur) return {};
          return { [mode]: replaceAt(s[mode], index, { ...cur, name }) } as Partial<SlotStore>;
        });
      },
    }),
    {
      name: 'kb-chart-slots',
      version: 1,
      // 길이가 SLOT_COUNT가 아닌 영속 데이터는 보정.
      migrate: (persisted: unknown) => {
        const p = persisted as Partial<SlotStore> | undefined;
        const fix = (a?: SlotArray): SlotArray => {
          const base = emptySlots();
          if (Array.isArray(a)) for (let i = 0; i < SLOT_COUNT; i++) base[i] = a[i] ?? null;
          return base;
        };
        return { weekly: fix(p?.weekly), monthly: fix(p?.monthly) } as SlotStore;
      },
    },
  ),
);
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/features/chart-slots/slot-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/chart-slots/model/slot-store.ts tests/features/chart-slots/slot-store.test.ts
git commit -m "feat: 슬롯 CRUD 스토어(useSlotStore) + persist"
```

---

## Task 9: 슬롯 팝오버 UI

**Files:**
- Create: `src/features/chart-slots/ui/SlotPopover.tsx`

> UI 상세 렌더 테스트는 Task 11에서 통합으로 다룬다. 여기서는 컴포넌트 작성 + 타입체크.

- [ ] **Step 1: SlotPopover 작성**

Create `src/features/chart-slots/ui/SlotPopover.tsx`:
```tsx
import { useState } from 'react';
import { useSlotStore } from '../model/slot-store';
import { SLOT_COUNT, type SlotMode } from '../model/types';

interface SlotPopoverProps {
  mode: SlotMode;
  onClose: () => void;
}

export function SlotPopover({ mode, onClose }: SlotPopoverProps) {
  const slots = useSlotStore(s => s[mode]);
  const { saveToSlot, loadSlot, deleteSlot, renameSlot } = useSlotStore();
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <div className="absolute right-0 top-full mt-1 w-80 rounded-lg border border-gray-200 bg-white p-2 shadow-lg z-50">
      <p className="px-2 py-1 text-xs font-semibold text-gray-500">
        {mode === 'weekly' ? '주간' : '월간'} 슬롯 ({SLOT_COUNT}개)
      </p>
      <ul className="max-h-96 overflow-auto">
        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const slot = slots[i] ?? null;
          return (
            <li key={i} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50">
              <span className="w-5 shrink-0 text-center text-xs text-gray-400">{i + 1}</span>
              {slot ? (
                <>
                  {editing === i ? (
                    <input
                      autoFocus
                      defaultValue={slot.name}
                      onBlur={e => { renameSlot(mode, i, e.target.value.trim() || slot.name); setEditing(null); }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="min-w-0 flex-1 rounded border border-blue-300 px-1 text-sm"
                    />
                  ) : (
                    <button
                      onDoubleClick={() => setEditing(i)}
                      title="더블클릭하여 이름 수정"
                      className="min-w-0 flex-1 truncate text-left text-sm text-gray-800"
                    >
                      {slot.name}
                    </button>
                  )}
                  <button
                    onClick={() => { loadSlot(mode, i); onClose(); }}
                    className="shrink-0 rounded bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    불러오기
                  </button>
                  <button
                    onClick={() => saveToSlot(mode, i)}
                    title="현재 화면으로 덮어쓰기"
                    className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    덮어쓰기
                  </button>
                  <button
                    onClick={() => deleteSlot(mode, i)}
                    className="shrink-0 rounded px-1 text-xs text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-300">(빈 슬롯)</span>
                  <button
                    onClick={() => saveToSlot(mode, i)}
                    className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    현재 저장
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc -b --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add src/features/chart-slots/ui/SlotPopover.tsx
git commit -m "feat: 슬롯 팝오버 UI(10슬롯 목록)"
```

---

## Task 10: 헤더 컨트롤 (SlotControls) + barrel

**Files:**
- Create: `src/features/chart-slots/ui/SlotControls.tsx`
- Create: `src/features/chart-slots/index.ts`

- [ ] **Step 1: SlotControls 작성**

Create `src/features/chart-slots/ui/SlotControls.tsx`:
```tsx
import { useState, useRef, useEffect } from 'react';
import { useMonthlyStore } from '../../../shared/lib/monthly-store';
import { useSlotStore } from '../model/slot-store';
import { SlotPopover } from './SlotPopover';
import type { SlotMode } from '../model/types';

export function SlotControls() {
  const mode = useMonthlyStore(s => s.mode) as SlotMode;
  const slots = useSlotStore(s => s[mode]);
  const saveToSlot = useSlotStore(s => s.saveToSlot);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 팝오버 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  // 저장: 다음 빈 슬롯에 저장. 가득 차면 팝오버를 열어 덮어쓰기 유도.
  const handleSave = () => {
    const empty = slots.findIndex(s => s === null);
    if (empty === -1) {
      setOpen(true);
      return;
    }
    saveToSlot(mode, empty);
    setOpen(true);
  };

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <button
        onClick={handleSave}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
      >
        저장
      </button>
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
      >
        슬롯 ▾
      </button>
      {open && <SlotPopover mode={mode} onClose={() => setOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: barrel 작성**

Create `src/features/chart-slots/index.ts`:
```ts
export { SlotControls } from './ui/SlotControls';
export { useSlotStore } from './model/slot-store';
export type { ChartSetSnapshot, SlotMode } from './model/types';
```

- [ ] **Step 3: 타입체크**

Run: `npx tsc -b --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add src/features/chart-slots/ui/SlotControls.tsx src/features/chart-slots/index.ts
git commit -m "feat: 헤더 슬롯 컨트롤(저장/슬롯 팝오버)"
```

---

## Task 11: 헤더에 SlotControls 삽입 + 통합 검증

**Files:**
- Modify: `src/app/App.tsx:91-106`
- Test: `tests/features/chart-slots/controls.test.tsx`

- [ ] **Step 1: App 헤더에 삽입**

`src/app/App.tsx` 상단 import에 추가:
```tsx
import { SlotControls } from '../features/chart-slots';
```
`AppHeader`의 우측 영역에서 `분석` 버튼 `<button onClick={onOpenAnalysis} ...>` **앞**에 `<SlotControls />`를 넣는다. 즉 `<div className="flex items-center gap-4">` 자식 중 `분석` 버튼 직전에 삽입:
```tsx
          <SlotControls />
          <button
            onClick={onOpenAnalysis}
            ...
```

- [ ] **Step 2: 통합 테스트 작성**

Create `tests/features/chart-slots/controls.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlotControls } from '../../../src/features/chart-slots';
import { useSlotStore } from '../../../src/features/chart-slots/model/slot-store';
import { useMonthlyStore } from '../../../src/shared/lib/monthly-store';
import { SLOT_COUNT } from '../../../src/features/chart-slots/model/types';
import * as captureMod from '../../../src/features/chart-slots/lib/capture';

beforeEach(() => {
  useMonthlyStore.setState({ mode: 'weekly' });
  useSlotStore.setState({
    weekly: Array(SLOT_COUNT).fill(null),
    monthly: Array(SLOT_COUNT).fill(null),
  });
  vi.spyOn(captureMod, 'capture').mockReturnValue({
    id: 'i', name: '서울 외 1 · 2023–2026', mode: 'weekly', createdAt: 0, schemaVersion: 1,
    selectedRegions: ['서울특별시'], regionLabels: {}, fromDate: '2023-01-01', toDate: '2026-01-01',
    baseDate: '2026-01-01', weeklyTab: 'price', tradeMaOn: true, tradeMaWindow: 13,
    baseLineOn: true, yRanges: {}, tradeYRanges: {}, chartOptions: {},
  });
});

describe('SlotControls', () => {
  it('저장을 누르면 첫 빈 슬롯이 채워진다', () => {
    render(<SlotControls />);
    fireEvent.click(screen.getByText('저장'));
    expect(useSlotStore.getState().weekly[0]?.name).toBe('서울 외 1 · 2023–2026');
  });

  it('슬롯 ▾ 팝오버에 10개 행이 보인다', () => {
    render(<SlotControls />);
    fireEvent.click(screen.getByText('슬롯 ▾'));
    expect(screen.getByText(/주간 슬롯 \(10개\)/)).toBeInTheDocument();
    expect(screen.getAllByText('(빈 슬롯)')).toHaveLength(SLOT_COUNT);
  });
});
```

- [ ] **Step 3: 통과 확인**

Run: `npx vitest run tests/features/chart-slots/controls.test.tsx`
Expected: PASS.

- [ ] **Step 4: 전체 테스트 + 타입체크 + 빌드**

Run:
```bash
npm test
npx tsc -b --noEmit
npm run build
```
Expected: 모든 테스트 PASS, 타입에러 없음, 빌드 성공.

- [ ] **Step 5: 수동 통합 확인**

`npm run dev` →
1. 주간에서 지역/옵션 변경 → `저장` → `슬롯 ▾`에 항목 표시.
2. 지역 바꾼 뒤 `불러오기` → 지역·기간·Y축·차트형태 복원 확인.
3. 월간으로 전환 → 슬롯 목록이 월간 전용으로 바뀌는지 확인.
4. 새로고침 → 슬롯·현재 선택 유지 확인.

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx tests/features/chart-slots/controls.test.tsx
git commit -m "feat: 헤더에 슬롯 컨트롤 연결 + 통합 테스트"
```

---

## Self-Review 결과

- **선택 기억** → Task 5(persist) + Task 6(월간 init). ✅
- **주간/월간 각 10슬롯** → Task 8(`weekly[10]`/`monthly[10]`) + Task 1(SLOT_COUNT). ✅
- **전체 옵션 포함 6개 차트 복원** → Task 7(capture/apply, prefix 필터·병합) + Task 3·4(가드). ✅
- **선택+옵션만 저장(재생성)** → Task 7 스냅샷에 데이터 미포함. ✅
- **헤더 저장 + 슬롯 팝오버** → Task 9·10·11. ✅
- **Supabase 대비** → Task 1(schemaVersion) + Task 8(persist version/migrate). ✅
- **타입 일관성**: `capture/apply`, `armSkipYRangeClear/consumeSkipYRangeClear`, `saveToSlot/loadSlot/deleteSlot/renameSlot`, `SLOT_COUNT`, `MODE_PREFIXES` 명칭이 정의 Task와 사용 Task에서 일치. ✅
- **Placeholder 없음**: 모든 코드 스텝에 실제 코드 포함. ✅
