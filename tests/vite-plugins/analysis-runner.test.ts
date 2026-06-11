import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeOne } from '../../vite-plugins/credentials-store';
import { buildMessages, runProviderAnalysis } from '../../vite-plugins/analysis-runner';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'run-'));
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(path.join(root, 'docs/analysis-prompt.md'), '시스템 프롬프트', 'utf8');
  await fs.mkdir(path.join(root, '.analysis/responses'), { recursive: true });
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); vi.restoreAllMocks(); });

const req = {
  generatedAt: '2026-06-11T00:00:00Z',
  scope: { mode: 'weekly' as const, regions: ['서울특별시'], regionLabels: { 서울특별시: '서울' }, period: { from: '2023-01-01', to: '2026-01-01' }, tabs: ['weekly-price' as const] },
  datasets: [],
  provider: 'openai',
  model: 'gpt-4o',
};

describe('analysis-runner', () => {
  it('buildMessages는 system=프롬프트, user=직렬화 payload', async () => {
    const { system, user } = await buildMessages(root, req);
    expect(system).toContain('시스템 프롬프트');
    expect(user).toContain('서울특별시');
  });

  it('성공 시 응답 .md를 쓴다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'k' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve({ choices: [{ message: { content: '# 분석결과' } }] }), text: () => Promise.resolve('') } as Response);
    await runProviderAnalysis(root, 'id1', req);
    const md = await fs.readFile(path.join(root, '.analysis/responses/id1.md'), 'utf8');
    expect(md).toBe('# 분석결과');
  });

  it('실패 시 .error.txt를 쓴다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'k' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('unauthorized') } as Response);
    await runProviderAnalysis(root, 'id2', req);
    const err = await fs.readFile(path.join(root, '.analysis/responses/id2.error.txt'), 'utf8');
    expect(err).toContain('401');
  });
});
