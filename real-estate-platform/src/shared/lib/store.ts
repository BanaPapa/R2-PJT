import { create } from 'zustand';
import { type Region, type PriceData } from '../config';
import { SAMPLE_PRICE_DATA } from './sample-data';

interface AppStore {
  // Selected regions
  baseRegion: Region | null;
  comparisonRegions: Region[];
  
  // Data
  priceData: PriceData[];
  
  // UI State
  isLoading: boolean;
  
  // Actions
  setBaseRegion: (region: Region | null) => void;
  addComparisonRegion: (region: Region) => void;
  removeComparisonRegion: (regionId: string) => void;
  clearComparisonRegions: () => void;
  
  // Data actions
  loadData: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  baseRegion: null,
  comparisonRegions: [],
  priceData: SAMPLE_PRICE_DATA,
  isLoading: false,
  
  // Region selection actions
  setBaseRegion: (region) => {
    set({ baseRegion: region });
  },
  
  addComparisonRegion: (region) => {
    const { comparisonRegions } = get();
    if (comparisonRegions.length >= 3 || comparisonRegions.some(r => r.id === region.id)) {
      return; // Max 3 comparison regions or already added
    }
    set({ comparisonRegions: [...comparisonRegions, region] });
  },
  
  removeComparisonRegion: (regionId) => {
    const { comparisonRegions } = get();
    set({ comparisonRegions: comparisonRegions.filter(r => r.id !== regionId) });
  },
  
  clearComparisonRegions: () => {
    set({ comparisonRegions: [] });
  },
  
  // Data loading (MVP: just returns sample data)
  loadData: async () => {
    set({ isLoading: true });
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    set({ 
      priceData: SAMPLE_PRICE_DATA,
      isLoading: false 
    });
  },
}));