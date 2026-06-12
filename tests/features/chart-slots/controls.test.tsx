import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlotControls } from '../../../src/features/chart-slots';
import { useSlotStore } from '../../../src/features/chart-slots/model/slot-store';
import { useMonthlyStore } from '../../../src/shared/lib/monthly-store';
import { SLOT_COUNT } from '../../../src/features/chart-slots/model/types';
import * as captureMod from '../../../src/features/chart-slots/lib/capture';

beforeEach(() => {
  useMonthlyStore.setState({ mode: 'weekly' });
  useSlotStore.setState({
    weekly: Array(SLOT_COUNT).fill(null),
    monthly: Array(SLOT_COUNT).fill(null),
  });
  vi.spyOn(captureMod, 'capture').mockReturnValue({
    id: 'i', name: '서울 외 1 · 2023–2026', mode: 'weekly', createdAt: 0, schemaVersion: 1,
    selectedRegions: ['서울특별시'], regionLabels: {}, fromDate: '2023-01-01', toDate: '2026-01-01',
    baseDate: '2026-01-01', weeklyTab: 'price', tradeMaOn: true, tradeMaWindow: 13,
    baseLineOn: true, yRanges: {}, tradeYRanges: {}, chartOptions: {},
  });
});

describe('SlotControls', () => {
  it('저장을 누르면 첫 빈 슬롯이 채워진다', () => {
    render(<SlotControls />);
    fireEvent.click(screen.getByText('저장'));
    expect(useSlotStore.getState().weekly[0]?.name).toBe('서울 외 1 · 2023–2026');
  });

  it('슬롯 ▾ 팝오버에 10개 행이 보인다', () => {
    render(<SlotControls />);
    fireEvent.click(screen.getByText('슬롯 ▾'));
    expect(screen.getByText(/주간 슬롯 \(10개\)/)).toBeInTheDocument();
    expect(screen.getAllByText('(빈 슬롯)')).toHaveLength(SLOT_COUNT);
  });
});
