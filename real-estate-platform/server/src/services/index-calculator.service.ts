import { PrismaClient } from '@prisma/client';
import { subYears, format, parseISO } from 'date-fns';
import type { RecalculatedIndex, RegionDataParams, ApiResponse } from '../types/kb-data.types.js';

const prisma = new PrismaClient();

export class IndexCalculatorService {
  
  /**
   * 동적 기준일 기반 지수 재계산
   */
  async recalculateIndexes(params: RegionDataParams): Promise<ApiResponse<RecalculatedIndex[]>> {
    try {
      const {
        regionCode,
        startDate,
        endDate,
        useCustomBase = true,
        basePeriodYears = 3
      } = params;

      // 기본 설정 조회
      const userSettings = await this.getUserSettings();
      const finalUseCustomBase = useCustomBase ?? userSettings.useCustomBase;
      const finalBasePeriodYears = basePeriodYears ?? userSettings.basePeriodYears;

      // 지역별 시계열 데이터 조회
      const timeSeriesData = await this.getTimeSeriesData(regionCode, startDate, endDate);
      
      if (timeSeriesData.length === 0) {
        return {
          success: false,
          error: '해당 조건의 데이터가 존재하지 않습니다.'
        };
      }

      let recalculatedData: RecalculatedIndex[];

      if (finalUseCustomBase) {
        // 동적 기준일 사용: 검색 기준일에서 N년 전을 100으로 설정
        recalculatedData = await this.calculateWithCustomBase(
          timeSeriesData, 
          finalBasePeriodYears, 
          endDate
        );
      } else {
        // 원본 기준일 사용: KB 원본 지수 그대로 사용
        recalculatedData = timeSeriesData.map(item => ({
          week: item.week,
          regionCode: item.regionCode,
          regionName: item.regionName,
          originalSaleIndex: item.saleIndex,
          originalLeaseIndex: item.leaseIndex,
          recalculatedSaleIndex: item.saleIndex,
          recalculatedLeaseIndex: item.leaseIndex,
          baseDate: item.baseDate,
        }));
      }

      return {
        success: true,
        data: recalculatedData,
        message: `${recalculatedData.length}개의 레코드를 처리했습니다.`
      };
    } catch (error) {
      console.error('지수 재계산 중 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '지수 재계산 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 동적 기준일 기반 지수 계산
   */
  private async calculateWithCustomBase(
    timeSeriesData: any[], 
    basePeriodYears: number, 
    searchDate?: string
  ): Promise<RecalculatedIndex[]> {
    try {
      // 검색 기준일 설정 (없으면 최신 데이터 날짜 사용)
      const referenceDate = searchDate ? parseISO(searchDate) : new Date();
      
      // N년 전 날짜 계산
      const baseDate = subYears(referenceDate, basePeriodYears);
      const baseDateStr = format(baseDate, 'yyyyMMdd');

      // 기준일에 가장 가까운 데이터 찾기
      const baseData = this.findClosestData(timeSeriesData, baseDateStr);
      
      if (!baseData) {
        throw new Error(`기준일(${baseDateStr}) 주변의 데이터를 찾을 수 없습니다.`);
      }

      // 기준 지수값 (100으로 설정할 값)
      const baseSaleIndex = baseData.saleIndex;
      const baseLeaseIndex = baseData.leaseIndex;
      
      const customBaseDate = format(baseDate, 'yyyy.M.d');

      // 모든 데이터를 기준일 기준으로 재계산
      const recalculatedData: RecalculatedIndex[] = timeSeriesData.map(item => ({
        week: item.week,
        regionCode: item.regionCode,
        regionName: item.regionName,
        originalSaleIndex: item.saleIndex,
        originalLeaseIndex: item.leaseIndex,
        recalculatedSaleIndex: (item.saleIndex / baseSaleIndex) * 100,
        recalculatedLeaseIndex: (item.leaseIndex / baseLeaseIndex) * 100,
        baseDate: item.baseDate,
        customBaseDate
      }));

      return recalculatedData;
    } catch (error) {
      console.error('동적 기준일 계산 중 오류:', error);
      throw error;
    }
  }

  /**
   * 특정 날짜에 가장 가까운 데이터 찾기
   */
  private findClosestData(timeSeriesData: any[], targetDate: string) {
    return timeSeriesData.reduce((closest, current) => {
      if (!closest) return current;
      
      const closestDiff = Math.abs(parseInt(closest.week) - parseInt(targetDate));
      const currentDiff = Math.abs(parseInt(current.week) - parseInt(targetDate));
      
      return currentDiff < closestDiff ? current : closest;
    }, null);
  }

  /**
   * 시계열 데이터 조회
   */
  private async getTimeSeriesData(regionCode: string, startDate?: string, endDate?: string) {
    const whereCondition: any = { regionCode };
    
    if (startDate && endDate) {
      whereCondition.week = {
        gte: format(parseISO(startDate), 'yyyyMMdd'),
        lte: format(parseISO(endDate), 'yyyyMMdd')
      };
    }

    return await prisma.kBTimeSeries.findMany({
      where: whereCondition,
      orderBy: { week: 'asc' }
    });
  }

  /**
   * 사용자 설정 조회
   */
  private async getUserSettings() {
    let settings = await prisma.userSettings.findUnique({
      where: { userId: 'default' }
    });

    if (!settings) {
      // 기본 설정 생성
      settings = await prisma.userSettings.create({
        data: {
          userId: 'default',
          basePeriodYears: 3,
          useCustomBase: true
        }
      });
    }

    return settings;
  }

  /**
   * 사용자 설정 업데이트
   */
  async updateUserSettings(settings: { basePeriodYears: number; useCustomBase: boolean }): Promise<ApiResponse> {
    try {
      await prisma.userSettings.upsert({
        where: { userId: 'default' },
        update: settings,
        create: {
          userId: 'default',
          ...settings
        }
      });

      return {
        success: true,
        message: '설정이 업데이트되었습니다.'
      };
    } catch (error) {
      console.error('설정 업데이트 중 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '설정 업데이트 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 지역별 최신 통계 조회
   */
  async getRegionStatistics(regionCode: string): Promise<ApiResponse> {
    try {
      const latestData = await prisma.kBTimeSeries.findFirst({
        where: { regionCode },
        orderBy: { week: 'desc' }
      });

      if (!latestData) {
        return {
          success: false,
          error: '해당 지역의 데이터가 존재하지 않습니다.'
        };
      }

      // 이전 주 데이터 조회 (변화율 계산용)
      const previousData = await prisma.kBTimeSeries.findFirst({
        where: { 
          regionCode,
          week: { lt: latestData.week }
        },
        orderBy: { week: 'desc' }
      });

      const statistics = {
        regionCode: latestData.regionCode,
        regionName: latestData.regionName,
        week: latestData.week,
        saleIndex: latestData.saleIndex,
        leaseIndex: latestData.leaseIndex,
        saleChangeRate: previousData ? 
          ((latestData.saleIndex - previousData.saleIndex) / previousData.saleIndex * 100) : 0,
        leaseChangeRate: previousData ? 
          ((latestData.leaseIndex - previousData.leaseIndex) / previousData.leaseIndex * 100) : 0,
      };

      return {
        success: true,
        data: statistics
      };
    } catch (error) {
      console.error('지역 통계 조회 중 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '통계 조회 중 오류가 발생했습니다.'
      };
    }
  }
}