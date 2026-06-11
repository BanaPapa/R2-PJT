// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readOne, writeOne, removeOne, toStatuses } from '../../vite-plugins/credentials-store';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'cred-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('credentials-store', () => {
  it('writeOne 후 readOne으로 되읽는다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'sk-1' });
    expect((await readOne(root, 'openai'))?.apiKey).toBe('sk-1');
  });

  it('writeOne은 다른 프로바이더를 보존(병합)한다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'a' });
    await writeOne(root, 'xai', { method: 'subscription', token: 'b' });
    expect((await readOne(root, 'openai'))?.apiKey).toBe('a');
    expect((await readOne(root, 'xai'))?.token).toBe('b');
  });

  it('removeOne은 해당 항목만 지운다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'a' });
    await removeOne(root, 'openai');
    expect(await readOne(root, 'openai')).toBeNull();
  });

  it('toStatuses는 비밀을 노출하지 않고 connected/method만 낸다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'sk-secret' });
    const statuses = await toStatuses(root);
    const openai = statuses.find(s => s.id === 'openai');
    expect(openai).toEqual({ id: 'openai', connected: true, method: 'apiKey' });
    expect(JSON.stringify(statuses)).not.toContain('sk-secret');
  });

  it('claude-bridge는 항상 connected로 표기된다', async () => {
    const statuses = await toStatuses(root);
    expect(statuses.find(s => s.id === 'claude-bridge')).toEqual({ id: 'claude-bridge', connected: true });
  });
});
