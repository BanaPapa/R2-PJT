import type { 
  RecalculatedIndex, 
  RegionStatistics, 
  DataCollectionStatus,
  ApiResponse 
} from '../model/kb-data.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class KBDataApiError extends Error {
  public status?: number;
  
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'KBDataApiError';
    this.status = status;
  }
}

export interface TimeSeriesParams {
  regionCode: string;
  startDate?: string;
  endDate?: string;
  useCustomBase?: boolean;
  basePeriodYears?: number;
}

export const kbDataApi = {
  /**
   * 지역별 시계열 데이터 조회 (동적 기준일 적용)
   */
  async getTimeSeries(params: TimeSeriesParams): Promise<RecalculatedIndex[]> {
    try {
      const searchParams = new URLSearchParams();
      
      if (params.startDate) searchParams.set('startDate', params.startDate);
      if (params.endDate) searchParams.set('endDate', params.endDate);
      if (params.useCustomBase !== undefined) searchParams.set('useCustomBase', params.useCustomBase.toString());
      if (params.basePeriodYears) searchParams.set('basePeriodYears', params.basePeriodYears.toString());

      const url = `${API_BASE_URL}/regions/${params.regionCode}/timeseries?${searchParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new KBDataApiError(
          `시계열 데이터 조회 실패: ${response.status}`,
          response.status
        );
      }

      const result: ApiResponse<RecalculatedIndex[]> = await response.json();
      
      if (!result.success) {
        throw new KBDataApiError(result.error || '시계열 데이터 조회에 실패했습니다.');
      }

      return result.data || [];
    } catch (error) {
      if (error instanceof KBDataApiError) {
        throw error;
      }
      throw new KBDataApiError('네트워크 오류가 발생했습니다.');
    }
  },

  /**
   * 지역별 최신 통계 조회
   */
  async getRegionStatistics(regionCode: string): Promise<RegionStatistics> {
    try {
      const response = await fetch(`${API_BASE_URL}/regions/${regionCode}/statistics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new KBDataApiError(
          `지역 통계 조회 실패: ${response.status}`,
          response.status
        );
      }

      const result: ApiResponse<RegionStatistics> = await response.json();
      
      if (!result.success) {
        throw new KBDataApiError(result.error || '지역 통계 조회에 실패했습니다.');
      }

      if (!result.data) {
        throw new KBDataApiError('통계 데이터가 없습니다.');
      }

      return result.data;
    } catch (error) {
      if (error instanceof KBDataApiError) {
        throw error;
      }
      throw new KBDataApiError('네트워크 오류가 발생했습니다.');
    }
  },

  /**
   * 데이터 수집 상태 확인
   */
  async getCollectionStatus(): Promise<DataCollectionStatus> {
    try {
      const response = await fetch(`${API_BASE_URL}/collection-status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new KBDataApiError(
          `수집 상태 조회 실패: ${response.status}`,
          response.status
        );
      }

      const result: ApiResponse<DataCollectionStatus> = await response.json();
      
      if (!result.success) {
        throw new KBDataApiError(result.error || '수집 상태 조회에 실패했습니다.');
      }

      if (!result.data) {
        throw new KBDataApiError('상태 데이터가 없습니다.');
      }

      return result.data;
    } catch (error) {
      if (error instanceof KBDataApiError) {
        throw error;
      }
      throw new KBDataApiError('네트워크 오류가 발생했습니다.');
    }
  },

  /**
   * 수동 데이터 수집 트리거
   */
  async triggerDataCollection(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/collect-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new KBDataApiError(
          `데이터 수집 실패: ${response.status}`,
          response.status
        );
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new KBDataApiError(result.error || '데이터 수집에 실패했습니다.');
      }
    } catch (error) {
      if (error instanceof KBDataApiError) {
        throw error;
      }
      throw new KBDataApiError('네트워크 오류가 발생했습니다.');
    }
  },

  /**
   * 서버 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('헬스체크 실패:', error);
      return false;
    }
  },
};