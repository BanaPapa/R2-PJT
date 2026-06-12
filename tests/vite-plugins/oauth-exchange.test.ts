// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exchangeOAuthCode, completeLoopbackLogin } from '../../vite-plugins/provider-bridge';
import { putSession } from '../../vite-plugins/oauth';
import { readOne } from '../../vite-plugins/credentials-store';

function fakeJwt(payload: unknown): string {
  return `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
}

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'oauthx-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch;
}

describe('exchangeOAuthCode (provider-bridge)', () => {
  it('유효한 state+code를 교환해 subscription 토큰을 저장한다', async () => {
    putSession('state-1', { providerId: 'xai', verifier: 'ver-1', createdAt: Date.now() });
    await exchangeOAuthCode(root, 'xai', 'state-1', 'code-1', fakeFetch({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }));

    const cred = await readOne(root, 'xai');
    expect(cred?.method).toBe('subscription');
    expect(cred?.accessToken).toBe('AT');
    expect(cred?.refreshToken).toBe('RT');
  });

  it('알 수 없는 state면 에러를 던지고 자격증명을 쓰지 않는다', async () => {
    await expect(
      exchangeOAuthCode(root, 'xai', 'nope', 'code', fakeFetch({ access_token: 'AT' })),
    ).rejects.toThrow();
    expect(await readOne(root, 'xai')).toBeNull();
  });

  it('oauth-code 미지원 프로바이더면 에러', async () => {
    putSession('state-2', { providerId: 'openai', verifier: 'v', createdAt: Date.now() });
    await expect(
      exchangeOAuthCode(root, 'openai', 'state-2', 'code', fakeFetch({ access_token: 'AT' })),
    ).rejects.toThrow();
  });
});

describe('completeLoopbackLogin (provider-bridge)', () => {
  it('코드를 교환하고 id_token에서 account_id를 추출해 저장한다', async () => {
    putSession('lb-1', { providerId: 'openai', verifier: 'ver', createdAt: Date.now() });
    const idToken = fakeJwt({ 'https://api.openai.com/auth': { chatgpt_account_id: 'acct-9' } });
    await completeLoopbackLogin(
      root,
      'openai',
      'lb-1',
      'code-1',
      fakeFetch({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, id_token: idToken }),
    );
    const cred = await readOne(root, 'openai');
    expect(cred?.method).toBe('subscription');
    expect(cred?.accessToken).toBe('AT');
    expect(cred?.accountId).toBe('acct-9');
  });

  it('알 수 없는 state면 에러', async () => {
    await expect(
      completeLoopbackLogin(root, 'openai', 'nope', 'code', fakeFetch({ access_token: 'AT' })),
    ).rejects.toThrow();
  });
});
