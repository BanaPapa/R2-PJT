import React, { useMemo } from 'react';
import { useAppStore } from '../../shared/lib/store';
import { MVP_CONFIG } from '../../shared/config';

export const StatisticsTray: React.FC = () => {
  const { baseRegion, comparisonRegions, priceData } = useAppStore();

  const statistics = useMemo(() => {
    const selectedRegions = [
      ...(baseRegion ? [{ ...baseRegion, isBase: true }] : []),
      ...comparisonRegions.map(r => ({ ...r, isBase: false }))
    ];

    return selectedRegions.map((region, index) => {
      const regionPriceData = priceData.filter(d => d.regionId === region.id);
      const values = regionPriceData.map(d => d.priceIndex).filter(v => v !== null);
      
      if (values.length < 2) {
        return {
          region,
          latest: null,
          change: null,
          color: MVP_CONFIG.CHART.colors[index % MVP_CONFIG.CHART.colors.length]
        };
      }

      const latest = values[values.length - 1];
      const previous = values[values.length - 2];
      const change = ((latest - previous) / previous * 100);

      return {
        region,
        latest,
        change,
        color: MVP_CONFIG.CHART.colors[index % MVP_CONFIG.CHART.colors.length]
      };
    });
  }, [baseRegion, comparisonRegions, priceData]);

  if (statistics.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">지역을 선택해주세요</p>
          <p className="text-sm text-gray-500 mt-1">선택된 지역의 통계가 여기에 표시됩니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth">
      {statistics.map((stat) => (
        <div
          key={stat.region.id}
          className={`flex-shrink-0 bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm border rounded-xl p-4 min-w-[180px] hover:shadow-lg hover:scale-105 transition-all duration-200 ${
            stat.region.isBase 
              ? 'border-blue-200/60 shadow-blue-50' 
              : 'border-emerald-200/60 shadow-emerald-50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div 
                className={`w-4 h-4 rounded-full shadow-sm ${
                  stat.region.isBase 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                }`}
              />
              <span className="font-semibold text-sm text-gray-900 truncate max-w-[100px]">
                {stat.region.name}
              </span>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              stat.region.isBase 
                ? 'bg-blue-100/80 text-blue-700 border border-blue-200/50' 
                : 'bg-emerald-100/80 text-emerald-700 border border-emerald-200/50'
            }`}>
              {stat.region.isBase ? '기준' : '비교'}
            </span>
          </div>
          
          {stat.latest !== null ? (
            <div className="space-y-2">
              <div className="text-2xl font-bold text-gray-900">
                {stat.latest.toFixed(1)}
              </div>
              <div className={`text-xs font-semibold flex items-center ${
                stat.change >= 0 
                  ? 'text-red-600' 
                  : 'text-blue-600'
              }`}>
                <span className="mr-1">
                  {stat.change >= 0 ? '↗' : '↘'}
                </span>
                {Math.abs(stat.change).toFixed(1)}%
                <span className="ml-1 text-gray-500 font-normal">
                  전월 대비
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="text-gray-400 text-xs">
                📊 데이터 준비중
              </div>
            </div>
          )}
        </div>
      ))}
      
      {/* Add More Placeholder */}
      {statistics.length < 4 && (
        <div className="flex-shrink-0 bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-dashed border-gray-300/60 rounded-xl p-4 min-w-[180px] flex items-center justify-center hover:border-gray-400/60 hover:bg-gray-100/50 transition-all duration-200 cursor-pointer">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 bg-gray-200 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-600">지역 추가</span>
            <span className="text-xs text-gray-500 block mt-1">최대 4개 지역</span>
          </div>
        </div>
      )}
    </div>
  );
};