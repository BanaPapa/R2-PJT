import { type FC, useState } from 'react';
import { StoreProvider } from './providers';
import { Header } from '../widgets/header';
import { RegionSelector } from '../widgets/region-selector';
import { ChartDashboard } from '../widgets/chart-dashboard';
import { StatisticsTray } from '../widgets/statistics-tray';

const App: FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <StoreProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
        {/* Header */}
        <Header />
        
        {/* Main Layout */}
        <div className="flex h-screen pt-16">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex w-80 bg-white/95 backdrop-blur-sm shadow-xl border-r border-gray-200/60 flex-col">
            <div className="flex-1 overflow-hidden">
              <RegionSelector />
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="flex-1 flex flex-col min-w-0">
            {/* Mobile Header Bar */}
            <div className="lg:hidden bg-white/95 backdrop-blur-sm border-b border-gray-200 p-4">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium">지역 선택</span>
              </button>
            </div>
            
            {/* Chart Dashboard */}
            <div className="flex-1 p-4 lg:p-6 overflow-auto">
              <ChartDashboard />
            </div>
            
            {/* Statistics Tray */}
            <div className="bg-white/95 backdrop-blur-sm border-t border-gray-200/60 shadow-lg">
              <div className="p-4 lg:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">선택된 지역 통계</h3>
                  <div className="text-sm text-gray-500">실시간 업데이트</div>
                </div>
                <StatisticsTray />
              </div>
            </div>
          </main>
        </div>
        
        {/* Mobile Region Selector Overlay */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50">
            <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl max-h-[85vh] overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">지역 선택</h2>
                  <button 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="overflow-auto">
                <RegionSelector />
              </div>
            </div>
          </div>
        )}
      </div>
    </StoreProvider>
  );
};

export default App;