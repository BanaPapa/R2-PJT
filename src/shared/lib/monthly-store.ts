import { create } from 'zustand';
import { monthlyApi } from '../../entities/monthly-data';
import type {
  RegionNode,
  MonthlySeries,
  RegionCompareResult,
} from '../../entities/monthly-data';
import type { MonthlyMetricKey } from '../config';

export type ViewMode = 'weekly' | 'monthly';
export type MonthlySubTab = 'series' | 'period' | 'region';
// 주간 하위 탭: 시세지표(지수·증감·누적) / 거래지표(매수우위·수급·거래활발)
export type WeeklyTab = 'price' | 'trade';

const MAX_SERIES = 5;

interface MonthlyStore {
  mode: ViewMode;
  weeklyTab: WeeklyTab;
  subTab: MonthlySubTab;
  metric: MonthlyMetricKey;

  // 거래지표 보기 옵션
  tradeMaOn: boolean;
  tradeMaWindow: number;
  // 그래프별 Y축 범위(차트 id → {min,max}). 없으면 기본 0~200.
  tradeYRanges: Record<string, { min: number; max: number }>;

  regionTree: RegionNode[];
  treeLoading: boolean;
  treeError: string | null;

  // 시계열 (다중 지역)
  seriesPaths: string[];
  series: MonthlySeries[];
  seriesLoading: boolean;

  // 기간비교 (단일 지역)
  periodPath: string | null;
  periodSeries: MonthlySeries | null;
  periodLoading: boolean;

  // 지역비교 (상위 지역의 직계 하위 순위)
  comparePath: string | null;
  compareResult: RegionCompareResult | null;
  compareLoading: boolean;

  setMode: (mode: ViewMode) => void;
  setWeeklyTab: (tab: WeeklyTab) => void;
  setTradeMaOn: (on: boolean) => void;
  setTradeMaWindow: (w: number) => void;
  setTradeYRange: (id: string, min: number, max: number) => void;
  resetTradeYRanges: () => void;
  setSubTab: (tab: MonthlySubTab) => void;
  setMetric: (metric: MonthlyMetricKey) => void;
  loadTree: () => Promise<void>;
  toggleSeriesPath: (path: string) => void;
  loadSeries: () => Promise<void>;
  selectPeriodPath: (path: string) => void;
  selectComparePath: (path: string) => void;
}

export const useMonthlyStore = create<MonthlyStore>((set, get) => ({
  mode: 'weekly',
  weeklyTab: 'price',
  subTab: 'series',
  metric: 'saleAptIndex',

  tradeMaOn: true,
  tradeMaWindow: 13,
  tradeYRanges: {},

  regionTree: [],
  treeLoading: false,
  treeError: null,

  seriesPaths: [],
  series: [],
  seriesLoading: false,

  periodPath: null,
  periodSeries: null,
  periodLoading: false,

  comparePath: null,
  compareResult: null,
  compareLoading: false,

  setMode: mode => {
    set({ mode });
    if (mode === 'monthly' && get().regionTree.length === 0 && !get().treeLoading) {
      get().loadTree();
    }
  },

  setWeeklyTab: tab => set({ weeklyTab: tab }),
  setTradeMaOn: on => set({ tradeMaOn: on }),
  setTradeMaWindow: w => set({ tradeMaWindow: w }),
  setTradeYRange: (id, min, max) =>
    set(s => ({ tradeYRanges: { ...s.tradeYRanges, [id]: { min, max } } })),
  resetTradeYRanges: () => set({ tradeYRanges: {} }),

  setSubTab: tab => set({ subTab: tab }),

  setMetric: metric => {
    set({ metric });
    const { subTab } = get();
    if (subTab === 'series') get().loadSeries();
    else if (subTab === 'period') {
      const p = get().periodPath;
      if (p) get().selectPeriodPath(p);
    } else if (subTab === 'region') {
      const p = get().comparePath;
      if (p) get().selectComparePath(p);
    }
  },

  loadTree: async () => {
    set({ treeLoading: true, treeError: null });
    try {
      const tree = await monthlyApi.getRegionTree();
      set({ regionTree: tree, treeLoading: false });
    } catch (e) {
      set({ treeError: e instanceof Error ? e.message : '지역 트리 로딩 실패', treeLoading: false });
    }
  },

  toggleSeriesPath: path => {
    const { seriesPaths } = get();
    let next: string[];
    if (seriesPaths.includes(path)) {
      next = seriesPaths.filter(p => p !== path);
    } else if (seriesPaths.length < MAX_SERIES) {
      next = [...seriesPaths, path];
    } else {
      return;
    }
    set({ seriesPaths: next });
    get().loadSeries();
  },

  loadSeries: async () => {
    const { seriesPaths, metric } = get();
    if (seriesPaths.length === 0) {
      set({ series: [] });
      return;
    }
    set({ seriesLoading: true });
    try {
      const series = await monthlyApi.getTimeseries(seriesPaths, metric);
      set({ series, seriesLoading: false });
    } catch {
      set({ seriesLoading: false });
    }
  },

  selectPeriodPath: path => {
    set({ periodPath: path, periodLoading: true });
    const { metric } = get();
    monthlyApi
      .getTimeseries([path], metric)
      .then(s => set({ periodSeries: s[0] ?? null, periodLoading: false }))
      .catch(() => set({ periodLoading: false }));
  },

  selectComparePath: path => {
    set({ comparePath: path, compareLoading: true });
    const { metric } = get();
    monthlyApi
      .getRegionCompare(metric, path)
      .then(r => set({ compareResult: r, compareLoading: false }))
      .catch(() => set({ compareLoading: false }));
  },
}));
