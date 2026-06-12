import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({
  fetchProviders: vi.fn(async () => [{ id: 'openai', connected: true, method: 'apiKey' as const }]),
  fetchModels: vi.fn(async () => [{ id: 'gpt-4o' }]),
}));
vi.mock('../../../src/entities/provider/api/provider.api', () => apiMock);

import { useProviderStore } from '../../../src/entities/provider/model/provider.store';

beforeEach(() => {
  useProviderStore.setState({ selectedProviderId: 'claude-bridge', selectedModelId: null, statuses: {}, models: {}, loadingModels: {}, modelErrors: {} });
  vi.clearAllMocks();
});

describe('useProviderStore', () => {
  it('refreshProviders는 statuses를 id맵으로 채운다', async () => {
    await useProviderStore.getState().refreshProviders();
    expect(useProviderStore.getState().statuses.openai?.connected).toBe(true);
  });

  it('refreshModels는 캐시가 있으면 force 없이는 재조회하지 않는다', async () => {
    useProviderStore.setState({ models: { openai: [{ id: 'cached' }] } });
    await useProviderStore.getState().refreshModels('openai');
    expect(apiMock.fetchModels).not.toHaveBeenCalled();
    await useProviderStore.getState().refreshModels('openai', true);
    expect(apiMock.fetchModels).toHaveBeenCalledWith('openai', true);
  });

  it('select는 프로바이더·모델을 갱신한다', () => {
    useProviderStore.getState().select('openai', 'gpt-4o');
    expect(useProviderStore.getState().selectedProviderId).toBe('openai');
    expect(useProviderStore.getState().selectedModelId).toBe('gpt-4o');
  });

  it('refreshModels 실패 시 에러를 저장하고 로딩을 끈다(삼키지 않음)', async () => {
    apiMock.fetchModels.mockRejectedValueOnce(new Error('프로바이더 요청 실패 (500) 403 credits'));
    await useProviderStore.getState().refreshModels('xai', true);
    expect(useProviderStore.getState().modelErrors.xai).toContain('403');
    expect(useProviderStore.getState().loadingModels.xai).toBe(false);
  });

  it('refreshModels 성공 시 이전 에러를 지운다', async () => {
    useProviderStore.setState({ modelErrors: { xai: '이전 에러' } });
    await useProviderStore.getState().refreshModels('xai', true);
    expect(useProviderStore.getState().modelErrors.xai ?? null).toBeNull();
  });
});
