import React, { useEffect, useMemo, useState } from 'react';
import { useMonthlyStore } from '../../shared/lib/monthly-store';
import { MAX_REGIONS, CHART_COLORS } from '../../shared/config';
import { AGGREGATE_REGIONS } from '../../shared/config/kb-aggregates';
import { getRegions, peekRegions, prefetchRegions, type RegionItem } from '../../shared/lib/kb-region-api';
import { buildMidOptions, type MidOption } from '../../shared/lib/kb-mid-options';
import { monthlyLocal, type MonthlyRegionLookup } from '../../entities/monthly-data';
import { PeriodSlider } from '../region-selector/PeriodSlider';

// 대지역 선택값 인코딩: 집계지역은 "agg:전국", 시도는 "sido:41". (주간 RegionSelector와 동일)
type LargeValue = string;

// 월간 시세지표 사이드바 — 주간 RegionSelector와 동일한 UI·방식.
// 차이는 데이터 소스(월간 룩업으로 가용성 판정)뿐이다.
export const MonthlyRegionCascade: React.FC = () => {
  const {
    selectedRegions,
    regionLabels,
    addRegion,
    removeRegion,
    clearRegions,
    baseDate,
    setBaseDate,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    allDates,
    loadPriceData,
    priceLoading,
  } = useMonthlyStore();

  // 주간 형식 선택 키 → 월간 regionPath 해석기 (데이터 없으면 undefined)
  const [lookup, setLookup] = useState<MonthlyRegionLookup | null>(null);
  useEffect(() => {
    let active = true;
    monthlyLocal.getRegionLookup().then(l => active && setLookup(l)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const isAvail = useMemo(
    () => (key: string) => !!lookup && lookup.resolve(key) !== undefined,
    [lookup],
  );

  // 대지역(시도) 목록 — KB Land API level 1 (주간과 동일 소스·순서)
  const [sidoList, setSidoList] = useState<RegionItem[]>([]);
  const [largeValue, setLargeValue] = useState<LargeValue>('');

  // 중지역 — KB Land API level 2 (선택 시도 기준) + buildMidOptions 평탄화
  const [midOptions, setMidOptions] = useState<MidOption[]>([]);
  const [midKey, setMidKey] = useState<string>('');
  const [loadingMid, setLoadingMid] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = peekRegions(1);
    if (cached) {
      setSidoList(cached);
      for (const s of cached) prefetchRegions(2, s.code);
      return;
    }
    getRegions(1)
      .then(list => {
        if (!active) return;
        setSidoList(list);
        for (const s of list) prefetchRegions(2, s.code);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const selectedSido = useMemo(() => {
    if (!largeValue.startsWith('sido:')) return null;
    const code = largeValue.slice(5);
    return sidoList.find(s => s.code === code) ?? null;
  }, [largeValue, sidoList]);

  const selectedAggregate = useMemo(() => {
    if (!largeValue.startsWith('agg:')) return null;
    const key = largeValue.slice(4);
    return AGGREGATE_REGIONS.find(a => a.weeklyKey === key) ?? null;
  }, [largeValue]);

  // 시도 선택 시 중지역 로드 (availability는 월간 룩업으로 판정)
  useEffect(() => {
    setMidKey('');
    setMidOptions([]);
    if (!selectedSido) return;

    const cached = peekRegions(2, selectedSido.code);
    if (cached) {
      setMidOptions(buildMidOptions(cached, isAvail, selectedSido.name));
      return;
    }
    setLoadingMid(true);
    let active = true;
    getRegions(2, selectedSido.code)
      .then(list => {
        if (active) setMidOptions(buildMidOptions(list, isAvail, selectedSido.name));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingMid(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSido, isAvail]);

  // 추가 대상: 중지역 선택 시 그것, 아니면 시도/집계.
  const target = useMemo<{ key: string; display: string; available: boolean } | null>(() => {
    if (selectedAggregate) {
      return {
        key: selectedAggregate.weeklyKey,
        display: selectedAggregate.label,
        available: isAvail(selectedAggregate.weeklyKey),
      };
    }
    if (selectedSido) {
      if (midKey) {
        const opt = midOptions.find(m => m.key === midKey);
        if (opt) return { key: opt.key, display: opt.basketLabel, available: opt.available };
      }
      return { key: selectedSido.name, display: selectedSido.name, available: isAvail(selectedSido.name) };
    }
    return null;
  }, [selectedAggregate, selectedSido, midKey, midOptions, isAvail]);

  const alreadyAdded = !!target && selectedRegions.includes(target.key);
  const isFull = selectedRegions.length >= MAX_REGIONS;
  const canAdd = !!target && target.available && !alreadyAdded && !isFull;

  const handleAdd = () => {
    if (!target || !canAdd) return;
    addRegion(target.key, target.display);
  };

  const midDisabled = !selectedSido || loadingMid;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800 tracking-wide">지역 선택</h2>
          {selectedRegions.length > 0 && (
            <button
              onClick={clearRegions}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded transition-colors"
            >
              전체 해제
            </button>
          )}
        </div>

        {/* 기간 선택 (프리셋 + 드래그 막대) — 월간 날짜축 주입 */}
        <PeriodSlider
          dates={allDates}
          fromDate={fromDate}
          toDate={toDate}
          setFromDate={setFromDate}
          setToDate={setToDate}
        />

        {/* 지수 기준월 — 지수 리베이스에 사용 */}
        <div className="mt-3">
          <label className="block text-xs text-gray-400 mb-1">지수 기준월 (이 달 = 100.0)</label>
          <select
            value={baseDate}
            onChange={e => setBaseDate(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {allDates.slice().reverse().map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cascading region selector (주간 RegionSelector와 동일 구조) */}
      <div className="p-4 flex flex-col gap-3 border-b border-gray-100">
        {/* 대지역 */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">대지역 (시/도 · 집계)</label>
          <select
            value={largeValue}
            onChange={e => setLargeValue(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">선택</option>
            <optgroup label="집계 지역">
              {AGGREGATE_REGIONS.map(a => (
                <option key={a.weeklyKey} value={`agg:${a.weeklyKey}`} disabled={!isAvail(a.weeklyKey)}>
                  {a.label}
                  {isAvail(a.weeklyKey) ? '' : ' (데이터 없음)'}
                </option>
              ))}
            </optgroup>
            <optgroup label="시 / 도">
              {sidoList.map(s => (
                <option key={s.code} value={`sido:${s.code}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* 중지역 */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">중지역 (시/군/구)</label>
          <select
            value={midKey}
            disabled={midDisabled}
            onChange={e => setMidKey(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-300"
          >
            <option value="">
              {!selectedSido
                ? selectedAggregate
                  ? '집계 지역은 중지역 없음'
                  : '대지역을 먼저 선택'
                : loadingMid
                ? '불러오는 중...'
                : `${selectedSido.name} 전체 또는 시/군/구 선택`}
            </option>
            {midOptions.map(m => (
              <option key={m.key} value={m.key} disabled={!m.available}>
                {m.label}
                {m.available ? '' : ' (데이터 없음)'}
              </option>
            ))}
          </select>
        </div>

        {/* 소지역 — 월간도 중지역까지 평탄화하므로 비활성 (주간과 동일) */}
        <div>
          <label className="block text-xs text-gray-300 mb-1">소지역 (읍/면/동)</label>
          <select
            disabled
            value=""
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-2 bg-gray-50 text-gray-300"
          >
            <option value="">월간 시계열 미지원</option>
          </select>
        </div>

        {/* 추가 버튼 */}
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          title={
            isFull
              ? `비교함이 가득 찼습니다 (최대 ${MAX_REGIONS}개)`
              : target && !target.available
              ? '월간 데이터가 없는 지역입니다'
              : alreadyAdded
              ? '이미 추가된 지역입니다'
              : undefined
          }
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 text-sm font-semibold rounded-lg transition-colors"
        >
          {target
            ? alreadyAdded
              ? '이미 추가됨'
              : !target.available
              ? '데이터 없음'
              : `추가: ${target.display}`
            : '추가'}
        </button>
      </div>

      {/* 비교함 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-600">
            비교함 ({selectedRegions.length}/{MAX_REGIONS})
          </h3>
        </div>

        {selectedRegions.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">위에서 지역을 선택해 추가하세요</p>
        ) : (
          <div className="space-y-1.5 mb-3">
            {selectedRegions.map((region, idx) => (
              <div
                key={region}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 text-sm"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                <span className="text-gray-700 truncate">{regionLabels[region] ?? region}</span>
                <button
                  onClick={() => removeRegion(region)}
                  className="ml-auto text-gray-400 hover:text-red-500 leading-none text-base"
                  aria-label={`${regionLabels[region] ?? region} 제거`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={loadPriceData}
          disabled={selectedRegions.length === 0 || priceLoading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 text-sm font-semibold rounded-lg transition-colors"
        >
          {priceLoading ? '로딩 중...' : '비교하기'}
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
        <p className="text-[11px] text-gray-400">
          월간 주택 시계열 &nbsp;·&nbsp; 최신 {allDates[allDates.length - 1] ?? '-'}
        </p>
      </div>
    </div>
  );
};
