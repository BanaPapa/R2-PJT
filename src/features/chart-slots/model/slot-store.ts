import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { capture, apply } from '../lib/capture';
import { SLOT_COUNT, type ChartSetSnapshot, type SlotMode } from './types';

type SlotArray = (ChartSetSnapshot | null)[];

interface SlotStore {
  weekly: SlotArray;
  monthly: SlotArray;
  saveToSlot: (mode: SlotMode, index: number) => void;
  loadSlot: (mode: SlotMode, index: number) => void;
  deleteSlot: (mode: SlotMode, index: number) => void;
  renameSlot: (mode: SlotMode, index: number, name: string) => void;
}

function emptySlots(): SlotArray {
  return Array(SLOT_COUNT).fill(null);
}

function inRange(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < SLOT_COUNT;
}

// 불변 업데이트: 해당 인덱스만 교체한 새 배열 반환.
function replaceAt(arr: SlotArray, index: number, value: ChartSetSnapshot | null): SlotArray {
  const next = [...arr];
  next[index] = value;
  return next;
}

export const useSlotStore = create<SlotStore>()(
  persist(
    (set, get) => ({
      weekly: emptySlots(),
      monthly: emptySlots(),

      saveToSlot: (mode, index) => {
        if (!inRange(index)) return;
        const snap = capture(mode);
        set(s => ({ [mode]: replaceAt(s[mode], index, snap) }) as Partial<SlotStore>);
      },

      loadSlot: (mode, index) => {
        if (!inRange(index)) return;
        const snap = get()[mode][index];
        if (snap) apply(snap);
      },

      deleteSlot: (mode, index) => {
        if (!inRange(index)) return;
        set(s => ({ [mode]: replaceAt(s[mode], index, null) }) as Partial<SlotStore>);
      },

      renameSlot: (mode, index, name) => {
        if (!inRange(index)) return;
        set(s => {
          const cur = s[mode][index];
          if (!cur) return {};
          return { [mode]: replaceAt(s[mode], index, { ...cur, name }) } as Partial<SlotStore>;
        });
      },
    }),
    {
      name: 'kb-chart-slots',
      version: 1,
      // 길이가 SLOT_COUNT가 아닌 영속 데이터는 보정.
      migrate: (persisted: unknown) => {
        const p = persisted as Partial<SlotStore> | undefined;
        const fix = (a?: SlotArray): SlotArray => {
          const base = emptySlots();
          if (Array.isArray(a)) for (let i = 0; i < SLOT_COUNT; i++) base[i] = a[i] ?? null;
          return base;
        };
        return { weekly: fix(p?.weekly), monthly: fix(p?.monthly) } as SlotStore;
      },
    },
  ),
);
