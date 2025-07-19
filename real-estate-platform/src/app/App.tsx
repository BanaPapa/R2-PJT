import { type FC } from 'react';
import { StoreProvider } from './providers';
import { Header } from '../widgets/header';
import { RegionSelector } from '../widgets/region-selector';
import { ChartDashboard } from '../widgets/chart-dashboard';

const App: FC = () => {
  return (
    <StoreProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar - Region Selection */}
            <div className="lg:col-span-3">
              <RegionSelector />
            </div>
            
            {/* Main Content - Chart Dashboard */}
            <div className="lg:col-span-9">
              <ChartDashboard />
            </div>
          </div>
        </main>
      </div>
    </StoreProvider>
  );
};

export default App;