import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSlotStore } from '../../../src/features/chart-slots/model/slot-store';
import * as captureMod from '../../../src/features/chart-slots/lib/capture';
import { SLOT_COUNT, type ChartSetSnapshot } from '../../../src/features/chart-slots/model/types';

function fakeSnap(mode: 'weekly' | 'monthly', name = 'snap'): ChartSetSnapshot {
  return {
    id: 'id-' + name, name, mode, createdAt: 0, schemaVersion: 1,
    selectedRegions: ['서울특별시'], regionLabels: { 서울특별시: '서울특별시' },
    fromDate: '2023-01-01', toDate: '2026-01-01', baseDate: '2026-01-01',
    weeklyTab: 'price', tradeMaOn: true, tradeMaWindow: 13, baseLineOn: true,
    yRanges: {}, tradeYRanges: {}, chartOptions: {},
  };
}

beforeEach(() => {
  useSlotStore.setState({
    weekly: Array(SLOT_COUNT).fill(null),
    monthly: Array(SLOT_COUNT).fill(null),
  });
  vi.restoreAllMocks();
});

describe('useSlotStore', () => {
  it('saveToSlot은 capture 결과를 해당 인덱스에 넣는다', () => {
    vi.spyOn(captureMod, 'capture').mockReturnValue(fakeSnap('weekly', 'A'));
    useSlotStore.getState().saveToSlot('weekly', 2);
    expect(useSlotStore.getState().weekly[2]?.name).toBe('A');
    expect(useSlotStore.getState().monthly[2]).toBeNull();
  });

  it('loadSlot은 apply를 호출한다', () => {
    const snap = fakeSnap('weekly', 'B');
    useSlotStore.setState(s => {
      const weekly = [...s.weekly]; weekly[0] = snap; return { weekly };
    });
    const applySpy = vi.spyOn(captureMod, 'apply').mockImplementation(() => {});
    useSlotStore.getState().loadSlot('weekly', 0);
    expect(applySpy).toHaveBeenCalledWith(snap);
  });

  it('deleteSlot은 null로 비운다', () => {
    useSlotStore.setState(s => {
      const weekly = [...s.weekly]; weekly[1] = fakeSnap('weekly'); return { weekly };
    });
    useSlotStore.getState().deleteSlot('weekly', 1);
    expect(useSlotStore.getState().weekly[1]).toBeNull();
  });

  it('renameSlot은 이름만 바꾼다', () => {
    useSlotStore.setState(s => {
      const weekly = [...s.weekly]; weekly[0] = fakeSnap('weekly', 'old'); return { weekly };
    });
    useSlotStore.getState().renameSlot('weekly', 0, 'new');
    expect(useSlotStore.getState().weekly[0]?.name).toBe('new');
  });

  it('범위 밖 인덱스는 무시한다', () => {
    vi.spyOn(captureMod, 'capture').mockReturnValue(fakeSnap('weekly'));
    useSlotStore.getState().saveToSlot('weekly', SLOT_COUNT);
    expect(useSlotStore.getState().weekly.every(s => s === null)).toBe(true);
  });
});
