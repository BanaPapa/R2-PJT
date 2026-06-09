import { create } from 'zustand';
import { monthlyLocal } from '../../entities/monthly-data';
import type { MonthlyPriceRegion } from '../../entities/monthly-data';

export type ViewMode = 'weekly' | 'monthly';
// 시세지표(지수·증감·누적) / 거래지표 — 주간·월간 공용 헤더 탭
export type WeeklyTab = 'price' | 'trade';

const MAX_REGIONS = 5;

interface MonthlyStore {
  // ── 주간/월간 공유 상태 ────────────────────────────────────────────
  mode: ViewMode;
  weeklyTab: WeeklyTab;
  // 주간 거래지표 보기 옵션 (주간 RegionSelector/TradeDashboard가 사용)
  tradeMaOn: boolean;
  tradeMaWindow: number;
  tradeYRanges: Record<string, { min: number; max: number }>;

  // ── 월간 시세지표 상태 (주간 store와 동일 구조) ──────────────────────
  selectedRegions: string[]; // 선택 키(주간 형식)
  regionLabels: Record<string, string>;
  fromDate: string;
  toDate: string;
  baseDate: string; // 지수 리베이스 기준월 (이 달 = 100.0)
  allDates: string[]; // 전체 월간 날짜축 (YYYY-MM)

  priceData: MonthlyPriceRegion[];
  priceLoading: boolean;
  priceError: string | null;

  // ── 액션 ────────────────────────────────────────────────────────
  setMode: (mode: ViewMode) => void;
  setWeeklyTab: (tab: WeeklyTab) => void;
  setTradeMaOn: (on: boolean) => void;
  setTradeMaWindow: (w: number) => void;
  setTradeYRange: (id: string, min: number, max: number) => void;
  resetTradeYRanges: () => void;

  addRegion: (region: string, label?: string) => void;
  removeRegion: (region: string) => void;
  clearRegions: () => void;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  setBaseDate: (date: string) => void;
  loadDates: () => Promise<void>;
  loadPriceData: () => Promise<void>;
}

const DEFAULT_FROM = '2015-01';

export const useMonthlyStore = create<MonthlyStore>((set, get) => ({
  mode: 'weekly',
  weeklyTab: 'price',

  tradeMaOn: true,
  tradeMaWindow: 13,
  tradeYRanges: {},

  selectedRegions: ['서울특별시', '전국'],
  regionLabels: { 서울특별시: '서울특별시', 전국: '전국' },
  fromDate: DEFAULT_FROM,
  toDate: '',
  baseDate: '',
  allDates: [],

  priceData: [],
  priceLoading: false,
  priceError: null,

  setMode: mode => {
    set({ mode });
    if (mode === 'monthly' && get().allDates.length === 0) {
      void get().loadDates().then(() => get().loadPriceData());
    }
  },

  setWeeklyTab: tab => set({ weeklyTab: tab }),
  setTradeMaOn: on => set({ tradeMaOn: on }),
  setTradeMaWindow: w => set({ tradeMaWindow: w }),
  setTradeYRange: (id, min, max) =>
    set(s => ({ tradeYRanges: { ...s.tradeYRanges, [id]: { min, max } } })),
  resetTradeYRanges: () => set({ tradeYRanges: {} }),

  addRegion: (region, label) => {
    const { selectedRegions, regionLabels } = get();
    if (selectedRegions.includes(region) || selectedRegions.length >= MAX_REGIONS) return;
    set({
      selectedRegions: [...selectedRegions, region],
      regionLabels: { ...regionLabels, [region]: label ?? region },
    });
    void get().loadPriceData();
  },

  removeRegion: region => {
    const { selectedRegions, regionLabels } = get();
    const { [region]: _removed, ...restLabels } = regionLabels;
    set({ selectedRegions: selectedRegions.filter(r => r !== region), regionLabels: restLabels });
    void get().loadPriceData();
  },

  clearRegions: () => set({ selectedRegions: [], regionLabels: {}, priceData: [] }),

  setFromDate: date => set({ fromDate: date }),
  setToDate: date => set({ toDate: date }),
  setBaseDate: date => set({ baseDate: date }),

  loadDates: async () => {
    try {
      const dates = await monthlyLocal.getDates();
      if (dates.length === 0) return;
      const last = dates[dates.length - 1]!;
      set(s => ({
        allDates: dates,
        // 미설정 값은 데이터 범위로 보정
        toDate: s.toDate || last,
        baseDate: s.baseDate || last,
        fromDate: s.fromDate && s.fromDate >= dates[0]! ? s.fromDate : dates[0]!,
      }));
    } catch {
      // ignore — 차트가 빈 상태를 처리
    }
  },

  loadPriceData: async () => {
    const { selectedRegions } = get();
    if (selectedRegions.length === 0) {
      set({ priceData: [] });
      return;
    }
    set({ priceLoading: true, priceError: null });
    try {
      const data = await monthlyLocal.getPriceData(selectedRegions);
      set({ priceData: data, priceLoading: false });
    } catch (e) {
      set({
        priceError: e instanceof Error ? e.message : '월간 데이터 로딩 실패',
        priceLoading: false,
      });
    }
  },
}));
