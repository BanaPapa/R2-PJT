# 차트 슬롯 저장 + 지역 선택 기억 — 설계

작성일: 2026-06-11

## 목표

1. **선택 기억**: 주간/월간에서 선택한 지역·검색옵션을 세션 간 유지(접속 시 리셋 방지).
2. **슬롯 저장**: 주간/월간 **각각 최대 10개** 슬롯에 현재 화면(지역 + 모든 검색옵션 + 6개 차트 구성)을 저장하고 불러오기. 선택+옵션만 저장하고 정적 JSON에서 차트를 재생성한다.

## 배경 (현재 구조)

- 두 zustand 스토어: `useAppStore`(주간 선택/기간), `useMonthlyStore`(공용 보기옵션 + 월간 선택/기간).
- 보기옵션은 prefix 키로 구분: 주간 `wp:`/`wt:`, 월간 `mp:`/`mt:`/`mk:`.
- `tradeYRanges`, `tradeMaOn`, `tradeMaWindow`, `baseLineOn`은 prefix 없는 **공용 싱글톤**(주간·월간 공유).
- 세 대시보드에 `clearYRanges('wp:'|'mp:'|'mk:')` effect가 있어 지역/기간 변경 시 Y축 수동 override를 해제(자동 재계산).
- `StoreProvider`는 마운트 시 주간만 init. 월간 로드는 `setMode('monthly')` 시에만.
- 현재 persist는 `sidebarWidth`(localStorage)뿐.

## 1. 선택 기억 — zustand persist

두 스토어에 `persist` 미들웨어 + `partialize`(선택/옵션만, 로드 데이터·가용목록 제외).

- `useAppStore` (키 `kb-weekly`): `selectedRegions, regionLabels, fromDate, toDate, baseDate`
- `useMonthlyStore` (키 `kb-monthly`): `mode, weeklyTab, tradeMaOn, tradeMaWindow, baseLineOn, yRanges, tradeYRanges, chartOptions, selectedRegions, regionLabels, fromDate, toDate, baseDate`

localStorage는 동기 hydration → `StoreProvider` init effect 시점에 복원 완료. `loadWeeklyData()`가 복원된 지역으로 자동 로드.

**추가**: `StoreProvider`가 복원된 `mode==='monthly'`이면 월간 로더(`loadDates→loadPriceData`, `loadTradeRegions`, `loadTradeData`, `loadMarketData`)도 트리거.

## 2. 슬롯 데이터 모델

```ts
interface YRange { min: number; max: number }

interface ChartSetSnapshot {
  id: string;            // uuid
  name: string;          // 자동 생성, 수정 가능
  mode: 'weekly' | 'monthly';
  createdAt: number;
  schemaVersion: number; // 추후 Supabase 마이그레이션 대비

  selectedRegions: string[];
  regionLabels: Record<string, string>;
  fromDate: string;
  toDate: string;
  baseDate: string;
  weeklyTab: WeeklyTab;  // 저장 당시 활성 하위탭

  tradeMaOn: boolean;
  tradeMaWindow: number;
  baseLineOn: boolean;

  yRanges: Record<string, YRange>;          // 해당 모드 prefix만
  tradeYRanges: Record<string, YRange>;     // 공용(메트릭 id 키)
  chartOptions: Record<string, ChartOptions>; // 해당 모드 prefix만
}
```

## 3. 슬롯 스토어 `useSlotStore` (키 `kb-chart-slots`, persist)

```ts
interface SlotStore {
  weekly:  (ChartSetSnapshot | null)[];   // 길이 10
  monthly: (ChartSetSnapshot | null)[];   // 길이 10
  saveToSlot: (mode, index) => void;       // 현재 상태 캡처 → 슬롯
  loadSlot:   (mode, index) => void;       // 슬롯 → 복원
  deleteSlot: (mode, index) => void;
  renameSlot: (mode, index, name) => void;
}
```

