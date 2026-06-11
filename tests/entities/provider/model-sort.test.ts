import { describe, it, expect } from 'vitest';
import { sortModels, modelOptionLabel, priceTag } from '../../../src/entities/provider/lib/model-sort';
import type { ModelInfo } from '../../../src/entities/provider/model/provider.types';

const models: ModelInfo[] = [
  { id: 'paid-new', label: 'Paid New', created: 200, promptPrice: 0.000003, contextLength: 8000 },
  { id: 'free-old:free', label: 'Free Old', created: 100, promptPrice: 0, contextLength: 200000, isFree: true },
  { id: 'paid-cheap', label: 'Paid Cheap', created: 150, promptPrice: 0.000001, contextLength: 32000 },
];

describe('sortModels', () => {
  it('무료 우선은 무료 모델을 맨 앞으로', () => {
    expect(sortModels(models, 'free')[0]?.id).toBe('free-old:free');
  });

  it('최신순은 created 큰 순서', () => {
    expect(sortModels(models, 'newest').map(m => m.id)).toEqual(['paid-new', 'paid-cheap', 'free-old:free']);
  });

  it('가격순은 입력 단가 낮은 순서', () => {
    expect(sortModels(models, 'price').map(m => m.id)).toEqual(['free-old:free', 'paid-cheap', 'paid-new']);
  });

  it('컨텍스트순은 길이 큰 순서', () => {
    expect(sortModels(models, 'context')[0]?.id).toBe('free-old:free');
  });

  it('원본 배열을 변형하지 않는다', () => {
    const before = models.map(m => m.id);
    sortModels(models, 'price');
    expect(models.map(m => m.id)).toEqual(before);
  });
});

describe('라벨/태그', () => {
  it('무료 모델은 무료 태그', () => {
    expect(priceTag({ id: 'x', isFree: true })).toBe('무료');
  });

  it('유료 모델은 백만 토큰당 가격', () => {
    expect(priceTag({ id: 'x', promptPrice: 0.000003 })).toBe('$3.00/1M');
  });

  it('가격 정보 없으면 태그 없음', () => {
    expect(priceTag({ id: 'x' })).toBe('');
  });

  it('옵션 라벨은 이름 + 태그', () => {
    expect(modelOptionLabel({ id: 'x', label: 'Model X', isFree: true })).toBe('Model X · 무료');
    expect(modelOptionLabel({ id: 'y' })).toBe('y');
  });
});
