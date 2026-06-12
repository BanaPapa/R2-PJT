// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { effectiveDef } from '../../vite-plugins/adapters';
import type { ProviderDef } from '../../src/entities/provider/model/provider.types';

const def: ProviderDef = {
  id: 'openai',
  label: 'OpenAI',
  apiShape: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  auth: ['apiKey', 'subscription'],
  subscription: { kind: 'oauth-loopback', apiShape: 'chatgpt-codex', baseUrl: 'https://chatgpt.com/backend-api/codex' },
};

describe('effectiveDef', () => {
  it('subscription 인증이면 구독용 apiShape/baseUrl로 오버라이드한다', () => {
    const eff = effectiveDef(def, { method: 'subscription', accessToken: 'AT' });
    expect(eff.apiShape).toBe('chatgpt-codex');
    expect(eff.baseUrl).toBe('https://chatgpt.com/backend-api/codex');
  });

  it('apiKey 인증이면 기본 apiShape/baseUrl을 유지한다', () => {
    const eff = effectiveDef(def, { method: 'apiKey', apiKey: 'sk' });
    expect(eff.apiShape).toBe('openai-compatible');
    expect(eff.baseUrl).toBe('https://api.openai.com/v1');
  });
});