persist `version`으로 스키마 변경 대비. 10개 고정 길이 배열, null = 빈 슬롯.

## 4. capture / apply (두 스토어 조율, `lib/capture.ts`)

- `capture(mode)`: 주간이면 선택/기간을 `useAppStore`에서, 월간이면 `useMonthlyStore`에서. 옵션은 항상 `useMonthlyStore`. `yRanges`/`chartOptions`는 해당 모드 prefix만 필터링. 공용 싱글톤·`tradeYRanges`는 그대로.
- `apply(snapshot)`:
  1. 주간 스냅샷 → `useAppStore.setState`(선택/기간), 월간 스냅샷 → `useMonthlyStore.setState`(선택/기간).
  2. `useMonthlyStore`에 공용 옵션 + prefix 맵 **병합**(다른 모드 prefix 보존, 해당 prefix만 교체).
  3. `mode`/`weeklyTab` 설정.
  4. `skipYRangeClear` 가드 설정(§5).
  5. 데이터 로더 호출(주간/월간).

## 5. clearYRanges 경쟁 해결

복원은 지역/기간을 바꾸므로 세 대시보드의 clear effect가 방금 복원한 prefix override를 지워버린다. 해결:

- `useMonthlyStore`에 일회성 가드 `skipYRangeClear: Set<string>` 추가.
- `apply()`가 복원 모드 prefix를 채움(주간 `{'wp:'}`, 월간 `{'mp:','mk:'}`).
- 세 대시보드의 clear effect를 `if (consumeSkipClear(prefix)) return;`로 감싼다. `consumeSkipClear(prefix)`는 Set에 있으면 제거 후 true 반환.
- Set이라 모드 전환으로 대시보드가 나중에 마운트돼 첫 effect를 실행할 때까지 가드 유지.

## 6. UI — 헤더 `[저장]` + `[슬롯 ▾]` 팝오버

`분석` 버튼 옆. 현재 `mode`의 10슬롯만 표시(토글에 따라 전환).

- `[저장]`: 현재 화면을 다음 빈 슬롯에 저장. 가득 차면 팝오버 열어 덮어쓰기 유도.
- `[슬롯 ▾]` 팝오버: 10행.
  - 채워진 행: 이름(더블클릭 수정)·`서울·전국 외 2 · 2023–2026` 요약·`[불러오기][덮어쓰기][삭제]`.
  - 빈 행: `(빈 슬롯) [현재 저장]`.
- `generateSlotName(snapshot)` → `대표지역 외 N · 기간`(`lib/name.ts`).

## 7. 파일 구성

```
src/features/chart-slots/
  model/types.ts          // ChartSetSnapshot, YRange
  model/slot-store.ts     // useSlotStore (persist)
  lib/capture.ts          // capture(mode), apply(snapshot)
  lib/name.ts             // generateSlotName
  ui/SlotControls.tsx     // 헤더 [저장][슬롯▾]
  ui/SlotPopover.tsx      // 10슬롯 목록
  index.ts
```

기존 변경 최소: 두 스토어에 persist + `skipYRangeClear`/`consumeSkipClear` 추가, 세 대시보드 clear effect 한 줄 가드, `StoreProvider` 월간 init, `App` 헤더에 `SlotControls` 삽입.

## 8. 테스트 (Vitest, 80%+)

- `capture/apply` 왕복 동등성(주간·월간).
- prefix 필터링/병합 정확성.
- `generateSlotName` 포맷.
- 슬롯 CRUD + 10개 상한 + 빈 슬롯 처리.
- `consumeSkipClear` 일회성 소비.
- UI: 저장→슬롯 채움, 불러오기→상태 반영, 삭제.

## 9. Supabase 대비

`schemaVersion` + persist `version`. 추후 persist storage를 Supabase 어댑터로 교체하거나 `saveToSlot/loadSlot`을 async 동기화로 확장. 데이터가 아닌 파라미터만 저장하므로 row가 가볍다.
