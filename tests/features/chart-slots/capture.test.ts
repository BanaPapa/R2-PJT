import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../../src/shared/lib/store';
import { useMonthlyStore } from '../../../src/shared/lib/monthly-store';
import { capture, apply } from '../../../src/features/chart-slots/lib/capture';
import { DEFAULT_CHART_OPTIONS } from '../../../src/shared/config';

beforeEach(() => {
  // 데이터 로더는 네트워크/JSON 접근 → no-op으로 대체.
  useAppStore.setState({
    selectedRegions: ['서울특별시', '전국'],
    regionLabels: { 서울특별시: '서울특별시', 전국: '전국' },
    fromDate: '2023-01-01', toDate: '2026-01-12', baseDate: '2026-01-12',
    loadWeeklyData: async () => {}, loadTradeData: async () => {},
  });
  useMonthlyStore.setState({
    mode: 'weekly', weeklyTab: 'price',
    tradeMaOn: true, tradeMaWindow: 13, baseLineOn: true,
    yRanges: { 'wp:saleIndex': { min: 90, max: 110 }, 'mp:saleAptIndex': { min: 80, max: 120 } },
    tradeYRanges: { buyerAdvantage: { min: 0, max: 200 } },
    chartOptions: { 'wp:saleIndex': { ...DEFAULT_CHART_OPTIONS, type: 'bar' } },
    skipYRangeClear: new Set<string>(),
    selectedRegions: ['경기도'], regionLabels: { 경기도: '경기도' },
    fromDate: '2015-01', toDate: '2026-01', baseDate: '2026-01',
    loadPriceData: async () => {}, loadTradeData: async () => {},
    loadTradeRegions: async () => {}, loadMarketData: async () => {}, loadDates: async () => {},
  });
});

describe('capture(weekly)', () => {
  it('주간 선택은 useAppStore에서, wp:/wt: prefix만 담는다', () => {
    const snap = capture('weekly');
    expect(snap.mode).toBe('weekly');
    expect(snap.selectedRegions).toEqual(['서울특별시', '전국']);
    expect(snap.fromDate).toBe('2023-01-01');
    expect(snap.yRanges).toEqual({ 'wp:saleIndex': { min: 90, max: 110 } });
    expect(snap.chartOptions['wp:saleIndex']?.type).toBe('bar');
    expect(snap.tradeYRanges).toEqual({ buyerAdvantage: { min: 0, max: 200 } });
  });
});

describe('capture(monthly)', () => {
  it('월간 선택은 useMonthlyStore에서, mp:/mt:/mk: prefix만 담는다', () => {
    const snap = capture('monthly');
    expect(snap.selectedRegions).toEqual(['경기도']);
    expect(snap.fromDate).toBe('2015-01');
    expect(snap.yRanges).toEqual({ 'mp:saleAptIndex': { min: 80, max: 120 } });
  });
});

describe('apply(weekly snapshot)', () => {
  it('주간 선택/옵션을 복원하고 wp: 가드를 설정한다', () => {
    const snap = capture('weekly');
    // 상태를 흐트러뜨린 뒤 복원
    useAppStore.setState({ selectedRegions: [], regionLabels: {} });
    useMonthlyStore.setState({ yRanges: {}, chartOptions: {}, mode: 'monthly' });

    apply(snap);

    expect(useAppStore.getState().selectedRegions).toEqual(['서울특별시', '전국']);
    expect(useMonthlyStore.getState().mode).toBe('weekly');
    expect(useMonthlyStore.getState().yRanges['wp:saleIndex']).toEqual({ min: 90, max: 110 });
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('wp:')).toBe(true);
  });

  it('다른 모드(mp:) override는 병합 보존한다', () => {
    const snap = capture('weekly');
    useMonthlyStore.setState({ yRanges: { 'mp:saleAptIndex': { min: 1, max: 2 } } });
    apply(snap);
    expect(useMonthlyStore.getState().yRanges['mp:saleAptIndex']).toEqual({ min: 1, max: 2 });
    expect(useMonthlyStore.getState().yRanges['wp:saleIndex']).toEqual({ min: 90, max: 110 });
  });
});
