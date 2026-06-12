import { describe, it, expect, vi, beforeEach } from 'vitest';

// 데이터 소스(정적 JSON 로더)를 목으로 대체 — 빈 데이터 반환.
// vi.mock은 호이스팅되므로 vi.hoisted로 목 함수를 먼저 만든다.
const { getWeeklyData, getTradeDataWeekly, getPriceData, getTradeDataMonthly, getMarketData, getForecastData } =
  vi.hoisted(() => ({
    getWeeklyData: vi.fn(async () => []),
    getTradeDataWeekly: vi.fn(async () => []),
    getPriceData: vi.fn(async () => []),
    getTradeDataMonthly: vi.fn(async () => []),
    getMarketData: vi.fn(async () => []),
    getForecastData: vi.fn(async () => []),
  }));

vi.mock('../../../src/entities/kb-data/api/weekly-local', () => ({
  weeklyLocal: { getWeeklyData },
}));
vi.mock('../../../src/entities/kb-data/api/weekly-trade-local', () => ({
  weeklyTradeLocal: { getTradeData: getTradeDataWeekly },
}));
vi.mock('../../../src/entities/monthly-data', () => ({
  monthlyLocal: { getPriceData, getMarketData },
  monthlyTradeLocal: { getTradeData: getTradeDataMonthly },
  monthlyForecastLocal: { getForecastData },
}));

import { collectFor } from '../../../src/features/analysis/lib/collect';

const baseParams = {
  regions: ['서울특별시'],
  regionLabels: { 서울특별시: '서울특별시' },
  weeklyPeriod: { from: '2023-01-01', to: '2026-01-01' },
  monthlyPeriod: { from: '2015-01', to: '2026-01' },
  weeklyBaseDate: '2026-01-01',
  monthlyBaseDate: '2026-01',
};

beforeEach(() => vi.clearAllMocks());

describe('collectFor', () => {
  it('선택한 탭의 데이터 소스만 로드한다', async () => {
    await collectFor({ ...baseParams, tabs: ['weekly-price'] });
    expect(getWeeklyData).toHaveBeenCalledWith(['서울특별시'], '', '');
    expect(getTradeDataWeekly).not.toHaveBeenCalled();
    expect(getPriceData).not.toHaveBeenCalled();
    expect(getMarketData).not.toHaveBeenCalled();
  });

  it('monthly-market은 시장 + 전망 데이터를 함께 로드한다', async () => {
    await collectFor({ ...baseParams, tabs: ['monthly-market'] });
    expect(getMarketData).toHaveBeenCalledWith(['서울특별시']);
    expect(getForecastData).toHaveBeenCalledWith(['서울특별시']);
  });

  it('지역이 없으면 어떤 로더도 호출하지 않고 빈 결과를 낸다', async () => {
    const res = await collectFor({ ...baseParams, regions: [], tabs: ['weekly-price', 'monthly-market'] });
    expect(getWeeklyData).not.toHaveBeenCalled();
    expect(res.datasets).toEqual([]);
    expect(res.scope.regions).toEqual([]);
  });

  it('데이터가 비면 datasets·scope.regions가 비어있다', async () => {
    const res = await collectFor({ ...baseParams, tabs: ['weekly-price'] });
    expect(res.datasets).toEqual([]);
    expect(res.scope.regions).toEqual([]);
    expect(res.scope.mode).toBe('weekly');
  });
});
