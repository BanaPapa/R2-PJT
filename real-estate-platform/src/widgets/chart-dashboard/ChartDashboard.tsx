import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LoadingSpinner } from '../../shared/ui';
import { useAppStore } from '../../shared/lib/store';
import { MVP_CONFIG } from '../../shared/config';

export const ChartDashboard: React.FC = () => {
  const { baseRegion, comparisonRegions, priceData, isLoading } = useAppStore();

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!baseRegion) return [];

    const selectedRegions = [baseRegion, ...comparisonRegions];
    const dates = [...new Set(priceData.map(d => d.date))].sort();

    return dates.map(date => {
      const dataPoint: any = { date };
      
      selectedRegions.forEach((region) => {
        const regionData = priceData.find(d => d.date === date && d.regionId === region.id);
        dataPoint[region.name] = regionData?.priceIndex || null;
      });

      return dataPoint;
    });
  }, [baseRegion, comparisonRegions, priceData]);

  // Get chart lines configuration
  const chartLines = useMemo(() => {
    if (!baseRegion) return [];

    const selectedRegions = [baseRegion, ...comparisonRegions];
    
    return selectedRegions.map((region, index) => ({
      key: region.name,
      stroke: MVP_CONFIG.CHART.colors[index % MVP_CONFIG.CHART.colors.length],
      strokeWidth: index === 0 ? 3 : 2, // Base region is thicker
      strokeDasharray: index === 0 ? undefined : '5 5', // Comparison regions are dashed
    }));
  }, [baseRegion, comparisonRegions]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              <span className="font-medium">{entry.dataKey}</span>: {entry.value?.toFixed(1)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!baseRegion) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200/60 p-6 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">부동산 가격 지수 추이</h2>
            <p className="text-sm text-gray-600 mt-1">지역별 부동산 가격 변동을 실시간으로 분석합니다</p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
              실시간
            </span>
          </div>
        </div>
        
        <div className="w-full h-[400px] bg-gradient-to-br from-gray-50 to-blue-50/30 border-2 border-dashed border-gray-300/60 rounded-xl flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">인터랙티브 차트</h3>
            <p className="text-gray-600 mb-6">
              좌측에서 지역을 선택하면 해당 지역의 부동산 가격 추이를 시각화하여 보여드립니다
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                기준 지역
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div>
                비교 지역
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-gray-200/60 p-6 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">부동산 가격 지수 추이</h2>
          <p className="text-sm text-gray-600 mt-1">선택된 지역들의 가격 변동 추이를 비교분석합니다</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse"></div>
            실시간
          </span>
          {isLoading && <LoadingSpinner />}
        </div>
      </div>

      <div className="h-[400px] bg-gradient-to-br from-white to-gray-50/30 rounded-lg p-4 border border-gray-100">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
              tickFormatter={(value) => {
                const date = new Date(value + '-01');
                return date.toLocaleDateString('ko-KR', { 
                  year: '2-digit', 
                  month: 'short' 
                });
              }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={{ stroke: '#e2e8f0' }}
              domain={['dataMin - 5', 'dataMax + 5']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ 
                fontSize: '14px', 
                paddingTop: '20px',
                color: '#374151'
              }} 
            />
            
            {chartLines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.stroke}
                strokeWidth={line.strokeWidth}
                strokeDasharray={line.strokeDasharray}
                dot={{ fill: line.stroke, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: line.stroke, strokeWidth: 3, fill: 'white' }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};