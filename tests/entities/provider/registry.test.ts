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
});
