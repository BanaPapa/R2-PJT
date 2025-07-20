import { z } from 'zod';

// KB 시계열 원본 데이터 스키마
export const KBRawDataSchema = z.object({
  week: z.string(),
  regionCode: z.string(),
  regionName: z.string(),
  saleIndex: z.number(),
  leaseIndex: z.number(),
  baseDate: z.string(),
});

export type KBRawData = z.infer<typeof KBRawDataSchema>;

// 재계산된 지수 데이터 스키마
export const RecalculatedIndexSchema = z.object({
  week: z.string(),
  regionCode: z.string(),
  regionName: z.string(),
  originalSaleIndex: z.number(),
  originalLeaseIndex: z.number(),
  recalculatedSaleIndex: z.number(),
  recalculatedLeaseIndex: z.number(),
  baseDate: z.string(),
  customBaseDate: z.string().optional(),
});

export type RecalculatedIndex = z.infer<typeof RecalculatedIndexSchema>;

// API 응답 스키마
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};

// 사용자 설정 스키마
export const UserSettingsSchema = z.object({
  basePeriodYears: z.number().min(1).max(10),
  useCustomBase: z.boolean(),
});

export type UserSettingsInput = z.infer<typeof UserSettingsSchema>;

// 지역별 데이터 조회 파라미터
export const RegionDataParamsSchema = z.object({
  regionCode: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  useCustomBase: z.boolean().optional(),
  basePeriodYears: z.number().optional(),
});

export type RegionDataParams = z.infer<typeof RegionDataParamsSchema>;