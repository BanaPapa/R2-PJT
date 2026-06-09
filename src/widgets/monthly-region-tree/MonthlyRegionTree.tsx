import React, { useState } from 'react';
import { useMonthlyStore } from '../../shared/lib/monthly-store';
import { CHART_COLORS } from '../../shared/config';
import type { RegionNode } from '../../entities/monthly-data';

interface TreeRowProps {
  node: RegionNode;
  depth: number;
}

const TreeRow: React.FC<TreeRowProps> = ({ node, depth }) => {
  const { subTab, seriesPaths, periodPath, comparePath, toggleSeriesPath, selectPeriodPath, selectComparePath } =
    useMonthlyStore();
  // 상위 2단계는 기본 펼침
  const [expanded, setExpanded] = useState(node.level <= 2);
  const hasChildren = node.children.length > 0;

  const seriesIdx = seriesPaths.indexOf(node.regionPath);
  const selected =
    subTab === 'series'
      ? seriesIdx >= 0
      : subTab === 'period'
      ? periodPath === node.regionPath
      : comparePath === node.regionPath;

  const handleSelect = () => {
    if (subTab === 'series') toggleSeriesPath(node.regionPath);
    else if (subTab === 'period') selectPeriodPath(node.regionPath);
    else selectComparePath(node.regionPath);
  };

  const selColor =
    subTab === 'series' && seriesIdx >= 0 ? CHART_COLORS[seriesIdx % CHART_COLORS.length] : undefined;

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-md text-sm transition-colors ${
          selected ? 'text-white font-semibold' : 'text-gray-700 hover:bg-blue-50'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px`, backgroundColor: selected ? selColor ?? '#3b82f6' : undefined }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(v => !v)}
            className={`w-4 h-4 flex items-center justify-center text-xs ${selected ? 'text-white' : 'text-gray-400'}`}
            aria-label={expanded ? '접기' : '펼치기'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4 h-4 inline-block" />
        )}
        <button onClick={handleSelect} className="flex-1 text-left py-1.5 pr-2 flex items-center justify-between">
          <span>{node.region}</span>
          {subTab === 'series' && seriesIdx >= 0 && (
            <span className="w-4 h-4 inline-flex items-center justify-center rounded-full bg-white/30 text-[10px] font-bold">
              {seriesIdx + 1}
            </span>
          )}
          {subTab !== 'series' && selected && <span className="text-[10px]">●</span>}
        </button>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map(child => (
            <TreeRow key={child.regionPath} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const MonthlyRegionTree: React.FC = () => {
  const { subTab, regionTree, treeLoading, treeError, seriesPaths } = useMonthlyStore();

  const hint =
    subTab === 'series'
      ? `지역 다중 선택 (최대 5개${seriesPaths.length ? ` · ${seriesPaths.length}개 선택` : ''})`
      : subTab === 'period'
      ? '비교할 단일 지역 선택'
      : '하위 지역을 비교할 상위 지역 선택';

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-800 tracking-wide mb-1">지역 선택</h2>
        <p className="text-[11px] text-gray-400">{hint}</p>
      </div>

      {treeLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">지역 목록 로딩 중...</div>
      ) : treeError ? (
        <div className="flex-1 flex items-center justify-center text-sm text-red-500 px-4 text-center">{treeError}</div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {regionTree.map(node => (
            <TreeRow key={node.regionPath} node={node} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
};
