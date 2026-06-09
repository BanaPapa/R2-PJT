import React from 'react';
import { useMonthlyStore, type MonthlySubTab } from '../../shared/lib/monthly-store';
import { MONTHLY_METRICS, type MonthlyMetricKey } from '../../shared/config';
import { MonthlyTimeseries } from '../monthly-timeseries';
import { MonthlyPeriodCompare } from '../monthly-period-compare';
import { MonthlyRegionCompare } from '../monthly-region-compare';

const SUB_TABS: { key: MonthlySubTab; label: string }[] = [
  { key: 'series', label: '시계열' },
  { key: 'period', label: '기간비교' },
  { key: 'region', label: '지역비교' },
];

export const MonthlyDashboard: React.FC = () => {
  const { subTab, setSubTab, metric, setMetric } = useMonthlyStore();

  return (
    <div>
      {/* 하위탭 */}
      <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              subTab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 지표 선택 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {MONTHLY_METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key as MonthlyMetricKey)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              metric === m.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {subTab === 'series' && <MonthlyTimeseries />}
      {subTab === 'period' && <MonthlyPeriodCompare />}
      {subTab === 'region' && <MonthlyRegionCompare />}
    </div>
  );
};
