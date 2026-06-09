import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useMonthlyStore } from '../../shared/lib/monthly-store';
import { CHART_COLORS, MONTHLY_METRICS } from '../../shared/config';
import type { MonthlySeries } from '../../entities/monthly-data';

// 시리즈별 표시명 (폴백 시 요청 지역과 실제 지역 함께 표기)
function seriesLabel(s: MonthlySeries, fallbackPath: string): string {
  const name = s.resolved?.resolvedRegion ?? fallbackPath.split('>').pop() ?? fallbackPath;
  return name;
}

function buildChartData(series: MonthlySeries[], labels: string[]) {
  const byDate = new Map<string, Record<string, number | null>>();
  series.forEach((s, idx) => {
    const label = labels[idx];
    for (const pt of s.data) {
      if (!byDate.has(pt.date)) byDate.set(pt.date, {});
      byDate.get(pt.date)![label] = pt.value;
    }
  });
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));
}

export const MonthlyTimeseries: React.FC = () => {
  const { series, seriesPaths, seriesLoading, metric } = useMonthlyStore();
  const metricInfo = MONTHLY_METRICS.find(m => m.key === metric)!;

  const labels = useMemo(
    () => series.map((s, i) => seriesLabel(s, seriesPaths[i] ?? '')),
    [series, seriesPaths],
  );
  const chartData = useMemo(() => buildChartData(series, labels), [series, labels]);

  if (seriesPaths.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <p className="text-gray-400 text-sm">왼쪽에서 지역을 선택하세요 (최대 5개)</p>
      </div>
    );
  }
  if (seriesLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <p className="text-gray-500 text-sm">데이터 로딩 중...</p>
      </div>
    );
  }

  const fallbacks = series.filter(s => s.resolved?.fallback);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-900">{metricInfo.label} 추이</h2>
        <span className="text-xs text-gray-400">월간 · {metricInfo.unit || '지수'}</span>
      </div>

      {fallbacks.length > 0 && (
        <div className="mb-3 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          일부 지역은 해당 지표 데이터가 없어 상위 지역으로 대체했습니다:{' '}
          {fallbacks
            .map(s => `${s.requestedPath.split('>').pop()} → ${s.resolved?.resolvedRegion}`)
            .join(', ')}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                interval="preserveStartEnd"
                minTickGap={40}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                domain={['auto', 'auto']}
                width={48}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toFixed(2)}${metricInfo.unit}`, '']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {labels.map((label, idx) => (
                <Line
                  key={label + idx}
                  type="monotone"
                  dataKey={label}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={1.8}
                  dot={false}
                  activeDot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
