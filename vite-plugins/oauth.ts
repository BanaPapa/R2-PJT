import crypto from 'node:crypto';

export function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createVerifier(): string {
  return base64url(crypto.randomBytes(48)); // 64자 내외
}

export function challengeFor(verifier: string): string {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

export function createState(): string {
  return base64url(crypto.randomBytes(16));
}

export interface PkceSession {
  providerId: string;
  verifier: string;
  createdAt: number;
}

// state → 세션. dev 서버 수명 동안만 유효(메모리).
export const pkceSessions = new Map<string, PkceSession>();

export function putSession(state: string, session: PkceSession): void {
  pkceSessions.set(state, session);
  // 10분 후 정리
  setTimeout(() => pkceSessions.delete(state), 10 * 60 * 1000).unref?.();
}

export function takeSession(state: string): PkceSession | undefined {
  const s = pkceSessions.get(state);
  if (s) pkceSessions.delete(state);
  return s;
}
