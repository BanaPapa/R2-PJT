import React, { useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
} from 'recharts';
import { useAppStore } from '../../shared/lib/store';
import { CHART_COLORS, WEEKLY_METRICS, type MetricKey } from '../../shared/config';
import type { WeeklyDataRow } from '../../entities/kb-data';

type ChartRow = { date: string } & Record<string, number | null>;

// 기준일과 가장 가까운 데이터 날짜의 인덱스
function nearestDateIndex(dates: string[], target: string): number {
  if (!dates.length) return -1;
  const t = new Date(target).getTime();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < dates.length; i++) {
    const diff = Math.abs(new Date(dates[i]!).getTime() - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

// Transform flat rows into chart-ready data grouped by date.
// rebase=true 이면 지수를 기준일(baseDate) 값이 100이 되도록 지역별로 재정규화한다.
function buildChartData(
  weeklyData: WeeklyDataRow[],
  selectedRegions: string[],
  metricKey: MetricKey,
  rebase: boolean,
  baseDate: string,
): ChartRow[] {
  const byDate = new Map<string, Record<string, number | null>>();

  for (const row of weeklyData) {
    if (!selectedRegions.includes(row.region)) continue;
    if (!byDate.has(row.date)) byDate.set(row.date, {});
    const entry = byDate.get(row.date)!;
    const value = row[metricKey as keyof WeeklyDataRow] as number | null;
    entry[row.region] = value;
  }

  const rows = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values })) as ChartRow[];

  if (!rebase || !baseDate || rows.length === 0) return rows;

  // 기준일(가장 가까운 데이터 날짜)에서의 지역별 기준값으로 나눠 100 기준 재정규화
  const baseRow = rows[nearestDateIndex(rows.map(r => r.date), baseDate)]!;
  return rows.map(r => {
    const out: ChartRow = { date: r.date };
    for (const region of selectedRegions) {
      const baseValue = baseRow[region];
      const value = r[region];
      out[region] =
        typeof baseValue === 'number' && baseValue !== 0 && typeof value === 'number'
          ? (value / baseValue) * 100
          : value;
    }
    return out;
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear().toString().slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 지수 메트릭(기준일 100 리베이스 대상) 판별
function isIndexMetric(key: MetricKey): boolean {
  return key.endsWith('Index');
}

// 기준일 표기: (2026.1.12=100.0)
function formatBaseNote(dateStr: string): string {
  const d = new Date(dateStr);
  return `(${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}=100.0)`;
}

// 누적변동률 표기: (2026.1.12 대비)
function formatCumulativeNote(dateStr: string): string {
  const d = new Date(dateStr);
  return `(${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} 대비)`;
}

// 지수의 전주대비 변동률(%): (지수ₜ / 지수ₜ₋₁ − 1) × 100.
// 리베이스된 지수에서 파생하므로 증감이 지수 변화에 연동된다.
function toWeekOverWeek(rows: ChartRow[], selectedRegions: string[]): ChartRow[] {
  return rows.map((r, i) => {
    const out: ChartRow = { date: r.date };
    const prev = i > 0 ? rows[i - 1]! : null;
    for (const region of selectedRegions) {
      const v = r[region];
      const p = prev ? prev[region] : null;
      out[region] =
        prev && typeof v === 'number' && typeof p === 'number' && p !== 0 ? (v / p - 1) * 100 : null;
    }
    return out;
  });
}

// 누적 변동률(%): 표시 구간의 시작점을 0으로 해 종료일까지의 누적 변화.
// 각 지역별로 구간 내 첫 유효값을 기준(0)으로 (값/기준 − 1) × 100.
function toCumulative(slicedRows: ChartRow[], selectedRegions: string[]): ChartRow[] {
  if (slicedRows.length === 0) return [];
  const ref: Record<string, number> = {};
  for (const region of selectedRegions) {
    for (const row of slicedRows) {
      const v = row[region];
      if (typeof v === 'number') {
        ref[region] = v;
        break;
      }
    }
  }
  return slicedRows.map(r => {
    const out: ChartRow = { date: r.date };
    for (const region of selectedRegions) {
      const v = r[region];
      const base = ref[region];
      out[region] =
        typeof v === 'number' && typeof base === 'number' && base !== 0 ? (v / base - 1) * 100 : null;
    }
    return out;
  });
}

// 분기 라벨: 1분기에만 연도를 붙인다 (예: 25.1Q, 2Q, 3Q, 4Q)
function formatQuarter(dateStr: string): string {
  const d = new Date(dateStr);
  const q = Math.floor(d.getMonth() / 3) + 1;
  if (q === 1) return `${d.getFullYear().toString().slice(2)}.1Q`;
  return `${q}Q`;
}

// 각 연-분기의 첫 데이터 날짜를 눈금으로 추출.
// 눈금이 너무 많으면 분기 간격을 넓히되, Q1(연도 라벨)은 항상 유지한다.
function getQuarterTicks(dates: string[], maxTicks = 14): string[] {
  if (!dates.length) return [];
  const boundaries: { date: string; q: number }[] = [];
  let prevKey = '';
  for (const ds of dates) {
    const d = new Date(ds);
    const q = Math.floor(d.getMonth() / 3); // 0=Q1 ... 3=Q4
    const key = `${d.getFullYear()}-${q}`;
    if (key !== prevKey) {
      boundaries.push({ date: ds, q });
      prevKey = key;
    }
  }
  // 표시할 분기 선택: 촘촘하면 전체, 보통이면 Q1·Q3, 넓으면 Q1만
  let keepQuarters: number[];
  if (boundaries.length <= maxTicks) keepQuarters = [0, 1, 2, 3];
  else if (Math.ceil(boundaries.length / 2) <= maxTicks) keepQuarters = [0, 2];
  else keepQuarters = [0];
  return boundaries.filter(b => keepQuarters.includes(b.q)).map(b => b.date);
}

interface MetricChartProps {
  title: string;
  subtitle?: string;
  unit: string;
  data: ChartRow[];
  selectedRegions: string[];
  regionLabels: Record<string, string>;
}

const MetricChart: React.FC<MetricChartProps> = ({
  title,
  subtitle,
  unit,
  data,
  selectedRegions,
  regionLabels,
}) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg text-xs">
        <p className="font-medium text-gray-900 mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {regionLabels[entry.dataKey] ?? entry.dataKey}:{' '}
            {entry.value != null ? `${entry.value.toFixed(2)}${unit}` : '-'}
          </p>
        ))}
      </div>
    );
  };

  const quarterTicks = useMemo(() => getQuarterTicks(data.map(d => d.date)), [data]);

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 flex-none text-sm font-semibold text-gray-700">
          {title}
          {subtitle && <span className="ml-1.5 text-xs font-normal text-gray-400">{subtitle}</span>}
        </h3>
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">데이터 없음</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 flex-none text-sm font-semibold text-gray-700">
        {title}
        {subtitle && <span className="ml-1.5 text-xs font-normal text-gray-400">{subtitle}</span>}
      </h3>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} syncId="kb-weekly">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              ticks={quarterTicks}
              tickFormatter={formatQuarter}
              interval={0}
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
              formatter={(value: string) => regionLabels[value] ?? value}
            />
            {selectedRegions.map((region, idx) => (
              <Line
                key={region}
                type="monotone"
                dataKey={region}
                name={regionLabels[region] ?? region}
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

// 드래그 막대 손잡이(투박한 기본 모양 대신 둥근 파란 핸들 + 그립선)
const BrushTraveller = (props: { x?: number; y?: number; width?: number; height?: number }) => {
  const { x = 0, y = 0, width = 10, height = 0 } = props;
  const cx = x + width / 2;
  const g1 = cx - 1.6;
  const g2 = cx + 1.6;
  return (
    <g style={{ cursor: 'ew-resize' }}>
      <rect x={x} y={y} width={width} height={height} rx={3} ry={3} fill="#3b82f6" />
      <line x1={g1} y1={y + height * 0.32} x2={g1} y2={y + height * 0.68} stroke="#fff" strokeWidth={1} strokeOpacity={0.85} />
      <line x1={g2} y1={y + height * 0.32} x2={g2} y2={y + height * 0.68} stroke="#fff" strokeWidth={1} strokeOpacity={0.85} />
    </g>
  );
};

interface RangeSliderProps {
  data: ChartRow[];
  dates: string[];
  startIndex: number;
  endIndex: number;
  fromDate: string;
  toDate: string;
  onBrushChange: (range: { startIndex?: number; endIndex?: number }) => void;
}

// 모든 차트가 공유하는 단일 기간 슬라이더.
// 막대 양끝을 드래그해 구간을 정하고, 막대 아래에는 분기 눈금을 표시한다.
const RangeSlider: React.FC<RangeSliderProps> = ({
  data,
  dates,
  startIndex,
  endIndex,
  fromDate,
  toDate,
  onBrushChange,
}) => {
  const quarterTicks = useMemo(() => getQuarterTicks(dates), [dates]);
  const lastIdx = Math.max(1, dates.length - 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-gray-700">
          기간 선택
          <span className="ml-2 text-xs font-normal text-gray-400">막대 양끝을 드래그하면 모든 그래프가 함께 조절됩니다</span>
        </span>
        <span className="font-mono text-sm whitespace-nowrap">
          <span className="text-blue-600">{fromDate}</span>
          <span className="text-gray-400"> ~ </span>
          <span className="text-blue-600">{toDate}</span>
        </span>
      </div>
      {/* 드래그 막대 (미리보기 라인 없이 얇은 빈 막대) */}
      <div className="h-7">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <Brush
              dataKey="date"
              height={20}
              startIndex={startIndex}
              endIndex={endIndex}
              onChange={onBrushChange}
              travellerWidth={10}
              traveller={<BrushTraveller />}
              stroke="#bfdbfe"
              fill="#eff6ff"
              tickFormatter={formatDate}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* 막대 아래 분기 눈금 */}
      <div className="relative h-5 mt-1">
        {quarterTicks.map(td => {
          const idx = dates.indexOf(td);
          if (idx < 0) return null;
          const left = (idx / lastIdx) * 100;
          const align =
            idx === 0 ? 'translate-x-0' : idx === dates.length - 1 ? '-translate-x-full' : '-translate-x-1/2';
          return (
            <div
              key={td}
              className={`absolute top-0 flex flex-col items-center ${align}`}
              style={{ left: `${left}%` }}
            >
              <span className="h-1.5 w-px bg-gray-300" />
              <span className="text-[10px] leading-none text-gray-400 mt-0.5 whitespace-nowrap">
                {formatQuarter(td)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ChartDashboard: React.FC = () => {
  const {
    weeklyData,
    selectedRegions,
    regionLabels,
    dataLoading,
    dataError,
    loadWeeklyData,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    baseDate,
  } = useAppStore();

  const chartDataByMetric = useMemo(() => {
    if (weeklyData.length === 0 || selectedRegions.length === 0) return null;
    // 지수는 기준일=100으로 리베이스
    const saleIndex = buildChartData(weeklyData, selectedRegions, 'saleIndex', true, baseDate);
    const jeonseIndex = buildChartData(weeklyData, selectedRegions, 'jeonseIndex', true, baseDate);
    // 증감은 리베이스된 지수에서 직접 파생(전주대비 변동률) → 지수 변화에 연동
    const saleChange = toWeekOverWeek(saleIndex, selectedRegions);
    const jeonseChange = toWeekOverWeek(jeonseIndex, selectedRegions);
    return { saleIndex, jeonseIndex, saleChange, jeonseChange } as Record<MetricKey, ChartRow[]>;
  }, [weeklyData, selectedRegions, baseDate]);

  // 모든 차트가 공유하는 날짜 축
  const dates = useMemo(() => {
    if (!chartDataByMetric) return [] as string[];
    return chartDataByMetric[WEEKLY_METRICS[0].key].map(d => d.date);
  }, [chartDataByMetric]);

  // 기준일을 실제 데이터 날짜로 스냅(지수=100 표기/입력에 사용)
  const snappedBaseDate = useMemo(() => {
    if (!dates.length) return baseDate;
    const i = nearestDateIndex(dates, baseDate);
    return dates[i] ?? baseDate;
  }, [dates, baseDate]);

  // 표시 구간(날짜입력) → 브러시 인덱스로 변환
  const [startIndex, endIndex] = useMemo<[number, number]>(() => {
    if (!dates.length) return [0, 0];
    let s = dates.findIndex(d => d >= fromDate);
    if (s < 0) s = 0;
    let e = dates.length - 1;
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i]! <= toDate) { e = i; break; }
    }
    if (e < s) e = dates.length - 1;
    return [s, e];
  }, [dates, fromDate, toDate]);

  // 선택 구간으로 잘라낸 데이터(각 차트는 이 구간만 표시)
  const slicedDataByMetric = useMemo(() => {
    if (!chartDataByMetric) return null;
    return Object.fromEntries(
      WEEKLY_METRICS.map(m => [m.key, chartDataByMetric[m.key].slice(startIndex, endIndex + 1)]),
    ) as Record<MetricKey, ChartRow[]>;
  }, [chartDataByMetric, startIndex, endIndex]);

  // 화면에 그릴 6개 차트: 지수 2 + 증감 2 + 누적변동률 2
  const chartViews = useMemo(() => {
    if (!slicedDataByMetric) return [];
    const baseNote = formatBaseNote(snappedBaseDate);
    // 누적변동률 기준 = 표시 구간의 시작일
    const startDate = slicedDataByMetric.saleIndex?.[0]?.date;
    const cumNote = startDate ? formatCumulativeNote(startDate) : undefined;
    const views: { id: string; title: string; subtitle?: string; unit: string; data: ChartRow[] }[] =
      WEEKLY_METRICS.map(m => ({
        id: m.key,
        title: m.label,
        subtitle: isIndexMetric(m.key) ? baseNote : undefined,
        unit: m.unit,
        data: slicedDataByMetric[m.key] ?? [],
      }));
    views.push(
      {
        id: 'saleCumulative',
        title: '매매 누적변동률',
        subtitle: cumNote,
        unit: '%',
        data: toCumulative(slicedDataByMetric.saleIndex ?? [], selectedRegions),
      },
      {
        id: 'jeonseCumulative',
        title: '전세 누적변동률',
        subtitle: cumNote,
        unit: '%',
        data: toCumulative(slicedDataByMetric.jeonseIndex ?? [], selectedRegions),
      },
    );
    return views;
  }, [slicedDataByMetric, snappedBaseDate, selectedRegions]);

  // 데이터가 처음 로드됐는데 날짜 입력이 범위를 벗어나면 보정
  useEffect(() => {
    if (!dates.length) return;
    if (fromDate < dates[0]!) setFromDate(dates[0]!);
    if (toDate > dates[dates.length - 1]!) setToDate(dates[dates.length - 1]!);
  }, [dates]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number }) => {
    if (range.startIndex == null || range.endIndex == null || !dates.length) return;
    const s = Math.max(0, Math.min(range.startIndex, dates.length - 1));
    const e = Math.max(0, Math.min(range.endIndex, dates.length - 1));
    setFromDate(dates[s]!);
    setToDate(dates[e]!);
  };

  if (selectedRegions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">지역을 선택해주세요</p>
          <p className="text-gray-300 text-sm">좌측에서 지역을 추가하면 자동으로 표시됩니다</p>
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

  if (!chartDataByMetric || !slicedDataByMetric) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <p className="text-gray-400 text-sm">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-none items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">KB 부동산 통계 비교</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedRegions.map((region, idx) => (
            <span
              key={region}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-white font-medium"
              style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
            >
              {regionLabels[region] ?? region}
            </span>
          ))}
        </div>
      </div>

      {/* 모든 그래프가 공유하는 단일 기간 슬라이더 */}
      <div className="flex-none">
        <RangeSlider
          data={chartDataByMetric[WEEKLY_METRICS[0].key]}
          dates={dates}
          startIndex={startIndex}
          endIndex={endIndex}
          fromDate={fromDate}
          toDate={toDate}
          onBrushChange={handleBrushChange}
        />
      </div>

      {/* 6개 그래프 — 남은 높이를 3×2로 가득 채움 (지수·증감·누적변동률) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-2 xl:grid-rows-3">
        {chartViews.map(view => (
          <MetricChart
            key={view.id}
            title={view.title}
            subtitle={view.subtitle}
            unit={view.unit}
            data={view.data}
            selectedRegions={selectedRegions}
            regionLabels={regionLabels}
          />
        ))}
      </div>
    </div>
  );
};
