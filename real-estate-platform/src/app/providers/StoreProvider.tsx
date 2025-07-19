import React, { useEffect } from 'react';
import { useAppStore } from '../../shared/lib/store';

interface StoreProviderProps {
  children: React.ReactNode;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  const loadData = useAppStore((state) => state.loadData);

  // Initialize data on app start
  useEffect(() => {
    loadData();
  }, [loadData]);

  return <>{children}</>;
};