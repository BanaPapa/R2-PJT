// 분석 결과·데이터 내보내기. 다른 AI에 그대로 전달할 수 있는 .md/.json/.csv를 생성한다.
import type { AnalysisScope, AnalysisDataset } from '../../../entities/analysis';
import { parseReportTabs } from '../ui/AnalysisResult';

// ===TAB: 라벨=== 구분선을 `# 라벨` 제목으로 바꿔 외부 공유에 깔끔한 마크다운으로 만든다.
function reportToHeadings(report: string): string {
  const tabs = parseReportTabs(report);
  if (tabs.length <= 1) return tabs[0]?.body ?? report.trim();
  return tabs.map(t => `# ${t.label}\n\n${t.body}`).join('\n\n');
}

function scopeMeta(scope: AnalysisScope | null): string {
  if (!scope) return '- (스코프 정보 없음)';
  return [
    `- 모드: ${scope.mode}`,
    `- 기간: ${scope.period.from} ~ ${scope.period.to}`,
    `- 지역: ${scope.regions.map(r => scope.regionLabels[r] ?? r).join(', ')}`,
  ].join('\n');
}

// 보고서 + 데이터(JSON 코드블록). AI 핸드오프 기본 형식.
export function toExportMarkdown(report: string, scope: AnalysisScope | null, datasets: AnalysisDataset[]): string {
  const json = JSON.stringify({ scope, datasets }, null, 2);
  return [
    reportToHeadings(report),
    '',
    '## 데이터',
    '',
    '분석에 사용된 원본 데이터입니다(다른 AI에 그대로 전달 가능).',
    '',
    scopeMeta(scope),
    '',
    '```json',
    json,
    '```',
    '',
  ].join('\n');
}

// 순수 구조: { report, scope, datasets }.
export function toExportJson(report: string, scope: AnalysisScope | null, datasets: AnalysisDataset[]): string {
  return JSON.stringify({ report, scope, datasets }, null, 2);
}

// 데이터 시계열을 평탄한 표로. 엑셀에서 바로 열 수 있다.
export function toExportCsv(scope: AnalysisScope | null, datasets: AnalysisDataset[]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const label = (key: string) => scope?.regionLabels[key] ?? key;
  const rows: string[] = ['지표,지표키,지역,날짜,값'];
  for (const d of datasets) {
    for (const [region, rs] of Object.entries(d.byRegion)) {
      for (const p of rs.series) {
        rows.push(
          [esc(d.label), esc(d.metric), esc(label(region)), p.date, p.value == null ? '' : String(p.value)].join(','),
        );
      }
    }
  }
  return rows.join('\n');
}

// 파일명 베이스(확장자 제외).
export function exportBaseName(): string {
  return `analysis-${new Date().toISOString().slice(0, 10)}`;
}

// 텍스트 콘텐츠를 파일로 다운로드(브라우저 전용). CSV는 엑셀 한글 깨짐 방지로 BOM을 붙인다.
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const body = mime.includes('csv') ? `﻿${content}` : content;
  const blob = new Blob([body], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
