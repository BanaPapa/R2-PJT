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
