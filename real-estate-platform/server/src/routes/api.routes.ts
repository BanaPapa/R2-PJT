import { Router } from 'express';
import { KBDataCollectorService } from '../services/kb-data-collector.service.js';
import { IndexCalculatorService } from '../services/index-calculator.service.js';
import { RegionDataParamsSchema, UserSettingsSchema } from '../types/kb-data.types.js';

const router = Router();
const dataCollector = new KBDataCollectorService();
const indexCalculator = new IndexCalculatorService();

/**
 * KB 데이터 수동 수집 트리거
 */
router.post('/collect-data', async (req, res) => {
  try {
    const result = await dataCollector.collectData();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '데이터 수집 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 지역별 시계열 데이터 조회 (동적 기준일 적용)
 */
router.get('/regions/:regionCode/timeseries', async (req, res) => {
  try {
    const { regionCode } = req.params;
    const {
      startDate,
      endDate,
      useCustomBase,
      basePeriodYears
    } = req.query;

    // 파라미터 검증
    const params = RegionDataParamsSchema.parse({
      regionCode,
      startDate: startDate as string,
      endDate: endDate as string,
      useCustomBase: useCustomBase === 'true',
      basePeriodYears: basePeriodYears ? parseInt(basePeriodYears as string) : undefined
    });

    const result = await indexCalculator.recalculateIndexes(params);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '잘못된 요청입니다.'
    });
  }
});

/**
 * 지역별 최신 통계 조회
 */
router.get('/regions/:regionCode/statistics', async (req, res) => {
  try {
    const { regionCode } = req.params;
    const result = await indexCalculator.getRegionStatistics(regionCode);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '통계 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 사용자 설정 조회
 */
router.get('/settings', async (req, res) => {
  try {
    // IndexCalculatorService의 private 메서드를 public으로 만들거나 별도 서비스 생성
    res.json({
      success: true,
      data: {
        basePeriodYears: 3,
        useCustomBase: true
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '설정 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 사용자 설정 업데이트
 */
router.put('/settings', async (req, res) => {
  try {
    const settings = UserSettingsSchema.parse(req.body);
    const result = await indexCalculator.updateUserSettings(settings);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '잘못된 설정 값입니다.'
    });
  }
});

/**
 * 데이터 수집 상태 조회
 */
router.get('/collection-status', async (req, res) => {
  try {
    const { hasNewData, fileName, week } = await dataCollector.checkForNewData();
    
    res.json({
      success: true,
      data: {
        hasNewData,
        fileName,
        week,
        lastCheck: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '상태 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 헬스체크
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'KB 부동산 데이터 서버가 정상 동작 중입니다.',
    timestamp: new Date().toISOString()
  });
});

export default router;