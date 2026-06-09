import React, { useMemo, useState } from 'react';
import { useMonthlyStore } from '../../shared/lib/monthly-store';
import { CHART_COLORS } from '../../shared/config';
import type { RegionNode } from '../../entities/monthly-data';

const LEVEL_LABELS = ['대지역 (전국·시도·권역)', '중지역 (시·군·구)', '소지역 (구)'];
const DEPTH = LEVEL_LABELS.length;

// regionPath → 표시 이름 인덱스 (칩/선택 표시용)
function buildNameIndex(roots: RegionNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (node: RegionNode) => {
    map.set(node.regionPath, node.region);
    node.children.forEach(walk);
  };
  roots.forEach(walk);
  return map;
}

export const MonthlyRegionCascade: React.FC = () => {
  const {
    subTab,
    regionTree,
    treeLoading,
    treeError,
    seriesPaths,
    periodPath,
    comparePath,
    toggleSeriesPath,
    selectPeriodPath,
    selectComparePath,
  } = useMonthlyStore();

  // 각 단에서 선택된 노드 (길이 DEPTH)
  const [picks, setPicks] = useState<(RegionNode | null)[]>(() => Array(DEPTH).fill(null));

  const nameIndex = useMemo(() => buildNameIndex(regionTree), [regionTree]);

  // 1단 옵션 = 전국 + 전국의 직계 자식(시도·권역). 전국 자체도 선택 가능.
  const root = regionTree[0] ?? null;
  const level1 = useMemo<RegionNode[]>(
    () => (root ? [root, ...root.children] : []),
    [root],
  );

  const optionsAt = (depth: number): RegionNode[] => {
    if (depth === 0) return level1;
    const parent = picks[depth - 1];
    if (!parent) return [];
    // 전국(root)을 1단에서 고르면 그 자식은 이미 1단 형제로 노출되므로 더 내려가지 않는다.
    if (depth === 1 && parent === root) return [];
    return parent.children;
  };

  const handlePick = (depth: number, regionPath: string) => {
    const node = optionsAt(depth).find(n => n.regionPath === regionPath) ?? null;
    setPicks(prev => prev.map((p, i) => (i < depth ? p : i === depth ? node : null)));
  };

  // 가장 깊이 선택된 노드 = 실제 대상
  const deepest = [...picks].reverse().find(Boolean) ?? null;

  const handleAdd = () => {
    if (!deepest) return;
    if (subTab === 'series') toggleSeriesPath(deepest.regionPath);
    else if (subTab === 'period') selectPeriodPath(deepest.regionPath);
    else selectComparePath(deepest.regionPath);
  };

  const addLabel = subTab === 'series' ? '비교함에 담기' : '이 지역 선택';
  const hint =
    subTab === 'series'
      ? `지역 다중 선택 (최대 5개${seriesPaths.length ? ` · ${seriesPaths.length}개 선택` : ''})`
      : subTab === 'period'
      ? '비교할 단일 지역 선택'
      : '하위 지역을 비교할 상위 지역 선택';

  const alreadyInSeries = !!deepest && seriesPaths.includes(deepest.regionPath);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-800 tracking-wide mb-1">지역 선택</h2>
        <p className="text-[11px] text-gray-400">{hint}</p>
      </div>

      {treeLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          지역 목록 로딩 중...
        </div>
      ) : treeError ? (
        <div className="flex-1 flex items-center justify-center text-sm text-red-500 px-4 text-center">
          {treeError}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* 3단 캐스케이딩 드롭다운 */}
          {Array.from({ length: DEPTH }, (_, depth) => {
            const options = optionsAt(depth);
            const disabled = depth > 0 && !picks[depth - 1];
            return (
              <div key={depth}>
                <label className="block text-xs text-gray-400 mb-1">{LEVEL_LABELS[depth]}</label>
                <select
                  value={picks[depth]?.regionPath ?? ''}
                  disabled={disabled || options.length === 0}
                  onChange={e => handlePick(depth, e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-300"
                >
                  <option value="">
                    {disabled
                      ? '상위 지역을 먼저 선택'
                      : options.length === 0
                      ? '하위 지역 없음'
                      : '선택'}
                  </option>
                  {options.map(opt => (
                    <option key={opt.regionPath} value={opt.regionPath}>
                      {opt.region}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}

          <button
            onClick={handleAdd}
            disabled={!deepest || (subTab === 'series' && alreadyInSeries)}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white disabled:text-gray-400 text-sm font-semibold rounded-lg transition-colors"
          >
            {deepest
              ? subTab === 'series' && alreadyInSeries
                ? '이미 담긴 지역'
                : `${addLabel}: ${deepest.region}`
              : addLabel}
          </button>

          {/* 선택 상태 표시 */}
          {subTab === 'series' && seriesPaths.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {seriesPaths.map((path, idx) => (
                <span
                  key={path}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                >
                  {nameIndex.get(path) ?? path}
                  <button
                    onClick={() => toggleSeriesPath(path)}
                    className="hover:opacity-75 leading-none ml-0.5"
                    aria-label={`${nameIndex.get(path) ?? path} 제거`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {subTab === 'period' && periodPath && (
            <p className="text-xs text-gray-500 pt-1">
              선택됨: <span className="font-semibold text-gray-700">{nameIndex.get(periodPath) ?? periodPath}</span>
            </p>
          )}

          {subTab === 'region' && comparePath && (
            <p className="text-xs text-gray-500 pt-1">
              기준 지역: <span className="font-semibold text-gray-700">{nameIndex.get(comparePath) ?? comparePath}</span>
              <span className="text-gray-400"> (하위 지역 비교)</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
