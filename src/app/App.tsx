import { type FC } from 'react';
import { StoreProvider } from './providers';
import { RegionSelector } from '../widgets/region-selector';
import { ChartDashboard } from '../widgets/chart-dashboard';
import { useAppStore } from '../shared/lib/store';

const AppHeader: FC = () => {
  const { latestDate, totalRecords } = useAppStore();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 h-14 fixed top-0 left-0 right-0 z-40">
      <div className="flex justify-between items-center h-full px-4 lg:px-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">KB 부동산 데이터 플랫폼</h1>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
          {latestDate && <span>최신 데이터: {latestDate}</span>}
          {totalRecords > 0 && <span>총 {totalRecords.toLocaleString()}건</span>}
        </div>
      </div>
    </header>
  );
};

const App: FC = () => {
  return (
    <StoreProvider>
      <div className="min-h-screen bg-gray-50">
        <AppHeader />

        <div className="flex h-screen pt-14">
          {/* Sidebar */}
          <aside className="hidden lg:flex w-72 bg-white shadow-md border-r border-gray-200 flex-col flex-shrink-0">
            <RegionSelector />
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            <ChartDashboard />
          </main>
        </div>
      </div>
    </StoreProvider>
  );
};

export default App;
