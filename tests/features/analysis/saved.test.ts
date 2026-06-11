import { describe, it, expect, beforeEach } from 'vitest';
import { useSavedStore } from '../../../src/features/analysis/model/saved-store';
import { formatUsage, summarizeScope } from '../../../src/features/analysis/lib/saved';
import type { AnalysisScope } from '../../../src/entities/analysis';

beforeEach(() => useSavedStore.setState({ items: [] }));

const base = { name: 'A', scopeLabel: 'A', provider: 'openrouter', model: 'm', markdown: '본문' };

describe('useSavedStore', () => {
  it('저장하면 최신 항목이 앞에 온다', () => {
    useSavedStore.getState().save({ ...base, name: '첫번째' });
    useSavedStore.getState().save({ ...base, name: '두번째' });
    expect(useSavedStore.getState().items.map(i => i.name)).toEqual(['두번째', '첫번째']);
  });

  it('삭제·이름변경이 동작한다', () => {
    const id = useSavedStore.getState().save(base);
    useSavedStore.getState().rename(id, '새이름');
    expect(useSavedStore.getState().items[0]?.name).toBe('새이름');
    useSavedStore.getState().remove(id);
    expect(useSavedStore.getState().items).toHaveLength(0);
  });
});

describe('formatUsage', () => {
  it('없으면 빈 문자열', () => {
    expect(formatUsage(undefined)).toBe('');
  });
  it('토큰 + 비용 표기', () => {
    expect(formatUsage({ promptTokens: 1000, completionTokens: 2000, totalTokens: 3000, cost: 0.0123 }))
      .toBe('입력 1,000 · 출력 2,000 · 합계 3,000 토큰 · $0.0123');
  });
  it('비용만 있어도 표기', () => {
    expect(formatUsage({ cost: 0.5 })).toBe('$0.5000');
  });
});

describe('summarizeScope', () => {
  it('지표·지역·기간을 요약', () => {
    const scope: AnalysisScope = {
      mode: 'weekly',
      regions: ['서울특별시'],
      regionLabels: { 서울특별시: '서울' },
      period: { from: '2023-01-01', to: '2026-01-01' },
      tabs: ['weekly-price'],
    };
    expect(summarizeScope(scope)).toBe('주간·시세 · 서울 · 2023-01-01~2026-01-01');
  });
});
