import React, { useEffect } from 'react';
import { useAppStore } from '../../shared/lib/store';

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
  }, []);

  return <>{children}</>;
};
