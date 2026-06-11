import { describe, it, expect, beforeEach } from 'vitest';
import { useMonthlyStore } from '../../../src/shared/lib/monthly-store';

describe('skipYRangeClear 가드', () => {
  beforeEach(() => {
    useMonthlyStore.setState({ skipYRangeClear: new Set<string>() });
  });

  it('설정한 prefix는 한 번만 소비된다', () => {
    useMonthlyStore.getState().armSkipYRangeClear(['wp:']);
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('wp:')).toBe(true);
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('wp:')).toBe(false);
  });

  it('설정하지 않은 prefix는 소비되지 않는다', () => {
    useMonthlyStore.getState().armSkipYRangeClear(['mp:', 'mk:']);
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('wp:')).toBe(false);
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('mp:')).toBe(true);
    expect(useMonthlyStore.getState().consumeSkipYRangeClear('mk:')).toBe(true);
  });
});
