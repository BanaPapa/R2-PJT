// MVP Configuration
export const MVP_CONFIG = {
  // Sample regions for MVP
  SAMPLE_REGIONS: [
    { id: 'seoul', name: '서울시', level: 1 },
    { id: 'busan', name: '부산시', level: 1 },
    { id: 'incheon', name: '인천시', level: 1 },
    { id: 'daegu', name: '대구시', level: 1 },
  ],
  
  // Sample data points per region
  DATA_POINTS_PER_REGION: 30, // 30 months of data (2023.01 ~ 2025.07)
  
  // Chart configuration
  CHART: {
    height: 400,
    margin: { top: 20, right: 30, left: 20, bottom: 5 },
    colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'],
  },
  
  // UI Settings
  UI: {
    MAX_REGIONS: 4, // 1 base + 3 comparison
    MOBILE_BREAKPOINT: 768,
  }
} as const;

export type Region = {
  id: string;
  name: string;
  level: number;
};

export type PriceData = {
  date: string;
  priceIndex: number;
  regionId: string;
};