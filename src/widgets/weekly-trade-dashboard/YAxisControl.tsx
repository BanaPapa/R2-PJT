import React from 'react';

// Y축 드롭다운: 최소 0~100, 최대 0~200 (20단위)
const Y_MIN_OPTIONS = [0, 20, 40, 60, 80, 100];
const Y_MAX_OPTIONS = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200];

interface YAxisControlProps {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}

// 그래프 제목 우측에 두는 그래프별 Y축 범위 조정 컨트롤.
export const YAxisControl: React.FC<YAxisControlProps> = ({ min, max, onChange }) => (
  <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
    <span className="mr-0.5">Y</span>
    <select
      value={min}
      onChange={e => onChange(Number(e.target.value), max)}
      className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px] text-gray-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400"
    >
      {Y_MIN_OPTIONS.map(v => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
    <span>~</span>
    <select
      value={max}
      onChange={e => onChange(min, Number(e.target.value))}
      className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px] text-gray-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400"
    >
      {Y_MAX_OPTIONS.map(v => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
  </div>
);
