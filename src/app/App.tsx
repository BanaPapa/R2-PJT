import { type FC, useState, useRef, useEffect } from 'react';
import { StoreProvider } from './providers';
import { RegionSelector } from '../widgets/region-selector';
import { ChartDashboard } from '../widgets/chart-dashboard';
import { TradeDashboard } from '../widgets/weekly-trade-dashboard';
import { MonthlyRegionCascade } from '../widgets/monthly-region-cascade';
import { MonthlyChartDashboard } from '../widgets/monthly-chart-dashboard';
import { useAppStore } from '../shared/lib/store';
import { useMonthlyStore, type ViewMode, type WeeklyTab } from '../shared/lib/monthly-store';

const MODE_TABS: { key: ViewMode; label: string }[] = [
  { key: 'weekly', label: '주간' },
  { key: 'monthly', label: '월간' },
];

const WEEKLY_TABS: { key: WeeklyTab; label: string }[] = [
  { key: 'price', label: '시세지표' },
  { key: 'trade', label: '거래지표' },
];

// 주간 뷰: 시세지표 / 거래지표 (탭은 상단 헤더에 위치)
const WeeklyView: FC = () => {
  const weeklyTab = useMonthlyStore(s => s.weeklyTab);
  return weeklyTab === 'price' ? <ChartDashboard /> : <TradeDashboard />;
};

// 월간 뷰: 주간과 동일한 시세지표 / 거래지표 탭 구조. 현재 시세지표만 구현.
const MonthlyView: FC = () => {
  const weeklyTab = useMonthlyStore(s => s.weeklyTab);
  if (weeklyTab === 'price') return <MonthlyChartDashboard />;
  return (
    <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
      <p className="text-gray-400 text-sm">월간 거래지표는 준비 중입니다</p>
    </div>
  );
};

const AppHeader: FC = () => {
  const { latestDate, totalRecords } = useAppStore();
  const { mode, setMode, weeklyTab, setWeeklyTab } = useMonthlyStore();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 h-14 fixed top-0 left-0 right-0 z-40">
      <div className="flex justify-between items-center h-full px-4 lg:px-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">KB 부동산 데이터 플랫폼</h1>
          </div>

          {/* 주간 / 월간 토글 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {MODE_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setMode(t.key)}
                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                  mode === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 시세지표 / 거래지표 하위 탭 (주간·월간 공용) */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {WEEKLY_TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setWeeklyTab(t.key)}
                  className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                    weeklyTab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
          {mode === 'weekly' && latestDate && <span>최신 데이터: {latestDate}</span>}
          {mode === 'weekly' && totalRecords > 0 && <span>총 {totalRecords.toLocaleString()}건</span>}
          {mode === 'monthly' && <span>월간 주택 시계열</span>}
        </div>
      </div>
    </header>
  );
};

const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 600;

const App: FC = () => {
  const mode = useMonthlyStore(s => s.mode);

  // 드래그로 조정 가능한 사이드바 폭(로컬 저장)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = Number(localStorage.getItem('sidebarWidth'));
    return saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX ? saved : 320;
  });
  const draggingRef = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, e.clientX)));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  const startDrag = () => {
    draggingRef.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  return (
    <StoreProvider>
      <div className="min-h-screen bg-gray-50">
        <AppHeader />

        <div className="flex h-screen pt-14">
          {/* Sidebar (드래그로 폭 조정) */}
          <aside
            style={{ width: sidebarWidth }}
            className="relative hidden lg:flex bg-white shadow-md border-r border-gray-200 flex-col flex-shrink-0"
          >
            {mode === 'weekly' ? <RegionSelector /> : <MonthlyRegionCascade />}
            {/* 우측 끝 리사이즈 핸들 */}
            <div
              onMouseDown={startDrag}
              title="드래그하여 폭 조정"
              className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-blue-300/60 active:bg-blue-400/70"
            />
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            {mode === 'weekly' ? <WeeklyView /> : <MonthlyView />}
          </main>
        </div>
      </div>
    </StoreProvider>
  );
};

export default App;
