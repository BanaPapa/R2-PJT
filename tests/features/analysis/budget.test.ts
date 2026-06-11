import { describe, it, expect } from 'vitest';
import { fitPayloadBudget, toRegionSeries } from '../../../src/features/analysis/lib/summarize';
import type { AnalysisDataset, SeriesPoint } from '../../../src/entities/analysis';

function longSeries(n: number): SeriesPoint[] {
  return Array.from({ length: n }, (_, i) => ({ date: `2020-01-${String((i % 28) + 1).padStart(2, '0')}`, value: i + 0.123 }));
}

function datasetWithRegions(count: number): AnalysisDataset {
  const byRegion: AnalysisDataset['byRegion'] = {};
  for (let i = 0; i < count; i++) byRegion[`r${i}`] = toRegionSeries(longSeries(200));
  return { tab: 'weekly-price', metric: 'saleIndex', label: 'x', unit: '', byRegion };
}

describe('fitPayloadBudget', () => {
  const totalPoints = (ds: AnalysisDataset[]) =>
    ds.reduce((n, d) => n + Object.values(d.byRegion).reduce((m, rs) => m + rs.series.length, 0), 0);

  it('budget/시계열수 ≥ 하한이면 전체 포인트가 budget 이하', () => {
    const fitted = fitPayloadBudget([datasetWithRegions(100)], 4000); // perSeries=40 → 4000
    expect(totalPoints(fitted)).toBeLessThanOrEqual(4000);
  });

  it('시계열이 매우 많으면 시계열당 하한(12)이 적용된다', () => {
    const fitted = fitPayloadBudget([datasetWithRegions(100)], 1000); // floor(10) < 12 → 12
    expect(totalPoints(fitted)).toBe(100 * 12);
  });

  it('summary는 전체 데이터 기준으로 보존된다', () => {
    const before = datasetWithRegions(1).byRegion.r0!.summary;
    const fitted = fitPayloadBudget([datasetWithRegions(1)], 1000);
    expect(fitted[0]!.byRegion.r0!.summary).toEqual(before);
  });

  it('값은 소수 2자리로 반올림된다', () => {
    const fitted = fitPayloadBudget([datasetWithRegions(1)], 1000);
    const v = fitted[0]!.byRegion.r0!.series[0]!.value;
    expect(v).toBe(0.12);
  });

  it('시계열이 적으면 원본 길이까지만(과샘플링 없음)', () => {
    const ds: AnalysisDataset = { tab: 'weekly-price', metric: 'm', label: 'x', unit: '', byRegion: { r0: toRegionSeries(longSeries(20)) } };
    const fitted = fitPayloadBudget([ds], 4000);
    expect(fitted[0]!.byRegion.r0!.series.length).toBe(20);
  });
});
