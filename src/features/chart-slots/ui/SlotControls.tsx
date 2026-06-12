import { useState, useRef, useEffect } from 'react';
import { useMonthlyStore } from '../../../shared/lib/monthly-store';
import { useSlotStore } from '../model/slot-store';
import { SlotPopover } from './SlotPopover';
import type { SlotMode } from '../model/types';

export function SlotControls() {
  const mode = useMonthlyStore(s => s.mode) as SlotMode;
  const slots = useSlotStore(s => s[mode]);
  const saveToSlot = useSlotStore(s => s.saveToSlot);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 팝오버 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  // 저장: 다음 빈 슬롯에 저장. 가득 차면 팝오버를 열어 덮어쓰기 유도.
  const handleSave = () => {
    const empty = slots.findIndex(s => s === null);
    if (empty === -1) {
      setOpen(true);
      return;
    }
    saveToSlot(mode, empty);
    setOpen(true);
  };

  return (
    <div ref={ref} className="relative flex items-center gap-1">
      <button
        onClick={handleSave}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
      >
        저장
      </button>
      <button
        onClick={() => setOpen(o => !o)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
      >
        슬롯 ▾
      </button>
      {open && <SlotPopover mode={mode} onClose={() => setOpen(false)} />}
    </div>
  );
}
