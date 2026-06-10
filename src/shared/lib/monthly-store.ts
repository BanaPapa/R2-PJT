import { create } from 'zustand';
import { monthlyLocal, monthlyTradeLocal, monthlyForecastLocal } from '../../entities/monthly-data';
import type { MonthlyPriceRegion, MonthlyMarketRegion, MonthlyForecastRegion } from '../../entities/monthly-data';
import type { WeeklyDataRow } from '../../entities/kb-data';

export type ViewMode = 'weekly' | 'monthly';
// 시세지표 / 거래지표 — 주간·월간 공용 헤더 탭. 'market'(시장지표)는 월간 전용.
export type WeeklyTab = 'price' | 'trade' | 'market';

const MAX_REGIONS = 5;

interface MonthlyStore {
  // ── 주간/월간 공유 상태 ────────────────────────────────────────────
  mode: ViewMode;
  weeklyTab: WeeklyTab;
  // 주간 거래지표 보기 옵션 (주간 RegionSelector/TradeDashboard가 사용)
  tradeMaOn: boolean;
  tradeMaWindow: number;
  tradeYRanges: Record<string, { min: number; max: number }>;
  // 시세지표·시장지표 그래프별 Y축 범위 override (id는 'wp:saleIndex' 등 prefix로 구분)
  yRanges: Record<string, { min: number; max: number }>;
  // 시세지표 기준일(지수=100) 세로선 표시 여부 — 주간/월간 시세 차트 공용
  baseLineOn: boolean;

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

  // ── 월간 거래지표 상태 (주간 store와 동일 구조) ──────────────────────
  allTradeRegions: string[]; // 거래지표 제공 지역(대지역/집계만)
  tradeData: WeeklyDataRow[]; // 매수우위·매매거래활발·전세수급·전세거래활발
  tradeLoading: boolean;

  // ── 월간 시장지표 상태 (월간 전용) ──────────────────────────────────
  marketData: MonthlyMarketRegion[]; // ㎡당 평균 매매/전세가
  forecastData: MonthlyForecastRegion[]; // KB 매매/전세 전망지수
  marketLoading: boolean;

  // ── 액션 ────────────────────────────────────────────────────────
  setMode: (mode: ViewMode) => void;
  setWeeklyTab: (tab: WeeklyTab) => void;
  setTradeMaOn: (on: boolean) => void;
  setTradeMaWindow: (w: number) => void;
  setTradeYRange: (id: string, min: number, max: number) => void;
  resetTradeYRanges: () => void;
  setYRange: (id: string, min: number, max: number) => void;
  setBaseLineOn: (on: boolean) => void;

  addRegion: (region: string, label?: string) => void;
  removeRegion: (region: string) => void;
  clearRegions: () => void;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  setBaseDate: (date: string) => void;
  loadDates: () => Promise<void>;
  loadPriceData: () => Promise<void>;
  loadTradeRegions: () => Promise<void>;
  loadTradeData: () => Promise<void>;
  loadMarketData: () => Promise<void>;
}

const DEFAULT_FROM = '2015-01';

export const useMonthlyStore = create<MonthlyStore>((set, get) => ({
  mode: 'weekly',
  weeklyTab: 'price',

  tradeMaOn: true,
  tradeMaWindow: 13,
  tradeYRanges: {},
  yRanges: {},
  baseLineOn: true,

  selectedRegions: ['서울특별시', '전국'],
  regionLabels: { 서울특별시: '서울특별시', 전국: '전국' },
  fromDate: DEFAULT_FROM,
  toDate: '',
  baseDate: '',
  allDates: [],

  priceData: [],
  priceLoading: false,
  priceError: null,

  allTradeRegions: [],
  tradeData: [],
  tradeLoading: false,

  marketData: [],
  forecastData: [],
  marketLoading: false,

  setMode: mode => {
    // 'market'은 월간 전용 — 주간으로 전환 시 시세지표로 되돌린다.
    const weeklyTab = mode === 'weekly' && get().weeklyTab === 'market' ? 'price' : get().weeklyTab;
    set({ mode, weeklyTab });
    if (mode === 'monthly' && get().allDates.length === 0) {
      void get().loadDates().then(() => get().loadPriceData());
      void get().loadTradeRegions();
      void get().loadTradeData();
      void get().loadMarketData();
    }
  },

  setWeeklyTab: tab => set({ weeklyTab: tab }),
  setTradeMaOn: on => set({ tradeMaOn: on }),
  setTradeMaWindow: w => set({ tradeMaWindow: w }),
  setTradeYRange: (id, min, max) =>
    set(s => ({ tradeYRanges: { ...s.tradeYRanges, [id]: { min, max } } })),
  resetTradeYRanges: () => set({ tradeYRanges: {} }),
  setYRange: (id, min, max) => set(s => ({ yRanges: { ...s.yRanges, [id]: { min, max } } })),
  setBaseLineOn: on => set({ baseLineOn: on }),

  addRegion: (region, label) => {
    const { selectedRegions, regionLabels } = get();
    if (selectedRegions.includes(region) || selectedRegions.length >= MAX_REGIONS) return;
    set({
      selectedRegions: [...selectedRegions, region],
      regionLabels: { ...regionLabels, [region]: label ?? region },
    });
    void get().loadPriceData();
    void get().loadTradeData();
    void get().loadMarketData();
  },

  removeRegion: region => {
    const { selectedRegions, regionLabels } = get();
    const { [region]: _removed, ...restLabels } = regionLabels;
    set({ selectedRegions: selectedRegions.filter(r => r !== region), regionLabels: restLabels });
    void get().loadPriceData();
    void get().loadTradeData();
    void get().loadMarketData();
  },

  clearRegions: () =>
    set({ selectedRegions: [], regionLabels: {}, priceData: [], tradeData: [], marketData: [], forecastData: [] }),

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

  loadTradeRegions: async () => {
    try {
      set({ allTradeRegions: await monthlyTradeLocal.getRegions() });
    } catch {
      // ignore — 사이드바가 빈 가용목록을 처리
    }
  },

  loadTradeData: async () => {
    const { selectedRegions } = get();
    if (selectedRegions.length === 0) {
      set({ tradeData: [] });
      return;
    }
    set({ tradeLoading: true });
    try {
      const data = await monthlyTradeLocal.getTradeData(selectedRegions);
      set({ tradeData: data, tradeLoading: false });
    } catch {
      set({ tradeLoading: false });
    }
  },

  loadMarketData: async () => {
    const { selectedRegions } = get();
    if (selectedRegions.length === 0) {
      set({ marketData: [], forecastData: [] });
      return;
    }
    set({ marketLoading: true });
    try {
      const [market, forecast] = await Promise.all([
        monthlyLocal.getMarketData(selectedRegions),
        monthlyForecastLocal.getForecastData(selectedRegions),
      ]);
      set({ marketData: market, forecastData: forecast, marketLoading: false });
    } catch {
      set({ marketLoading: false });
    }
  },
}));
