import { describe, expect, it } from 'vitest';
import { parseReportTabs } from '../../../src/features/analysis/ui/AnalysisResult';

describe('parseReportTabs', () => {
  it('구분선이 없으면 전체를 단일 탭으로 본다', () => {
    const tabs = parseReportTabs('## 결론\n\n그냥 본문입니다.');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.label).toBe('분석');
    expect(tabs[0]!.body).toContain('그냥 본문');
  });

  it('===TAB: 라벨=== 으로 탭을 나눈다', () => {
    const md = [
      '===TAB: 종합===',
      '## 결론',
      '종합 결론',
      '===TAB: 강남구===',
      '## 결론',
      '강남 결론',
    ].join('\n');
    const tabs = parseReportTabs(md);
    expect(tabs.map(t => t.label)).toEqual(['종합', '강남구']);
    expect(tabs[0]!.body).toContain('종합 결론');
    expect(tabs[1]!.body).toContain('강남 결론');
  });

  it('첫 구분선 앞 서문은 무시하고, 빈 탭은 버린다', () => {
    const md = '잡소리\n===TAB: 종합===\n내용\n===TAB: 빈탭===\n   \n';
    const tabs = parseReportTabs(md);
    expect(tabs.map(t => t.label)).toEqual(['종합']);
    expect(tabs[0]!.body).toBe('내용');
  });

  it('= 개수와 공백 변형을 허용한다', () => {
    const md = '==TAB:서초구==\n본문';
    const tabs = parseReportTabs(md);
    expect(tabs[0]!.label).toBe('서초구');
  });
});
