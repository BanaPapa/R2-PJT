import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useMonthlyStore } from '../../shared/lib/monthly-store';
import { MONTHLY_METRICS } from '../../shared/config';
import type { RegionCompareItem } from '../../entities/monthly-data';

type SortKey = 'region' | 'prev' | 'curr' | 'change';
type SortDir = 'asc' | 'desc';

function fmt(v: number | null, digits = 2): string {
  return v != null ? v.toFixed(digits) : '-';
}

export const MonthlyRegionCompare: React.FC = () => {
  const { comparePath, compareResult, compareLoading, metric } = useMonthlyStore();
  const metricInfo = MONTHLY_METRICS.find(m => m.key === metric)!;
  const [sortKey, setSortKey] = useState<SortKey>('change');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const items = compareResult?.items ?? [];

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let av: number | string | null;
      let bv: number | string | null;
      if (sortKey === 'region') {
        av = a.region;
        bv = b.region;
        return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      }
      av = a[sortKey];
      bv = b[sortKey];
      const an = av ?? -Infinity;
      const bn = bv ?? -Infinity;
      return sortDir === 'asc' ? (an as number) - (bn as number) : (bn as number) - (an as number);
    });
    return arr;
  }, [items, sortKey, sortDir]);

  // 막대차트는 항상 증감률 내림차순 (상위 15개)
  const chartData = useMemo(
    () =>
      [...items]
        .filter(i => i.change != null)
        .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
        .slice(0, 15)
        .map(i => ({ region: i.region, change: i.change as number })),
    [items],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'region' ? 'asc' : 'desc');
    }
  };

  if (!comparePath) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <p className="text-gray-400 text-sm">왼쪽에서 상위 지역(예: 서울특별시, 경기도)을 선택하면 하위 지역을 비교합니다</p>
      </div>
    );
  }
  if (compareLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <p className="text-gray-500 text-sm">데이터 로딩 중...</p>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <p className="text-gray-400 text-sm">이 지역의 하위 지역 데이터가 없습니다. 다른 상위 지역을 선택해 보세요.</p>
      </div>
    );
  }

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-900">
          {comparePath.split('>').pop()} 하위 지역 · {metricInfo.label}
        </h2>
        <span className="text-xs text-gray-400">
          {compareResult?.prevDate} → {compareResult?.date} (증감률 %)
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">증감률 상위 ({chartData.length})</h3>
        <div style={{ height: Math.max(160, chartData.length * 26) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
              <YAxis
                type="category"
                dataKey="region"
                width={92}
                tick={{ fontSize: 11, fill: '#475569' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, '증감률']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar
                dataKey="change"
                radius={[0, 4, 4, 0]}
                label={{ position: 'right', fontSize: 10, formatter: (v: number | string) => Number(v).toFixed(2) } as never}
              >
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.change >= 0 ? '#ef4444' : '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 bg-gray-50 text-xs">
              {(['region', 'prev', 'curr', 'change'] as SortKey[]).map(key => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className={`py-2.5 px-3 font-semibold cursor-pointer select-none ${key === 'region' ? 'text-left' : 'text-right'}`}
                >
                  {key === 'region' ? '지역' : key === 'prev' ? '전월' : key === 'curr' ? '금월' : '증감률'}
                  {sortIndicator(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(item => (
              <tr key={item.regionPath} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 text-gray-800">{item.region}</td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-600">{fmt(item.prev)}</td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-600">{fmt(item.curr)}</td>
                <td
                  className={`py-2 px-3 text-right tabular-nums font-medium ${
                    item.change == null ? 'text-gray-400' : item.change >= 0 ? 'text-red-500' : 'text-blue-500'
                  }`}
                >
                  {item.change != null ? `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export type { RegionCompareItem };
