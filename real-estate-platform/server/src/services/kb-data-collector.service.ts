import axios from 'axios';
import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import path from 'path';
import { format, addWeeks, parseISO } from 'date-fns';
import { PrismaClient } from '@prisma/client';
import type { KBRawData, ApiResponse } from '../types/kb-data.types.js';

const prisma = new PrismaClient();

export class KBDataCollectorService {
  private readonly KB_STATS_URL = 'https://www.kbland.kr/webview.html#/main/statistics?channel=kbland&tab=0';
  private readonly DATA_DIR = './data';
  
  constructor() {
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.DATA_DIR);
    } catch {
      await fs.mkdir(this.DATA_DIR, { recursive: true });
    }
  }

  /**
   * KB 통계 사이트에서 최신 파일 정보 확인
   */
  async checkForNewData(): Promise<{ hasNewData: boolean; fileName?: string; week?: string }> {
    try {
      // 현재 주차 계산 (월요일 기준)
      const now = new Date();
      const currentWeek = this.getCurrentWeek(now);
      
      // 데이터베이스에서 해당 주차 데이터 존재 여부 확인
      const existingLog = await prisma.dataCollectionLog.findFirst({
        where: {
          week: currentWeek,
          status: 'SUCCESS'
        }
      });

      if (existingLog) {
        return { hasNewData: false };
      }

      // 예상 파일명 생성 (KB 패턴: YYYYMMDD_주간시계열.xlsx)
      const fileName = `${currentWeek}_주간시계열.xlsx`;
      
      return {
        hasNewData: true,
        fileName,
        week: currentWeek
      };
    } catch (error) {
      console.error('새 데이터 확인 중 오류:', error);
      throw error;
    }
  }

  /**
   * 현재 주차 문자열 반환 (YYYYMMDD 형식, 월요일 기준)
   */
  private getCurrentWeek(date: Date): string {
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(date);
    monday.setDate(date.getDate() + daysToMonday);
    return format(monday, 'yyyyMMdd');
  }

  /**
   * KB 엑셀 파일 다운로드 (시뮬레이션)
   * 실제로는 브라우저 자동화나 직접 다운로드 링크가 필요
   */
  async downloadExcelFile(fileName: string): Promise<string> {
    try {
      console.log(`KB 사이트에서 ${fileName} 다운로드 시도...`);
      
      // TODO: 실제 구현에서는 playwright나 puppeteer로 파일 다운로드
      // 현재는 샘플 데이터로 대체
      const filePath = path.join(this.DATA_DIR, fileName);
      
      // 샘플 엑셀 데이터 생성 (실제로는 다운로드된 파일 사용)
      await this.createSampleExcelFile(filePath);
      
      console.log(`파일 다운로드 완료: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('파일 다운로드 중 오류:', error);
      throw error;
    }
  }

  /**
   * 엑셀 파일 파싱 및 데이터 추출
   */
  async parseExcelFile(filePath: string): Promise<KBRawData[]> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // JSON으로 변환
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // 데이터 파싱 (KB 엑셀 구조에 맞게 조정 필요)
      const parsedData: KBRawData[] = [];
      
      // 헤더 행 스킵하고 데이터 파싱
      for (let i = 2; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (row.length >= 4) {
          const data: KBRawData = {
            week: this.formatWeekString(row[0]),
            regionCode: String(row[1]),
            regionName: String(row[2]),
            saleIndex: Number(row[3]) || 0,
            leaseIndex: Number(row[4]) || 0,
            baseDate: '2022.1.10' // KB 기본 기준일
          };
          parsedData.push(data);
        }
      }
      
      return parsedData;
    } catch (error) {
      console.error('엑셀 파일 파싱 중 오류:', error);
      throw error;
    }
  }

  /**
   * 파싱된 데이터를 데이터베이스에 저장
   */
  async saveToDatabase(data: KBRawData[], week: string, fileName: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // 기존 데이터 삭제 (같은 주차)
        await tx.kBTimeSeries.deleteMany({
          where: { week }
        });

        // 새 데이터 삽입
        for (const item of data) {
          await tx.kBTimeSeries.create({
            data: {
              week: item.week,
              regionCode: item.regionCode,
              regionName: item.regionName,
              saleIndex: item.saleIndex,
              leaseIndex: item.leaseIndex,
              baseDate: item.baseDate,
              dataSource: fileName
            }
          });
        }

        // 수집 로그 저장
        await tx.dataCollectionLog.create({
          data: {
            week,
            fileName,
            status: 'SUCCESS',
            recordCount: data.length
          }
        });
      });

      console.log(`데이터베이스에 ${data.length}개 레코드 저장 완료`);
    } catch (error) {
      console.error('데이터베이스 저장 중 오류:', error);
      
      // 실패 로그 저장
      await prisma.dataCollectionLog.create({
        data: {
          week,
          fileName,
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : '알 수 없는 오류'
        }
      });
      
      throw error;
    }
  }

  /**
   * 전체 데이터 수집 프로세스 실행
   */
  async collectData(): Promise<ApiResponse> {
    try {
      const { hasNewData, fileName, week } = await this.checkForNewData();
      
      if (!hasNewData) {
        return {
          success: true,
          message: '최신 데이터가 이미 존재합니다.'
        };
      }

      if (!fileName || !week) {
        return {
          success: false,
          error: '파일명 또는 주차 정보를 가져올 수 없습니다.'
        };
      }

      // 처리 중 상태 로그 생성
      await prisma.dataCollectionLog.create({
        data: {
          week,
          fileName,
          status: 'PROCESSING'
        }
      });

      // 파일 다운로드
      const filePath = await this.downloadExcelFile(fileName);
      
      // 파일 파싱
      const parsedData = await this.parseExcelFile(filePath);
      
      // 데이터베이스 저장
      await this.saveToDatabase(parsedData, week, fileName);
      
      return {
        success: true,
        data: {
          week,
          fileName,
          recordCount: parsedData.length
        },
        message: '데이터 수집이 완료되었습니다.'
      };
    } catch (error) {
      console.error('데이터 수집 중 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '데이터 수집 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 샘플 엑셀 파일 생성 (테스트용)
   */
  private async createSampleExcelFile(filePath: string): Promise<void> {
    const sampleData = [
      ['주차', '지역코드', '지역명', '매매지수', '전세지수'],
      ['20250714', '11110', '종로구', 102.5, 98.3],
      ['20250714', '11140', '중구', 105.2, 101.7],
      ['20250714', '11170', '용산구', 108.9, 104.2],
      ['20250714', '11200', '성동구', 98.7, 95.8],
      // 더 많은 샘플 데이터...
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, filePath);
  }

  /**
   * 주차 문자열 포맷 정규화
   */
  private formatWeekString(week: any): string {
    const weekStr = String(week);
    if (weekStr.length === 8) {
      return weekStr;
    }
    // 필요에 따라 다른 포맷 처리
    return format(new Date(), 'yyyyMMdd');
  }
}