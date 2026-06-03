export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const CHART_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
];

export const MAX_REGIONS = 5;

export const METRICS = [
  { key: 'saleIndex', label: '매매지수', unit: '' },
  { key: 'jeonseIndex', label: '전세지수', unit: '' },
  { key: 'saleChange', label: '매매증감', unit: '%' },
  { key: 'jeonseChange', label: '전세증감', unit: '%' },
  { key: 'buyerAdvantage', label: '매수우위지수', unit: '' },
  { key: 'saleActivity', label: '매매거래활발', unit: '' },
  { key: 'jeonseSupply', label: '전세수급지수', unit: '' },
  { key: 'jeonseActivity', label: '전세거래활발', unit: '' },
] as const;

export type MetricKey = typeof METRICS[number]['key'];

// Region groupings
export const REGION_GROUPS: Record<string, string[]> = {
  '전국': ['전국'],
  '서울': ['서울특별시', '강북14개구', '강남11개구'],
  '수도권': ['경기도', '인천광역시', '수도권'],
  '6대광역시': ['6개광역시', '부산광역시', '대구광역시', '광주광역시', '대전광역시', '울산광역시'],
  '세종/기타': ['세종특별자치시', '기타지방'],
};
