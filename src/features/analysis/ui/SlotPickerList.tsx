import { useSlotStore } from '../../chart-slots';
import type { ChartSetSnapshot, SlotMode } from '../../chart-slots';

interface SlotPickerListProps {
  onPick: (snapshot: ChartSetSnapshot) => void;
}

const MODE_LABEL: Record<SlotMode, string> = { weekly: '주간', monthly: '월간' };

// 저장된 슬롯 목록 — 선택 시 직접 선택 폼을 슬롯 내용으로 채운다.
export function SlotPickerList({ onPick }: SlotPickerListProps) {
  const weekly = useSlotStore(s => s.weekly);
  const monthly = useSlotStore(s => s.monthly);

  const sections: { mode: SlotMode; slots: (ChartSetSnapshot | null)[] }[] = [
    { mode: 'weekly', slots: weekly },
    { mode: 'monthly', slots: monthly },
  ];

  const total = weekly.filter(Boolean).length + monthly.filter(Boolean).length;

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        저장된 슬롯이 없습니다. 상단의 <span className="font-semibold">저장</span> 버튼으로 먼저 슬롯을 만드세요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">저장된 슬롯을 선택하면 지역·지표가 아래 직접 선택 폼에 채워집니다.</p>
      {sections.map(({ mode, slots }) => {
        const filled = slots
          .map((slot, index) => ({ slot, index }))
          .filter((x): x is { slot: ChartSetSnapshot; index: number } => x.slot !== null);
        if (filled.length === 0) return null;
        return (
          <div key={mode}>
            <p className="mb-1.5 text-xs font-semibold text-gray-500">{MODE_LABEL[mode]} 슬롯</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {filled.map(({ slot, index }) => (
                <button
                  key={slot.id}
                  onClick={() => onPick(slot)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-gray-800">{slot.name}</span>
                  <span className="flex-none text-xs text-gray-400">{slot.selectedRegions.length}개 지역</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
