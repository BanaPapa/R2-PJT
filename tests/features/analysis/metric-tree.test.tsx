import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { MetricTree, ALL_TREE_TABS } from '../../../src/features/analysis/ui/MetricTree';
import type { AnalysisTab } from '../../../src/entities/analysis';

function Harness({ onChangeSpy }: { onChangeSpy: (s: Set<AnalysisTab>) => void }) {
  const [sel, setSel] = useState<Set<AnalysisTab>>(new Set());
  return (
    <MetricTree
      selected={sel}
      onChange={next => {
        setSel(next);
        onChangeSpy(next);
      }}
    />
  );
}

describe('MetricTree', () => {
  it('전체 선택은 5개 탭을 모두 켠다', () => {
    const spy = vi.fn();
    render(<Harness onChangeSpy={spy} />);
    fireEvent.click(screen.getByText('전체 선택'));
    const last = spy.mock.calls.at(-1)![0] as Set<AnalysisTab>;
    expect(last.size).toBe(ALL_TREE_TABS.length);
    expect(ALL_TREE_TABS.every(t => last.has(t))).toBe(true);
  });

  it('전체 해제는 비운다', () => {
    const spy = vi.fn();
    render(<Harness onChangeSpy={spy} />);
    fireEvent.click(screen.getByText('전체 선택'));
    fireEvent.click(screen.getByText('전체 해제'));
    expect((spy.mock.calls.at(-1)![0] as Set<AnalysisTab>).size).toBe(0);
  });

  it('개별 leaf 체크가 동작한다', () => {
    const spy = vi.fn();
    render(<Harness onChangeSpy={spy} />);
    // 주간 그룹의 "시세지표" leaf
    fireEvent.click(screen.getAllByText('시세지표')[0]);
    const last = spy.mock.calls.at(-1)![0] as Set<AnalysisTab>;
    expect(last.has('weekly-price')).toBe(true);
    expect(last.size).toBe(1);
  });
});
