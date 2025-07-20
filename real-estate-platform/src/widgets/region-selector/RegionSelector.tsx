import React, { useState } from 'react';
import { useAppStore } from '../../shared/lib/store';
import { MVP_CONFIG } from '../../shared/config';

export const RegionSelector: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { 
    baseRegion, 
    comparisonRegions, 
    setBaseRegion, 
    addComparisonRegion, 
    removeComparisonRegion,
    clearComparisonRegions 
  } = useAppStore();

  const filteredRegions = MVP_CONFIG.SAMPLE_REGIONS.filter(region =>
    region.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRegionToggle = (region: any) => {
    if (baseRegion?.id === region.id) {
      setBaseRegion(null);
    } else if (comparisonRegions.some(r => r.id === region.id)) {
      removeComparisonRegion(region.id);
    } else if (!baseRegion) {
      setBaseRegion(region);
    } else if (comparisonRegions.length < 3) {
      addComparisonRegion(region);
    }
  };

  const getRegionStatus = (region: any) => {
    if (baseRegion?.id === region.id) return 'base';
    if (comparisonRegions.some(r => r.id === region.id)) return 'comparison';
    return 'unselected';
  };

  const totalSelected = (baseRegion ? 1 : 0) + comparisonRegions.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200/60">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">지역 선택</h2>
            <p className="text-sm text-gray-600 mt-1">기준 지역 1개 + 비교 지역 3개까지</p>
          </div>
          {totalSelected > 0 && (
            <button 
              onClick={() => {
                setBaseRegion(null);
                clearComparisonRegions();
              }}
              className="text-xs px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              전체 해제
            </button>
          )}
        </div>
        
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="지역명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        
        {/* Selection Counter */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900">
              {totalSelected}/4 지역 선택됨
            </span>
            {totalSelected > 0 && (
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm"></div>
              <span className="text-xs font-medium text-gray-600">기준</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full shadow-sm"></div>
              <span className="text-xs font-medium text-gray-600">비교</span>
            </div>
          </div>
        </div>
      </div>

      {/* Region List */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-2">
          {filteredRegions.map((region) => {
            const status = getRegionStatus(region);
            const canSelect = status !== 'unselected' || totalSelected < 4;
            
            return (
              <button
                key={region.id}
                onClick={() => canSelect && handleRegionToggle(region)}
                disabled={!canSelect}
                className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                  status === 'base'
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : status === 'comparison'
                    ? 'border-green-500 bg-green-50 shadow-sm'
                    : canSelect
                    ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {/* Status Indicator */}
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      status === 'base'
                        ? 'bg-blue-500 border-blue-500'
                        : status === 'comparison'
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300'
                    }`}>
                      {(status === 'base' || status === 'comparison') && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Region Info */}
                    <div>
                      <div className={`font-medium ${
                        status === 'base' ? 'text-blue-900' :
                        status === 'comparison' ? 'text-green-900' :
                        'text-gray-900'
                      }`}>
                        {region.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {region.name.includes('서울') ? '수도권' : '광역시'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  {status === 'base' && (
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      기준
                    </span>
                  )}
                  {status === 'comparison' && (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      비교
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        {filteredRegions.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400">
              <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.467-.881-6.08-2.33M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm font-medium">검색 결과가 없습니다</p>
              <p className="text-xs text-gray-500 mt-1">다른 키워드로 검색해보세요</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Help */}
      <div className="p-6 border-t border-gray-200/60 bg-gradient-to-r from-gray-50 to-blue-50/20">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
            <span>기준 지역 1개 + 비교 지역 최대 3개까지 선택</span>
          </div>
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
            <span>선택된 지역을 다시 클릭하면 해제됩니다</span>
          </div>
        </div>
      </div>
    </div>
  );
};