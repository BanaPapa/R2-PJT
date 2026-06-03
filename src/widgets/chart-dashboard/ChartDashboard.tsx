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
import { useAppStore } from '../../shared/lib/store';
import { CHART_COLORS, METRICS, type MetricKey } from '../../shared/config';
import type { WeeklyDataRow } from '../../entities/kb-data';

// Transform flat rows into chart-ready data grouped by date
function buildChartData(
  weeklyData: WeeklyDataRow[],
  selectedRegions: string[],
  metricKey: MetricKey,
): Array<{ date: string } & Record<string, number | null>> {
  // Group by date
  const byDate = new Map<string, Record<string, number | null>>();

  for (const row of weeklyData) {
    if (!selectedRegions.includes(row.region)) continue;
    if (!byDate.has(row.date)) byDate.set(row.date, {});
    const entry = byDate.get(row.date)!;
    const value = row[metricKey as keyof WeeklyDataRow] as number | null;
    entry[row.region] = value;
  }

  // Sort by date and return
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear().toString().slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

interface MetricChartProps {
  title: string;
  unit: string;
  data: ReturnType<typeof buildChartData>;
  selectedRegions: string[];
}

const MetricChart: React.FC<MetricChartProps> = ({ title, unit, data, selectedRegions }) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg text-xs">
        <p className="font-medium text-gray-900 mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.dataKey}: {entry.value != null ? `${entry.value.toFixed(2)}${unit}` : '-'}
          </p>
        ))}
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
        <div className="h-40 flex items-center justify-center text-gray-400 text-sm">데이터 없음</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={formatDate}
              interval="preserveStartEnd"
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              domain={['auto', 'auto']}
              tickFormatter={v => v.toFixed(1)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            />
            {selectedRegions.map((region, idx) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const ChartDashboard: React.FC = () => {
  const { weeklyData, selectedRegions, dataLoading, dataError, loadWeeklyData } = useAppStore();

  const chartDataByMetric = useMemo(() => {
    if (weeklyData.length === 0 || selectedRegions.length === 0) return null;
    return Object.fromEntries(
      METRICS.map(m => [m.key, buildChartData(weeklyData, selectedRegions, m.key)])
    ) as Record<MetricKey, ReturnType<typeof buildChartData>>;
  }, [weeklyData, selectedRegions]);

  if (selectedRegions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">지역을 선택해주세요</p>
          <p className="text-gray-300 text-sm">최대 5개 지역을 선택하고 비교하기 버튼을 누르세요</p>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-red-200 shadow-sm">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-3">데이터 로딩 실패: {dataError}</p>
          <button
            onClick={loadWeeklyData}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            재시도
          </button>
        </div>
      </div>
    );
  }

  if (!chartDataByMetric) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <p className="text-gray-400 text-sm">비교하기 버튼을 눌러 데이터를 불러오세요</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">KB 부동산 통계 비교</h2>
        <div className="flex items-center gap-2">
          {selectedRegions.map((region, idx) => (
            <span
              key={region}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-white font-medium"
              style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
            >
              {region}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {METRICS.map(metric => (
          <MetricChart
            key={metric.key}
            title={metric.label}
            unit={metric.unit}
            data={chartDataByMetric[metric.key] ?? []}
            selectedRegions={selectedRegions}
          />
        ))}
      </div>
    </div>
  );
};
