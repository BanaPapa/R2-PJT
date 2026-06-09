import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMonthlyStore } from '../../shared/lib/monthly-store';
import { MONTHLY_METRICS } from '../../shared/config';
import type { TimeseriesPoint } from '../../entities/monthly-data';

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

interface PivotRow {
  year: string;
  values: (number | null)[]; // 길이 12
}

function buildPivot(data: TimeseriesPoint[]): PivotRow[] {
  const byYear = new Map<string, (number | null)[]>();
  for (const pt of data) {
    const [y, m] = pt.date.split('-');
    if (!byYear.has(y!)) byYear.set(y!, Array(12).fill(null));
    byYear.get(y!)![Number(m) - 1] = pt.value;
  }
  return Array.from(byYear.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // 최신 연도 위로
    .map(([year, values]) => ({ year, values }));
}

export const MonthlyPeriodCompare: React.FC = () => {
  const { periodPath, periodSeries, periodLoading, metric } = useMonthlyStore();
  const metricInfo = MONTHLY_METRICS.find(m => m.key === metric)!;
  const [tableOpen, setTableOpen] = useState(false);

  const data = periodSeries?.data ?? [];
  const pivot = useMemo(() => buildPivot(data), [data]);
  const chartData = useMemo(() => data.map(d => ({ date: d.date, value: d.value })), [data]);

  if (!periodPath) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <p className="text-gray-400 text-sm">왼쪽에서 비교할 지역 하나를 선택하세요</p>
      </div>
    );
  }
  if (periodLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <p className="text-gray-500 text-sm">데이터 로딩 중...</p>
      </div>
    );
  }

  const resolved = periodSeries?.resolved;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-900">
          {resolved?.resolvedRegion ?? '-'} · {metricInfo.label}
        </h2>
        <span className="text-xs text-gray-400">기간비교 (연도×월)</span>
      </div>

      {resolved?.fallback && (
        <div className="mb-3 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          선택 지역에 데이터가 없어 상위 지역(<b>{resolved.resolvedRegion}</b>)으로 대체했습니다.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
        <div className="h-80">
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
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={48} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}${metricInfo.unit}`, metricInfo.label]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button
          onClick={() => setTableOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700"
        >
          <span>연도 × 월 상세 표</span>
          <span className="text-gray-400">{tableOpen ? '▾ 접기' : '▸ 펼치기'}</span>
        </button>
        {tableOpen && (
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left font-semibold py-1.5 pr-2 sticky left-0 bg-white">연도</th>
                  {MONTHS.map(m => (
                    <th key={m} className="text-right font-semibold py-1.5 px-2">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pivot.map(row => (
                  <tr key={row.year} className="border-t border-gray-100">
                    <td className="text-left font-medium py-1.5 pr-2 text-gray-700 sticky left-0 bg-white">{row.year}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="text-right py-1.5 px-2 tabular-nums text-gray-600">
                        {v != null ? v.toFixed(2) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
