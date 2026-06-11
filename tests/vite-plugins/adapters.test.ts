import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdapter } from '../../vite-plugins/adapters';
import type { ProviderDef } from '../../src/entities/provider/model/provider.types';

const openaiDef: ProviderDef = { id: 'openai', label: 'OpenAI', apiShape: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', auth: ['apiKey'] };
const anthropicDef: ProviderDef = { id: 'anthropic', label: 'Anthropic', apiShape: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', auth: ['apiKey'] };
const geminiDef: ProviderDef = { id: 'google', label: 'Gemini', apiShape: 'gemini', baseUrl: 'https://gen.googleapis.com/v1beta', auth: ['apiKey'] };

const mockFetch = (body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') } as Response);

beforeEach(() => vi.restoreAllMocks());

describe('adapters.listModels', () => {
  it('openai-compatible: data[].id 파싱', async () => {
    mockFetch({ data: [{ id: 'gpt-4o' }, { id: 'o1' }] });
    const models = await getAdapter('openai-compatible').listModels(openaiDef, { method: 'apiKey', apiKey: 'k' });
    expect(models.map(m => m.id)).toEqual(['gpt-4o', 'o1']);
  });

  it('gemini: models[].name에서 prefix 제거', async () => {
    mockFetch({ models: [{ name: 'models/gemini-1.5-pro' }] });
    const models = await getAdapter('gemini').listModels(geminiDef, { method: 'apiKey', apiKey: 'k' });
    expect(models[0]?.id).toBe('gemini-1.5-pro');
  });
});

describe('adapters.chat', () => {
  it('openai-compatible: choices[0].message.content 반환', async () => {
    const spy = mockFetch({ choices: [{ message: { content: '# 결과' } }] });
    const out = await getAdapter('openai-compatible').chat(openaiDef, { method: 'apiKey', apiKey: 'k' }, { system: 'S', user: 'U', model: 'gpt-4o' });
    expect(out).toBe('# 결과');
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer k' });
  });

  it('anthropic: content[0].text 반환 + system 분리', async () => {
    const spy = mockFetch({ content: [{ type: 'text', text: '안녕' }] });
    const out = await getAdapter('anthropic').chat(anthropicDef, { method: 'apiKey', apiKey: 'k' }, { system: 'S', user: 'U', model: 'claude-x' });
    expect(out).toBe('안녕');
    const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.system).toBe('S');
    expect(body.messages).toEqual([{ role: 'user', content: 'U' }]);
  });

  it('gemini: candidates[0].content.parts[0].text 반환', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: '지' }] } }] });
    const out = await getAdapter('gemini').chat(geminiDef, { method: 'apiKey', apiKey: 'k' }, { system: 'S', user: 'U', model: 'gemini-1.5-pro' });
    expect(out).toBe('지');
  });
});
