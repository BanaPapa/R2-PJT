import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeOne } from '../../vite-plugins/credentials-store';
import { listProviderModels } from '../../vite-plugins/provider-bridge';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'pb-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('listProviderModels', () => {
  it('자격증명이 없으면 에러', async () => {
    await expect(listProviderModels(root, 'openai', false)).rejects.toThrow(/연결/);
  });

  it('알 수 없는 프로바이더면 에러', async () => {
    await expect(listProviderModels(root, 'nope', false)).rejects.toThrow(/알 수 없는/);
  });

  it('연결돼 있으면 어댑터로 모델을 조회한다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'k' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [{ id: 'gpt-4o' }] }), text: () => Promise.resolve('') } as Response);
    const models = await listProviderModels(root, 'openai', true);
    expect(models[0]?.id).toBe('gpt-4o');
  });

  it('publicModelList 프로바이더는 키 없이도 익명으로 목록을 조회한다', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ id: 'deepseek/deepseek-r1:free' }] }),
      text: () => Promise.resolve(''),
    } as Response);
    const models = await listProviderModels(root, 'openrouter', false);
    expect(models[0]?.id).toBe('deepseek/deepseek-r1:free');
    // 자격증명이 없으므로 Authorization 헤더 없이 호출돼야 한다.
    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});
