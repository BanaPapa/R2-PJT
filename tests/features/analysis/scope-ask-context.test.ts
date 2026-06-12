import { describe, expect, it } from 'vitest';
import { scopeAskContext } from '../../../src/features/analysis/ui/AnalysisModal';
import type { AnalysisScope, AnalysisDataset } from '../../../src/entities/analysis';

const scope: AnalysisScope = {
  mode: 'weekly',
  regions: ['gangnam', 'seocho'],
  regionLabels: { gangnam: '강남구', seocho: '서초구' },
  period: { from: 'a', to: 'b' },
  tabs: ['weekly-price'],
};

const summary = { latest: 1, start: 1, changeAbs: 0, changePct: 0, min: 1, max: 1, mean: 1, direction: 'flat' as const };
const datasets: AnalysisDataset[] = [
  {
    tab: 'weekly-price', metric: 'saleIndex', label: '매매지수', unit: '',
    byRegion: {
      gangnam: { summary, series: [{ date: 'a', value: 1 }], sampled: false },
      seocho: { summary, series: [{ date: 'a', value: 2 }], sampled: false },
    },
  },
];

describe('scopeAskContext', () => {
  it('지역 탭이면 해당 지역만 남긴다', () => {
    const ctx = scopeAskContext({ label: '강남구', body: '## 강남 결론' }, '전체', scope, datasets);
    expect(ctx.markdown).toBe('## 강남 결론');
    expect(ctx.scope.regions).toEqual(['gangnam']);
    expect(Object.keys(ctx.datasets[0]!.byRegion)).toEqual(['gangnam']);
  });

  it('종합 탭이면 전체 데이터를 유지한다', () => {
    const ctx = scopeAskContext({ label: '종합', body: '## 종합 결론' }, '전체', scope, datasets);
    expect(ctx.scope.regions).toEqual(['gangnam', 'seocho']);
    expect(Object.keys(ctx.datasets[0]!.byRegion)).toEqual(['gangnam', 'seocho']);
  });

  it('활성 탭이 없으면 전체 결과·데이터를 쓴다', () => {
    const ctx = scopeAskContext(null, '전체결과', scope, datasets);
    expect(ctx.markdown).toBe('전체결과');
    expect(ctx.scope.regions).toHaveLength(2);
  });
});
