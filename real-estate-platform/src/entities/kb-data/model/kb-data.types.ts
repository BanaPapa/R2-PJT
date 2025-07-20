export interface KBRawData {
  week: string;
  regionCode: string;
  regionName: string;
  saleIndex: number;
  leaseIndex: number;
  baseDate: string;
}

export interface RecalculatedIndex {
  week: string;
  regionCode: string;
  regionName: string;
  originalSaleIndex: number;
  originalLeaseIndex: number;
  recalculatedSaleIndex: number;
  recalculatedLeaseIndex: number;
  baseDate: string;
  customBaseDate?: string;
}

export interface RegionStatistics {
  regionCode: string;
  regionName: string;
  week: string;
  saleIndex: number;
  leaseIndex: number;
  saleChangeRate: number;
  leaseChangeRate: number;
}

export interface DataCollectionStatus {
  hasNewData: boolean;
  fileName?: string;
  week?: string;
  lastCheck: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}