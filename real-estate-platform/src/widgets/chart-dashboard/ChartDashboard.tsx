import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, LoadingSpinner } from '../../shared/ui';
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
      <Card className="h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-lg mb-2">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            지역을 선택해주세요
          </h3>
          <p className="text-gray-500">
            왼쪽에서 기준 지역을 선택하면 차트가 표시됩니다
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            부동산 가격 지수 추이
          </h2>
          {isLoading && <LoadingSpinner />}
        </div>

        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={MVP_CONFIG.CHART.margin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value + '-01');
                  return date.toLocaleDateString('ko-KR', { 
                    year: '2-digit', 
                    month: 'short' 
                  });
                }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                domain={['dataMin - 5', 'dataMax + 5']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {chartLines.map((line) => (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  stroke={line.stroke}
                  strokeWidth={line.strokeWidth}
                  strokeDasharray={line.strokeDasharray}
                  dot={{ fill: line.stroke, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: line.stroke, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Summary Stats */}
      {chartData.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            주요 통계
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {chartLines.map((line, index) => {
              const values = chartData
                .map(d => d[line.key])
                .filter(v => v !== null && v !== undefined);
              
              const latest = values[values.length - 1];
              const previous = values[values.length - 2];
              const change = previous ? ((latest - previous) / previous * 100) : 0;
              
              return (
                <div 
                  key={line.key}
                  className="p-4 rounded-lg border"
                  style={{ borderColor: line.stroke + '40' }}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: line.stroke }}
                    />
                    <span className="font-medium text-sm text-gray-900">
                      {line.key}
                      {index === 0 && ' (기준)'}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="text-xl font-bold text-gray-900">
                      {latest?.toFixed(1)}
                    </div>
                    <div className={`text-sm font-medium ${
                      change > 0 ? 'text-red-600' : change < 0 ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {change > 0 ? '↗' : change < 0 ? '↘' : '→'} {Math.abs(change).toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};