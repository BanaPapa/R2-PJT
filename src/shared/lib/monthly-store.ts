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

const MAX_SERIES = 5;

interface MonthlyStore {
  mode: ViewMode;
  subTab: MonthlySubTab;
  metric: MonthlyMetricKey;

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
  subTab: 'series',
  metric: 'saleAptIndex',

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
