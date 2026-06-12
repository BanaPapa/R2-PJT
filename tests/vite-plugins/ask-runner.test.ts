import { describe, expect, it } from 'vitest';
import { buildAskMessages } from '../../vite-plugins/analysis-runner';

describe('buildAskMessages', () => {
  it('결과·데이터·히스토리·질문을 모두 포함한다', async () => {
    const { system, user } = await buildAskMessages(process.cwd(), {
      kind: 'ask',
      scope: { mode: 'weekly', regions: ['서울'], regionLabels: { 서울: '서울' }, period: { from: 'a', to: 'b' }, tabs: ['weekly-price'] },
      datasets: [{ tab: 'weekly-price', metric: 'm', label: 'L', unit: '', byRegion: {} }],
      resultMarkdown: '## 결론\n상승세입니다.',
      history: [{ role: 'user', text: '왜 올랐어?' }, { role: 'assistant', text: '수요 때문입니다.' }],
      question: '서울은 어때?',
    });
    expect(system.length).toBeGreaterThan(20);
    expect(user).toContain('상승세입니다');
    expect(user).toContain('왜 올랐어?');
    expect(user).toContain('서울은 어때?');
    expect(user).toContain('"metric": "m"');
  });
});
