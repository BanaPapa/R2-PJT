import { describe, it, expect } from 'vitest';
import { summarizeRegions, generateSlotName } from '../../../src/features/chart-slots/lib/name';
import type { ChartSetSnapshot } from '../../../src/features/chart-slots/model/types';

const base: Omit<ChartSetSnapshot, 'selectedRegions' | 'regionLabels' | 'fromDate' | 'toDate'> = {
  id: 'x', name: '', mode: 'weekly', createdAt: 0, schemaVersion: 1,
  baseDate: '', weeklyTab: 'price', tradeMaOn: true, tradeMaWindow: 13,
  baseLineOn: true, yRanges: {}, tradeYRanges: {}, chartOptions: {},
};

describe('summarizeRegions', () => {
  it('단일 지역은 라벨만', () => {
    expect(summarizeRegions(['서울특별시'], { 서울특별시: '서울특별시' })).toBe('서울특별시');
  });
  it('여러 지역은 "대표 외 N"', () => {
    expect(
      summarizeRegions(['서울특별시', '전국', '경기도'], {
        서울특별시: '서울특별시', 전국: '전국', 경기도: '경기도',
      }),
    ).toBe('서울특별시 외 2');
  });
  it('빈 선택은 "(빈 선택)"', () => {
    expect(summarizeRegions([], {})).toBe('(빈 선택)');
  });
});

describe('generateSlotName', () => {
  it('지역 요약 + 연도 구간', () => {
    const snap: ChartSetSnapshot = {
      ...base,
      selectedRegions: ['서울특별시', '전국'],
      regionLabels: { 서울특별시: '서울특별시', 전국: '전국' },
      fromDate: '2023-01-01', toDate: '2026-01-12',
    };
    expect(generateSlotName(snap)).toBe('서울특별시 외 1 · 2023–2026');
  });
});
