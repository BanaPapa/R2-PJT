import { useState } from 'react';
import { useSlotStore } from '../model/slot-store';
import { SLOT_COUNT, type SlotMode } from '../model/types';

interface SlotPopoverProps {
  mode: SlotMode;
  onClose: () => void;
}

export function SlotPopover({ mode, onClose }: SlotPopoverProps) {
  const slots = useSlotStore(s => s[mode]);
  const { saveToSlot, loadSlot, deleteSlot, renameSlot } = useSlotStore();
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <div className="absolute right-0 top-full mt-1 w-96 rounded-lg border border-gray-200 bg-white p-2 shadow-lg z-50">
      <p className="px-2 py-1 text-xs font-semibold text-gray-500">
        {mode === 'weekly' ? '주간' : '월간'} 슬롯 ({SLOT_COUNT}개)
      </p>
      <ul className="max-h-96 overflow-auto">
        {Array.from({ length: SLOT_COUNT }, (_, i) => {
          const slot = slots[i] ?? null;
          return (
            <li key={i} className="flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-gray-50">
              <span className="w-5 shrink-0 text-center text-xs text-gray-400">{i + 1}</span>
              {slot ? (
                <>
                  {editing === i ? (
                    <input
                      autoFocus
                      defaultValue={slot.name}
                      onBlur={e => {
                        renameSlot(mode, i, e.target.value.trim() || slot.name);
                        setEditing(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="min-w-0 flex-1 rounded border border-blue-300 px-1 text-sm"
                    />
                  ) : (
                    <button
                      onDoubleClick={() => setEditing(i)}
                      title="더블클릭하여 이름 수정"
                      className="min-w-0 flex-1 truncate text-left text-sm text-gray-800"
                    >
                      {slot.name}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      loadSlot(mode, i);
                      onClose();
                    }}
                    className="shrink-0 rounded bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    불러오기
                  </button>
                  <button
                    onClick={() => saveToSlot(mode, i)}
                    title="현재 화면으로 덮어쓰기"
                    className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    덮어쓰기
                  </button>
                  <button
                    onClick={() => deleteSlot(mode, i)}
                    title="삭제"
                    className="shrink-0 rounded px-1 text-xs text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-300">(빈 슬롯)</span>
                  <button
                    onClick={() => saveToSlot(mode, i)}
                    className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                  >
                    현재 저장
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
