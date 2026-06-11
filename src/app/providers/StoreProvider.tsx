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
