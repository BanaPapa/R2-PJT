import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from '../../../src/features/analysis/ui/AnalysisResult';

describe('Markdown 문장 줄바꿈', () => {
  it('"~다." 문장마다 <br>로 분리한다', () => {
    const { container } = render(<Markdown text={'첫 문장입니다. 둘째 문장입니다. 셋째입니다.'} />);
    expect(container.querySelectorAll('br').length).toBe(2);
  });

  it('단일 문장은 줄바꿈하지 않는다', () => {
    const { container } = render(<Markdown text={'한 문장입니다.'} />);
    expect(container.querySelectorAll('br').length).toBe(0);
  });

  it('번호 목록 항목 내부도 문장마다 줄바꿈한다', () => {
    const { container } = render(<Markdown text={'1. 첫째입니다. 근거입니다.\n2. 둘째입니다.'} />);
    expect(container.querySelectorAll('ol li').length).toBe(2);
    // 첫 항목은 2문장 → <br> 1개
    expect(container.querySelectorAll('br').length).toBe(1);
  });

  it('소수점(33.8) 은 문장 끝으로 오인하지 않는다', () => {
    const { container } = render(<Markdown text={'전세가율이 33.8%까지 하락했습니다.'} />);
    expect(container.querySelectorAll('br').length).toBe(0);
  });
});
