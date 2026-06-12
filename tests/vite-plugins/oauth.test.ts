import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { createVerifier, challengeFor, createState, base64url } from '../../vite-plugins/oauth';

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
});
