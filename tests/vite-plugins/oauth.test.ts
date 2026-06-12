import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  createVerifier,
  challengeFor,
  createState,
  createNonce,
  base64url,
  buildAuthorizeUrl,
  exchangeAuthCode,
  extractChatGptAccountId,
} from '../../vite-plugins/oauth';

function fakeJwt(payload: unknown): string {
  return `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
}

describe('extractChatGptAccountId', () => {
  it("id_token의 'https://api.openai.com/auth'.chatgpt_account_id를 추출한다", () => {
    const jwt = fakeJwt({ 'https://api.openai.com/auth': { chatgpt_account_id: 'acc-123' } });
    expect(extractChatGptAccountId(jwt)).toBe('acc-123');
  });

  it('클레임이 없거나 토큰이 비면 undefined', () => {
    expect(extractChatGptAccountId(undefined)).toBeUndefined();
    expect(extractChatGptAccountId(fakeJwt({ foo: 1 }))).toBeUndefined();
    expect(extractChatGptAccountId('not-a-jwt')).toBeUndefined();
  });
});

describe('oauth PKCE', () => {
  it('verifier는 43~128자 url-safe 문자열', () => {
    const v = createVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(v.length).toBeGreaterThanOrEqual(43);
  });

  it('challengeFor는 verifier의 S256 base64url 해시', () => {
    const v = 'test-verifier';
    const expected = base64url(crypto.createHash('sha256').update(v).digest());
    expect(challengeFor(v)).toBe(expected);
  });

  it('createState는 매번 다른 값', () => {
    expect(createState()).not.toBe(createState());
  });

  it('createNonce는 매번 다른 url-safe 값', () => {
    const n = createNonce();
    expect(n).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(createNonce()).not.toBe(createNonce());
  });
});

describe('buildAuthorizeUrl', () => {
  const cfg = {
    authorizeUrl: 'https://auth.x.ai/oauth2/authorize',
    clientId: 'client-123',
    scopes: ['openid', 'api:access'],
    redirectUri: 'http://127.0.0.1:56121/callback',
    extraAuthParams: { referrer: 'hermes-agent', plan: 'generic' },
  };

  it('PKCE·고정 파라미터를 포함한 authorize URL을 만든다', () => {
    const url = new URL(buildAuthorizeUrl(cfg, { state: 'st', challenge: 'ch', nonce: 'no' }));
    expect(url.origin + url.pathname).toBe('https://auth.x.ai/oauth2/authorize');
    const q = url.searchParams;
    expect(q.get('response_type')).toBe('code');
    expect(q.get('client_id')).toBe('client-123');
    expect(q.get('redirect_uri')).toBe('http://127.0.0.1:56121/callback');
    expect(q.get('scope')).toBe('openid api:access');
    expect(q.get('state')).toBe('st');
    expect(q.get('code_challenge')).toBe('ch');
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('nonce')).toBe('no');
    expect(q.get('referrer')).toBe('hermes-agent');
    expect(q.get('plan')).toBe('generic');
  });
});

describe('exchangeAuthCode', () => {
  const opts = {
    tokenUrl: 'https://auth.x.ai/oauth2/token',
    clientId: 'client-123',
    redirectUri: 'http://127.0.0.1:56121/callback',
    verifier: 'verifier-xyz',
    code: 'auth-code-abc',
  };

  it('인가 코드를 토큰으로 교환하고 매핑한다', async () => {
    let captured: { url: string; body: string } | null = null;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      captured = { url, body: String(init?.body) };
      return new Response(
        JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, id_token: 'ID' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const before = Date.now();
    const tok = await exchangeAuthCode({ ...opts, fetchImpl });
    expect(tok.accessToken).toBe('AT');
    expect(tok.refreshToken).toBe('RT');
    expect(tok.idToken).toBe('ID');
    expect(tok.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);

    expect(captured!.url).toBe('https://auth.x.ai/oauth2/token');
    const body = new URLSearchParams(captured!.body);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code-abc');
    expect(body.get('client_id')).toBe('client-123');
    expect(body.get('redirect_uri')).toBe('http://127.0.0.1:56121/callback');
    expect(body.get('code_verifier')).toBe('verifier-xyz');
  });

  it('access_token이 없으면 에러를 던진다', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as unknown as typeof fetch;
    await expect(exchangeAuthCode({ ...opts, fetchImpl })).rejects.toThrow();
  });
});
