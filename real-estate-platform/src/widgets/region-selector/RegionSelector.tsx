import React, { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '../../shared/lib/store';
import { MAX_REGIONS, CHART_COLORS } from '../../shared/config';

const QUICK_GROUPS: Record<string, string[]> = {
  '전국': ['전국'],
  '서울': ['서울특별시', '강북14개구', '강남11개구'],
  '수도권': ['경기도', '인천광역시'],
  '광역시': ['부산광역시', '대구광역시', '광주광역시', '대전광역시', '울산광역시'],
};

export const RegionSelector: React.FC = () => {
  const {
    allRegions,
    selectedRegions,
    regionsLoading,
    toggleRegion,
    clearRegions,
    loadRegions,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    loadWeeklyData,
    dataLoading,
    latestDate,
    totalRecords,
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  useEffect(() => {
    if (allRegions.length === 0) {
      loadRegions();
    }
  }, []);

  const filteredRegions = useMemo(() => {
    let regions = allRegions;
    if (activeGroup && QUICK_GROUPS[activeGroup]) {
      const groupPrefixes = QUICK_GROUPS[activeGroup];
      regions = allRegions.filter(r => groupPrefixes.some(prefix => r.startsWith(prefix) || r === prefix));
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      regions = regions.filter(r => r.toLowerCase().includes(term));
    }
    return regions;
  }, [allRegions, searchTerm, activeGroup]);

  const handleCompare = () => {
    loadWeeklyData();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">지역 선택</h2>
          {selectedRegions.length > 0 && (
            <button
              onClick={clearRegions}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
            >
              전체 해제
            </button>
          )}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">시작일</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">종료일</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="hover:opacity-75 leading-none"
                  aria-label={`Remove ${region}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Compare button */}
        <button
          onClick={handleCompare}
          disabled={selectedRegions.length === 0 || dataLoading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {dataLoading ? '로딩 중...' : `비교하기 (${selectedRegions.length}/${MAX_REGIONS})`}
        </button>
      </div>

      {/* Quick group filter */}
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setActiveGroup(null)}
            className={`px-2 py-1 text-xs rounded-full transition-colors ${
              activeGroup === null ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {Object.keys(QUICK_GROUPS).map(group => (
            <button
              key={group}
              onClick={() => setActiveGroup(activeGroup === group ? null : group)}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                activeGroup === group ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {group}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-100">
        <input
          type="text"
          placeholder="지역명 검색..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Region List */}
      <div className="flex-1 overflow-auto px-4 py-2">
        {regionsLoading ? (
          <div className="text-center text-sm text-gray-400 py-8">지역 목록 로딩 중...</div>
        ) : filteredRegions.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8">검색 결과가 없습니다</div>
        ) : (
          <div className="space-y-1">
            {filteredRegions.map(region => {
              const selIdx = selectedRegions.indexOf(region);
              const isSelected = selIdx >= 0;
              const canSelect = isSelected || selectedRegions.length < MAX_REGIONS;

              return (
                <button
                  key={region}
                  onClick={() => canSelect && toggleRegion(region)}
                  disabled={!canSelect}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                    isSelected
                      ? 'text-white font-medium'
                      : canSelect
                      ? 'text-gray-800 hover:bg-gray-50 border border-transparent hover:border-gray-200'
                      : 'text-gray-400 cursor-not-allowed'
                  }`}
                  style={isSelected ? { backgroundColor: CHART_COLORS[selIdx % CHART_COLORS.length] } : {}}
                >
                  <div className="flex items-center justify-between">
                    <span>{region}</span>
                    {isSelected && (
                      <span className="text-xs opacity-75">{selIdx + 1}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer status */}
      <div className="p-3 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-500">
          최신 데이터: {latestDate ?? '-'} | 총 {totalRecords.toLocaleString()}건
        </p>
      </div>
    </div>
  );
};
