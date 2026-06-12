import { describe, expect, it } from 'vitest';
import { encode } from 'gpt-tokenizer';
import {
  estimateInputTokens,
  estimateOutputTokens,
  estimateCost,
  estimateAnalysis,
} from '../../../src/features/analysis/lib/estimate';
import type { AnalysisRequest, AnalysisDataset } from '../../../src/entities/analysis';
import type { ModelInfo } from '../../../src/entities/provider/model/provider.types';

// 테스트에선 토크나이저를 직접 주입(앱은 동적 로드).
const count = (t: string) => encode(t).length;

function dataset(region: string): AnalysisDataset {
  return {
    tab: 'weekly-price',
    metric: 'saleIndex',
    label: '매매지수',
    unit: '',
    byRegion: {
      [region]: {
        summary: { latest: 100, start: 90, changeAbs: 10, changePct: 11.1, min: 90, max: 100, mean: 95, direction: 'up' },
        series: [
          { date: '2026-01-01', value: 90 },
          { date: '2026-02-01', value: 100 },
        ],
        sampled: false,
      },
    },
  };
}

function payload(regions: string[]): Pick<AnalysisRequest, 'scope' | 'datasets'> {
  return {
    scope: {
      mode: 'weekly',
      regions,
      regionLabels: Object.fromEntries(regions.map(r => [r, r])),
      period: { from: '2026-01-01', to: '2026-02-01' },
      tabs: ['weekly-price'],
    },
    datasets: regions.map(dataset),
  };
}

describe('estimateInputTokens', () => {
  it('시스템 프롬프트가 포함되어 0보다 크다', () => {
    expect(estimateInputTokens(payload(['서울']), count)).toBeGreaterThan(50);
  });

  it('데이터셋이 많을수록 입력 토큰이 늘어난다', () => {
    const one = estimateInputTokens(payload(['서울']), count);
    const three = estimateInputTokens(payload(['서울', '부산', '대구']), count);
    expect(three).toBeGreaterThan(one);
  });
});

describe('estimateOutputTokens', () => {
  it('지역 1개는 종합 탭 1개분만 추정', () => {
    const one = estimateOutputTokens(payload(['서울']));
    const three = estimateOutputTokens(payload(['서울', '부산', '대구']));
    // 3개 지역 → 종합 + 3 = 4탭, 1개 지역 → 1탭
    expect(three.high).toBeGreaterThan(one.high * 2);
  });
});

describe('estimateCost', () => {
  const priced: ModelInfo = { id: 'm', promptPrice: 0.000001, completionPrice: 0.000002 };

  it('무료 모델은 0', () => {
    expect(estimateCost(1000, 1000, { id: 'f', isFree: true })).toEqual({ usd: 0, free: true });
  });

  it('모델 없으면 null', () => {
    expect(estimateCost(1000, 1000).usd).toBeNull();
  });

  it('단가가 있으면 입력×입력단가 + 출력×출력단가', () => {
    const { usd } = estimateCost(1000, 500, priced);
    expect(usd).toBeCloseTo(1000 * 0.000001 + 500 * 0.000002, 10);
  });

  it('단가 정보가 전혀 없으면 null', () => {
    expect(estimateCost(1000, 1000, { id: 'x' }).usd).toBeNull();
  });
});

describe('estimateAnalysis', () => {
  it('컨텍스트 한도 근접 시 overContext=true', () => {
    const tiny: ModelInfo = { id: 't', contextLength: 10 };
    expect(estimateAnalysis(payload(['서울']), count, tiny).overContext).toBe(true);
  });
});
