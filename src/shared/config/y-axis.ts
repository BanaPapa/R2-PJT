// 차트별 Y축 기본범위 · 선택옵션 · 눈금단위 · 소수자리 설정.
// 거래지표의 고정 0~200 방식을 시세지표/시장지표로 확장하기 위한 공용 정의.

export interface YAxisConfig {
  min: number;
  max: number;
  minOptions: number[];
  maxOptions: number[];
  tickStep?: number; // 지정 시 해당 간격으로 눈금 생성(과밀하면 MetricChart가 자동 축약)
  decimals?: number; // 축 라벨 소수자리 (0 = 정수)
}

// from~to를 step 간격으로(부동소수 보정). 0.5 단위 등 소수 step 안전.
function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  const n = Math.round((to - from) / step);
  for (let i = 0; i <= n; i++) out.push(Math.round((from + i * step) * 1000) / 1000);
  return out;
}

// 시세지표(주간·월간 공용) — 지수/증감/누적변동률.
// 지수는 기간이 "전체"이면 최대값을 300까지 확장한다.
export function priceYConfig(id: string, fullPeriod: boolean): YAxisConfig | null {
  if (id === 'saleIndex' || id === 'jeonseIndex') {
    return {
      min: 0,
      max: fullPeriod ? 300 : 200,
      minOptions: [0, 20, 40, 60, 80, 100],
      maxOptions: range(100, 300, 20),
      tickStep: 20,
      decimals: 0,
    };
  }
  if (id === 'saleChange' || id === 'jeonseChange') {
    return {
      min: -5,
      max: 20,
      minOptions: range(-5, 0, 0.5),
      maxOptions: range(0, 20, 0.5),
      tickStep: 0.5,
      decimals: 1,
    };
  }
  if (id === 'saleCumulative' || id === 'jeonseCumulative') {
    return {
      min: -40,
      max: 200,
      minOptions: [-40, -20, 0],
      maxOptions: range(0, 200, 20),
      tickStep: 20,
      decimals: 0,
    };
  }
  return null;
}

// 시장지표 — 평균가(만원/3.3㎡)·격차·전세가율·전망지수. 스케일이 제각각이라 차트별로 둔다.
export const MARKET_Y_CONFIG: Record<string, YAxisConfig> = {
  avgSale: { min: 0, max: 6000, minOptions: [0, 1000, 2000], maxOptions: [2000, 3000, 4000, 5000, 6000, 8000, 10000], tickStep: 1000, decimals: 0 },
  avgJeonse: { min: 0, max: 4000, minOptions: [0, 1000, 2000], maxOptions: [2000, 3000, 4000, 5000, 6000, 8000], tickStep: 1000, decimals: 0 },
  gap: { min: 0, max: 3000, minOptions: [0, 500, 1000], maxOptions: [1000, 1500, 2000, 3000, 4000, 5000], tickStep: 500, decimals: 0 },
  saleForecast: { min: 0, max: 200, minOptions: [0, 20, 40, 60, 80, 100], maxOptions: range(100, 200, 20), tickStep: 20, decimals: 0 },
  jeonseForecast: { min: 0, max: 200, minOptions: [0, 20, 40, 60, 80, 100], maxOptions: range(100, 200, 20), tickStep: 20, decimals: 0 },
  jeonseRatio: { min: 0, max: 100, minOptions: [0, 20, 40], maxOptions: [60, 80, 100], tickStep: 20, decimals: 0 },
};
