import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as api from '../../../src/entities/provider/api/provider.api';

const okJson = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') } as Response);

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('provider.api', () => {
  it('fetchProviders는 상태 배열을 반환한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(okJson([{ id: 'openai', connected: true, method: 'apiKey' }]));
    const res = await api.fetchProviders();
    expect(res[0]?.id).toBe('openai');
  });

  it('fetchModels는 refresh 플래그를 쿼리로 보낸다', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(okJson([{ id: 'gpt-4o' }]));
    await api.fetchModels('openai', true);
    expect(spy).toHaveBeenCalledWith('/api/providers/openai/models?refresh=1', expect.anything());
  });

  it('saveApiKey는 method=apiKey 바디로 POST 한다', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(okJson({ ok: true }));
    await api.saveApiKey('openai', 'sk-x');
    const [, init] = spy.mock.calls[0]!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ method: 'apiKey', apiKey: 'sk-x' });
  });

  it('실패 응답이면 throw 한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('boom') } as Response);
    await expect(api.fetchProviders()).rejects.toThrow();
  });
});
