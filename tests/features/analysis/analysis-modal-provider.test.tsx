import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const runAnalysisMock = vi.hoisted(() => vi.fn(async () => ({ id: 'x', status: 'done', result: '# ok' })));
vi.mock('../../../src/entities/analysis', async (orig) => {
  const actual = await orig<typeof import('../../../src/entities/analysis')>();
  return { ...actual, runAnalysis: runAnalysisMock };
});
vi.mock('../../../src/features/analysis/lib/collect', () => ({
  collectCurrentView: () => ({ generatedAt: 't', scope: { mode: 'weekly', regions: ['서울특별시'], regionLabels: { 서울특별시: '서울' }, period: { from: 'a', to: 'b' }, tabs: ['weekly-price'] }, datasets: [{ tab: 'weekly-price', metric: 'm', label: 'l', unit: '', byRegion: { 서울특별시: {} } }] }),
  collectFor: vi.fn(), selectedRegionUnion: () => [{ region: '서울특별시', label: '서울' }], collectTabs: vi.fn(), ALL_TABS: [],
}));

import { AnalysisModal } from '../../../src/features/analysis/ui/AnalysisModal';
import { useProviderStore } from '../../../src/entities/provider';
import { useMonthlyStore } from '../../../src/shared/lib/monthly-store';
import { useAppStore } from '../../../src/shared/lib/store';

beforeEach(() => {
  runAnalysisMock.mockClear();
  useProviderStore.setState({ selectedProviderId: 'openai', selectedModelId: 'gpt-4o', statuses: { openai: { connected: true, method: 'apiKey' } }, models: { openai: [{ id: 'gpt-4o' }] }, loadingModels: {} });
  useMonthlyStore.setState({ mode: 'weekly', weeklyTab: 'price' } as never);
  useAppStore.setState({ selectedRegions: ['서울특별시'], regionLabels: { 서울특별시: '서울' }, fromDate: 'a', toDate: 'b' } as never);
  // 모달 오픈 시 monthly 거래지역 로드(실제 fetch)를 막아 jsdom unhandled rejection 방지
  vi.spyOn(useMonthlyStore.getState(), 'loadTradeRegions').mockResolvedValue(undefined as never);
  // 셀렉터가 마운트 시 모델 새로고침(실제 fetch)하지 않도록
  vi.spyOn(useProviderStore.getState(), 'refreshModels').mockResolvedValue();
});

describe('AnalysisModal × provider', () => {
  it('분석 실행 시 payload에 provider/model을 포함한다', async () => {
    render(<AnalysisModal open onClose={() => {}} />);
    fireEvent.click(screen.getByText('분석하기'));
    await waitFor(() => expect(runAnalysisMock).toHaveBeenCalled());
    const payload = runAnalysisMock.mock.calls[0]![0] as { provider?: string; model?: string };
    expect(payload.provider).toBe('openai');
    expect(payload.model).toBe('gpt-4o');
  });
});
