import { type FC, useState, useRef, useEffect } from 'react';
import { StoreProvider } from './providers';
import { RegionSelector } from '../widgets/region-selector';
import { ChartDashboard } from '../widgets/chart-dashboard';
import { TradeDashboard } from '../widgets/weekly-trade-dashboard';
import { MonthlyRegionCascade } from '../widgets/monthly-region-cascade';
import { MonthlyChartDashboard } from '../widgets/monthly-chart-dashboard';
import { MonthlyTradeDashboard } from '../widgets/monthly-trade-dashboard';
import { MonthlyMarketDashboard } from '../widgets/monthly-market-dashboard';
import { useAppStore } from '../shared/lib/store';
import { useMonthlyStore, type ViewMode, type WeeklyTab } from '../shared/lib/monthly-store';
import { AnalysisModal } from '../features/analysis';
import { SlotControls } from '../features/chart-slots';

const MODE_TABS: { key: ViewMode; label: string }[] = [
  { key: 'weekly', label: '주간' },
  { key: 'monthly', label: '월간' },
];

// 시세·거래는 주간·월간 공용, 시장지표는 월간 전용.
const WEEKLY_TABS: { key: WeeklyTab; label: string }[] = [
  { key: 'price', label: '시세지표' },
  { key: 'trade', label: '거래지표' },
];
const MONTHLY_TABS: { key: WeeklyTab; label: string }[] = [
  ...WEEKLY_TABS,
  { key: 'market', label: '시장지표' },
];

// 주간 뷰: 시세지표 / 거래지표 (탭은 상단 헤더에 위치)
const WeeklyView: FC = () => {
  const weeklyTab = useMonthlyStore(s => s.weeklyTab);
  return weeklyTab === 'trade' ? <TradeDashboard /> : <ChartDashboard />;
};

// 월간 뷰: 시세지표 / 거래지표 / 시장지표.
const MonthlyView: FC = () => {
  const weeklyTab = useMonthlyStore(s => s.weeklyTab);
  if (weeklyTab === 'trade') return <MonthlyTradeDashboard />;
  if (weeklyTab === 'market') return <MonthlyMarketDashboard />;
  return <MonthlyChartDashboard />;
};

const AppHeader: FC<{ onOpenAnalysis: () => void }> = ({ onOpenAnalysis }) => {
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

          {/* 시세 / 거래 / (월간) 시장 하위 탭 */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            {(mode === 'monthly' ? MONTHLY_TABS : WEEKLY_TABS).map(t => (
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

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
            {mode === 'weekly' && latestDate && <span>최신 데이터: {latestDate}</span>}
            {mode === 'weekly' && totalRecords > 0 && <span>총 {totalRecords.toLocaleString()}건</span>}
            {mode === 'monthly' && <span>월간 주택 시계열</span>}
          </div>
          <SlotControls />
          <button
            onClick={onOpenAnalysis}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            분석
          </button>
        </div>
      </div>
    </header>
  );
};

const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 600;

const App: FC = () => {
  const mode = useMonthlyStore(s => s.mode);
  const [analysisOpen, setAnalysisOpen] = useState(false);

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
        <AppHeader onOpenAnalysis={() => setAnalysisOpen(true)} />
        <AnalysisModal open={analysisOpen} onClose={() => setAnalysisOpen(false)} />

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
