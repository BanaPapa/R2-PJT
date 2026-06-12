import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AskPanel } from '../../../src/features/analysis/ui/AskPanel';
import type { AnalysisScope } from '../../../src/entities/analysis';

vi.mock('../../../src/entities/analysis', async (orig) => {
  const actual = await orig<typeof import('../../../src/entities/analysis')>();
  return { ...actual, runAsk: vi.fn(async () => ({ id: 'x', status: 'done', result: '답변입니다.' })) };
});

const scope: AnalysisScope = { mode: 'weekly', regions: ['서울'], regionLabels: { 서울: '서울' }, period: { from: 'a', to: 'b' }, tabs: ['weekly-price'] };

describe('AskPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('질문을 보내면 답변이 스레드에 누적된다', async () => {
    render(<AskPanel scope={scope} datasets={[]} resultMarkdown="결론" dataAvailable />);
    fireEvent.change(screen.getByPlaceholderText(/질문/), { target: { value: '서울은?' } });
    fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }));
    await waitFor(() => expect(screen.getByText('답변입니다.')).toBeInTheDocument());
    expect(screen.getByText('서울은?')).toBeInTheDocument();
  });

  it('빈 질문은 보내지 않는다', () => {
    const { container } = render(<AskPanel scope={scope} datasets={[]} resultMarkdown="결론" dataAvailable />);
    fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }));
    expect(container.querySelectorAll('[data-role="assistant"]').length).toBe(0);
  });

  it('데이터가 없으면 안내를 표시한다', () => {
    render(<AskPanel scope={scope} datasets={[]} resultMarkdown="결론" dataAvailable={false} />);
    expect(screen.getByText(/원본 데이터 없이/)).toBeInTheDocument();
  });
});
