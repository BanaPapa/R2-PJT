import { describe, it, expect } from 'vitest';
import { PROVIDERS, getProvider } from '../../../src/entities/provider/model/registry';

describe('provider registry', () => {
  it('id가 중복되지 않는다', () => {
    const ids = PROVIDERS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('claude-bridge가 맨 앞 내장 프로바이더로 존재한다', () => {
    expect(PROVIDERS[0]?.id).toBe('claude-bridge');
    expect(PROVIDERS[0]?.auth).toEqual([]);
  });

  it('subscription 선언이 있으면 kind를 가진다', () => {
    for (const p of PROVIDERS) {
      if (p.auth.includes('subscription')) {
        expect(p.subscription?.kind).toBeTruthy();
      }
    }
  });

  it('getProvider는 정의를 반환하고 미존재는 undefined', () => {
    expect(getProvider('openai')?.label).toBe('OpenAI');
    expect(getProvider('nope')).toBeUndefined();
  });

  it('OpenAI 구독은 oauth-loopback이며 chatgpt-codex 백엔드로 오버라이드한다', () => {
    const openai = getProvider('openai');
    expect(openai?.auth).toContain('subscription');
    const sub = openai?.subscription;
    expect(sub?.kind).toBe('oauth-loopback');
    expect(sub?.authorizeUrl).toBe('https://auth.openai.com/oauth/authorize');
    expect(sub?.tokenUrl).toBe('https://auth.openai.com/oauth/token');
    expect(sub?.clientId).toBe('app_EMoamEEZ73f0CkXaXp7hrann');
    expect(sub?.loopbackPort).toBe(1455);
    expect(sub?.apiShape).toBe('chatgpt-codex');
    expect(sub?.baseUrl).toBe('https://chatgpt.com/backend-api/codex');
  });

  it('xAI 구독은 oauth-code(코드 붙여넣기) 방식이며 auth.x.ai 엔드포인트를 가진다', () => {
    const xai = getProvider('xai');
    const sub = xai?.subscription;
    expect(sub?.kind).toBe('oauth-code');
    expect(sub?.authorizeUrl).toBe('https://auth.x.ai/oauth2/authorize');
    expect(sub?.tokenUrl).toBe('https://auth.x.ai/oauth2/token');
    expect(sub?.clientId).toBeTruthy();
    expect(sub?.redirectUri).toBeTruthy();
    expect(sub?.scopes).toContain('api:access');
  });
});
