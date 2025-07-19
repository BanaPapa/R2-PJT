import React from 'react';
import { Card, Button } from '../../shared/ui';
import { useAppStore } from '../../shared/lib/store';
import { MVP_CONFIG } from '../../shared/config';

export const RegionSelector: React.FC = () => {
  const { 
    baseRegion, 
    comparisonRegions, 
    setBaseRegion, 
    addComparisonRegion, 
    removeComparisonRegion,
    clearComparisonRegions 
  } = useAppStore();

  const handleBaseRegionSelect = (region: any) => {
    setBaseRegion(region);
  };

  const handleComparisonRegionSelect = (region: any) => {
    if (comparisonRegions.some(r => r.id === region.id)) {
      removeComparisonRegion(region.id);
    } else {
      addComparisonRegion(region);
    }
  };

  const isComparisonSelected = (regionId: string) => {
    return comparisonRegions.some(r => r.id === regionId);
  };

  return (
    <div className="space-y-6">
      {/* Base Region Selection */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          기준 지역 선택
        </h3>
        <div className="space-y-2">
          {MVP_CONFIG.SAMPLE_REGIONS.map((region) => (
            <button
              key={region.id}
              onClick={() => handleBaseRegionSelect(region)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                baseRegion?.id === region.id
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">{region.name}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* Comparison Regions Selection */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            비교 지역 선택
          </h3>
          {comparisonRegions.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearComparisonRegions}
            >
              전체 해제
            </Button>
          )}
        </div>
        
        <div className="space-y-2">
          {MVP_CONFIG.SAMPLE_REGIONS.map((region) => {
            const isSelected = isComparisonSelected(region.id);
            const isBaseRegion = baseRegion?.id === region.id;
            const canSelect = !isBaseRegion && (comparisonRegions.length < 3 || isSelected);
            
            return (
              <button
                key={region.id}
                onClick={() => handleComparisonRegionSelect(region)}
                disabled={!canSelect}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : isBaseRegion
                    ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    : canSelect
                    ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{region.name}</span>
                  {isSelected && (
                    <span className="text-green-600 text-sm">✓</span>
                  )}
                  {isBaseRegion && (
                    <span className="text-gray-400 text-sm">기준</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        <div className="mt-4 text-sm text-gray-500">
          {comparisonRegions.length}/3 지역 선택됨
        </div>
      </Card>

      {/* Selected Regions Summary */}
      {(baseRegion || comparisonRegions.length > 0) && (
        <Card className="bg-blue-50 border-blue-200">
          <h4 className="text-md font-medium text-blue-900 mb-3">
            선택된 지역
          </h4>
          
          {baseRegion && (
            <div className="mb-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
                기준: {baseRegion.name}
              </span>
            </div>
          )}
          
          {comparisonRegions.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm text-blue-700 font-medium">비교:</div>
              <div className="flex flex-wrap gap-2">
                {comparisonRegions.map((region) => (
                  <span 
                    key={region.id}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                  >
                    {region.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};