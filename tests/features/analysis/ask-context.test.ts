import { describe, expect, it } from 'vitest';
import { toAskContext } from '../../../src/features/analysis/lib/summarize';
import type { AnalysisDataset } from '../../../src/entities/analysis';

function bigDataset(): AnalysisDataset {
  const series = Array.from({ length: 100 }, (_, i) => ({ date: `2026-01-${i + 1}`, value: i }));
  return {
    tab: 'weekly-price',
    metric: 'saleIndex',
    label: '매매지수',
    unit: '',
    byRegion: {
      서울: {
        summary: { latest: 99, start: 0, changeAbs: 99, changePct: null, min: 0, max: 99, mean: 49.5, direction: 'up' },
        series,
        sampled: false,
      },
    },
  };
}

describe('toAskContext', () => {
  it('시리즈를 40포인트 이하로 줄이고 요약은 보존한다', () => {
    const [d] = toAskContext([bigDataset()], 40);
    const rs = d!.byRegion['서울']!;
    expect(rs.series.length).toBeLessThanOrEqual(40);
    expect(rs.summary.latest).toBe(99);
    expect(rs.sampled).toBe(true);
  });

  it('이미 짧은 시리즈는 그대로 둔다', () => {
    const small: AnalysisDataset = { ...bigDataset(), byRegion: { 서울: { summary: bigDataset().byRegion['서울']!.summary, series: [{ date: '2026-01-01', value: 1 }], sampled: false } } };
    const [d] = toAskContext([small], 40);
    expect(d!.byRegion['서울']!.series.length).toBe(1);
  });
});
