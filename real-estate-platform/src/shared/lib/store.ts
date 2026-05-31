import { create } from 'zustand';
import { kbDataApi } from '../../entities/kb-data';
import type { WeeklyDataRow } from '../../entities/kb-data';

interface AppStore {
  // Region state
  allRegions: string[];
  selectedRegions: string[];
  regionsLoading: boolean;

  // Date range
  fromDate: string;
  toDate: string;

  // Data
  weeklyData: WeeklyDataRow[];
  dataLoading: boolean;
  dataError: string | null;

  // Collection status
  latestDate: string | null;
  totalRecords: number;

  // Actions
  loadRegions: () => Promise<void>;
  toggleRegion: (region: string) => void;
  clearRegions: () => void;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  loadWeeklyData: () => Promise<void>;
  loadStatus: () => Promise<void>;
}

const DEFAULT_FROM = '2023-01-01';
const DEFAULT_TO = new Date().toISOString().split('T')[0];

export const useAppStore = create<AppStore>((set, get) => ({
  allRegions: [],
  selectedRegions: ['서울특별시', '전국'],
  regionsLoading: false,

  fromDate: DEFAULT_FROM,
  toDate: DEFAULT_TO,

  weeklyData: [],
  dataLoading: false,
  dataError: null,

  latestDate: null,
  totalRecords: 0,

  loadRegions: async () => {
    set({ regionsLoading: true });
    try {
      const regions = await kbDataApi.getRegions();
      set({ allRegions: regions, regionsLoading: false });
    } catch {
      set({ regionsLoading: false });
    }
  },

  toggleRegion: (region: string) => {
    const { selectedRegions } = get();
    if (selectedRegions.includes(region)) {
      set({ selectedRegions: selectedRegions.filter(r => r !== region) });
    } else if (selectedRegions.length < 5) {
      set({ selectedRegions: [...selectedRegions, region] });
    }
  },

  clearRegions: () => set({ selectedRegions: [] }),

  setFromDate: (date: string) => set({ fromDate: date }),
  setToDate: (date: string) => set({ toDate: date }),

  loadWeeklyData: async () => {
    const { selectedRegions, fromDate, toDate } = get();
    if (selectedRegions.length === 0) {
      set({ weeklyData: [] });
      return;
    }
    set({ dataLoading: true, dataError: null });
    try {
      const data = await kbDataApi.getWeeklyData(selectedRegions, fromDate, toDate);
      set({ weeklyData: data, dataLoading: false });
    } catch (e) {
      set({ dataError: e instanceof Error ? e.message : 'Failed to load data', dataLoading: false });
    }
  },

  loadStatus: async () => {
    try {
      const status = await kbDataApi.getCollectionStatus();
      set({ latestDate: status.latestDate, totalRecords: status.totalRecords });
    } catch {
      // ignore
    }
  },
}));
