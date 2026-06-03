import React, { useState } from 'react';
import { useAppStore } from '../../shared/lib/store';
import { MAX_REGIONS, CHART_COLORS } from '../../shared/config';

const REGION_CATEGORIES = [
  {
    id: 'all',
    label: '전국',
    regions: ['전국'],
  },
  {
    id: 'seoul',
    label: '서울',
    regions: ['서울특별시', '강북14개구', '강남11개구'],
  },
  {
    id: 'metro',
    label: '수도권',
    regions: ['수도권', '경기도', '인천광역시'],
  },
  {
    id: 'major',
    label: '광역시',
    regions: [
      '6개광역시',
      '부산광역시',
      '대구광역시',
      '광주광역시',
      '대전광역시',
      '울산광역시',
    ],
  },
  {
    id: 'other',
    label: '기타',
    regions: ['세종특별자치시', '기타지방'],
  },
];

export const RegionSelector: React.FC = () => {
  const {
    allRegions,
    selectedRegions,
    regionsLoading,
    toggleRegion,
    clearRegions,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    loadWeeklyData,
    dataLoading,
    latestDate,
    totalRecords,
  } = useAppStore();

  const [activeCategory, setActiveCategory] = useState(REGION_CATEGORIES[0].id);

  const currentCategory =
    REGION_CATEGORIES.find(c => c.id === activeCategory) ?? REGION_CATEGORIES[0];

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

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">시작일</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">종료일</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Selected chips */}
        {selectedRegions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {selectedRegions.map((region, idx) => (
              <span
                key={region}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
              >
                {region}
                <button
                  onClick={() => toggleRegion(region)}
                  className="hover:opacity-75 leading-none ml-0.5"
                  aria-label={`${region} 제거`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Compare button */}
        <button
          onClick={loadWeeklyData}
          disabled={selectedRegions.length === 0 || dataLoading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 text-sm font-semibold rounded-lg transition-colors"
        >
          {dataLoading
            ? '로딩 중...'
            : `비교하기 (${selectedRegions.length}/${MAX_REGIONS})`}
        </button>
      </div>

      {/* Two-panel region selector */}
      {regionsLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          지역 목록 로딩 중...
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Category tabs */}
          <nav className="w-[72px] flex-shrink-0 border-r border-gray-100 overflow-y-auto bg-gray-50">
            {REGION_CATEGORIES.map(cat => {
              const availableCount = cat.regions.filter(r =>
                allRegions.includes(r)
              ).length;
              const isActive = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full py-3.5 px-1 text-center transition-all border-l-[3px] ${
                    isActive
                      ? 'bg-white border-blue-500 text-blue-700'
                      : 'border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                  }`}
                >
                  <span className={`block text-xs font-semibold ${isActive ? 'text-blue-700' : ''}`}>
                    {cat.label}
                  </span>
                  <span
                    className={`block text-[10px] mt-0.5 ${
                      isActive ? 'text-blue-400' : 'text-gray-400'
                    }`}
                  >
                    {availableCount}개
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right: Region list */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {currentCategory.regions.map(region => {
                const isAvailable = allRegions.includes(region);
                const selIdx = selectedRegions.indexOf(region);
                const isSelected = selIdx >= 0;
                const isMaxed = selectedRegions.length >= MAX_REGIONS && !isSelected;
                const isDisabled = !isAvailable || isMaxed;

                return (
                  <button
                    key={region}
                    onClick={() => !isDisabled && toggleRegion(region)}
                    disabled={isDisabled}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                      !isAvailable
                        ? 'text-gray-300 cursor-not-allowed'
                        : isSelected
                        ? 'text-white font-semibold shadow-sm'
                        : isMaxed
                        ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-100'
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: CHART_COLORS[selIdx % CHART_COLORS.length] }
                        : {}
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span>{region}</span>
                      <span className="text-xs">
                        {!isAvailable ? (
                          <span className="text-gray-300 font-normal">미지원</span>
                        ) : isSelected ? (
                          <span className="w-4 h-4 inline-flex items-center justify-center rounded-full bg-white bg-opacity-30 text-[10px] font-bold">
                            {selIdx + 1}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
        <p className="text-[11px] text-gray-400">
          최신 데이터: {latestDate ?? '-'} &nbsp;·&nbsp; 총 {totalRecords.toLocaleString()}건
        </p>
      </div>
    </div>
  );
};
