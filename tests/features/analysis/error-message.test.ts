import { describe, expect, it } from 'vitest';
import { friendlyError } from '../../../src/features/analysis/lib/error-message';

describe('friendlyError', () => {
  it('429/rate-limit는 사용량 초과 안내로 변환한다', () => {
    const raw = '프로바이더 오류 (429) {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"google/gemma-4-31b-it:free is temporarily rate-limited upstream."}}}';
    const msg = friendlyError(raw);
    expect(msg).toContain('429');
    expect(msg).not.toContain('{');
    expect(msg).toMatch(/사용량|다시 시도/);
  });

  it('인증 오류는 키 확인 안내로 변환한다', () => {
    expect(friendlyError('프로바이더 오류 (401) Unauthorized')).toMatch(/인증|키/);
  });

  it('알 수 없는 오류는 내부 message만 추출한다', () => {
    expect(friendlyError('보낼 수 없음 {"message":"context length exceeded"}')).toContain('context length exceeded');
  });

  it('빈 문자열은 기본 메시지를 준다', () => {
    expect(friendlyError('')).toMatch(/실패/);
  });
});
