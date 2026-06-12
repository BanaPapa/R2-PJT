import { describe, expect, it } from 'vitest';
import { encode } from 'gpt-tokenizer';
import { estimateAskInputTokens } from '../../../src/features/analysis/lib/estimate';
import type { AskRequest } from '../../../src/entities/analysis';

const count = (t: string) => encode(t).length;

function base(history: AskRequest['history']): AskRequest {
  return {
    kind: 'ask',
    generatedAt: '',
    scope: { mode: 'weekly', regions: ['서울'], regionLabels: { 서울: '서울' }, period: { from: 'a', to: 'b' }, tabs: ['weekly-price'] },
    datasets: [],
    resultMarkdown: '결론입니다.',
    history,
    question: '서울은 어때?',
  };
}

describe('estimateAskInputTokens', () => {
  it('히스토리가 길수록 토큰이 늘어난다', () => {
    const few = estimateAskInputTokens(base([]), count);
    const many = estimateAskInputTokens(base([{ role: 'user', text: '아주 긴 질문 '.repeat(50) }]), count);
    expect(many).toBeGreaterThan(few);
  });
});
