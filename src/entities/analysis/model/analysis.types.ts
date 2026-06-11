// 분석 요청/응답 데이터 모델. 브릿지(.analysis/*)와 프론트엔드가 공유하는 계약.

// 한 시계열의 요약통계
export interface SeriesSummary {
  latest: number | null; // 최신값
  start: number | null; // 구간 시작값
  changeAbs: number | null; // latest - start
  changePct: number | null; // (latest/start - 1) * 100
  min: number | null;
  max: number | null;
  mean: number | null;
  direction: 'up' | 'down' | 'flat'; // 추세 방향
}

export interface SeriesPoint {
  date: string;
  value: number | null;
}

export interface RegionSeries {
  summary: SeriesSummary;
  series: SeriesPoint[]; // 200포인트 초과 시 균등 샘플링됨
  sampled: boolean; // 샘플링 여부
}

export type AnalysisTab =
  | 'weekly-price'
  | 'weekly-trade'
  | 'monthly-price'
  | 'monthly-trade'
  | 'monthly-market';

export interface AnalysisDataset {
  tab: AnalysisTab;
  metric: string; // 예: 'saleIndex', 'avgSale'
  label: string; // 사람이 읽는 지표명
  unit: string;
  byRegion: Record<string, RegionSeries>;
}

export interface AnalysisScope {
  mode: 'weekly' | 'monthly' | 'mixed';
  regions: string[];
  regionLabels: Record<string, string>;
  period: { from: string; to: string };
  tabs: AnalysisTab[];
}

export interface AnalysisRequest {
  id?: string;
  generatedAt: string;
  scope: AnalysisScope;
  datasets: AnalysisDataset[];
  provider?: string;       // 추가: 미지정 시 claude-bridge
  model?: string | null;   // 추가
}

export interface AnalysisResult {
  id: string;
  status: 'pending' | 'done' | 'error';
  result?: string; // 마크다운
  model?: string;
  error?: string;
}
