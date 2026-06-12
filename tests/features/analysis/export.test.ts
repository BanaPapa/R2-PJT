import { describe, expect, it } from 'vitest';
import { toExportMarkdown, toExportJson, toExportCsv } from '../../../src/features/analysis/lib/export';
import type { AnalysisScope, AnalysisDataset } from '../../../src/entities/analysis';

const scope: AnalysisScope = {
  mode: 'weekly',
  regions: ['gangnam'],
  regionLabels: { gangnam: '강남구' },
  period: { from: '2026-01-01', to: '2026-06-01' },
  tabs: ['weekly-price'],
};

const summary = { latest: 2, start: 1, changeAbs: 1, changePct: 100, min: 1, max: 2, mean: 1.5, direction: 'up' as const };
const datasets: AnalysisDataset[] = [
  {
    tab: 'weekly-price', metric: 'saleIndex', label: '매매지수', unit: '',
    byRegion: { gangnam: { summary, series: [{ date: '2026-01-01', value: 1 }, { date: '2026-02-01', value: 2 }], sampled: false } },
  },
];

describe('export builders', () => {
  it('toExportMarkdown: 보고서 + 데이터 JSON 블록을 포함한다', () => {
    const md = toExportMarkdown('## 결론\n상승입니다.', scope, datasets);
    expect(md).toContain('상승입니다');
    expect(md).toContain('## 데이터');
    expect(md).toContain('```json');
    expect(md).toContain('강남구'); // 지역 라벨
    expect(md).toContain('"metric": "saleIndex"');
  });

  it('toExportMarkdown: ===TAB=== 구분선을 # 제목으로 변환한다(멀티탭)', () => {
    const md = toExportMarkdown('===TAB: 종합===\n본문1\n===TAB: 강남구===\n본문2', scope, datasets);
    expect(md).toContain('# 종합');
    expect(md).toContain('# 강남구');
    expect(md).not.toContain('===TAB:');
  });

  it('toExportJson: report/scope/datasets를 담는다', () => {
    const obj = JSON.parse(toExportJson('보고서', scope, datasets));
    expect(obj.report).toBe('보고서');
    expect(obj.scope.regions).toEqual(['gangnam']);
    expect(obj.datasets).toHaveLength(1);
  });

  it('toExportCsv: 헤더 + 포인트 행을 만든다', () => {
    const csv = toExportCsv(scope, datasets);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('날짜');
    expect(lines).toContain('매매지수,saleIndex,강남구,2026-01-01,1');
    expect(lines).toContain('매매지수,saleIndex,강남구,2026-02-01,2');
  });
});
