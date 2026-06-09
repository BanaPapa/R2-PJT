import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { collectWeekly, getCollectionStatus } from '../services/data-collector.service.js';
import { collectMonthlyFromFile } from '../services/monthly-collector.service.js';
import {
  getRegionTree,
  getTimeseries,
  getRegionCompare,
  isValidMetric,
} from '../services/monthly-region.service.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * Health check
 */
router.get('/health', (_req, res) => {
  res.json({ success: true, message: 'KB 부동산 데이터 서버 정상 동작 중', timestamp: new Date().toISOString() });
});

/**
 * Get unique region list
 */
router.get('/regions', async (_req, res) => {
  try {
    const rows = await prisma.weeklyData.findMany({
      select: { region: true },
      distinct: ['region'],
      orderBy: { region: 'asc' },
    });
    res.json({ success: true, data: rows.map(r => r.region) });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/data/weekly?regions=서울특별시,강남구&from=2023-01-01&to=2026-05-25
 */
router.get('/data/weekly', async (req, res) => {
  try {
    const { regions, from, to } = req.query as Record<string, string>;

    const regionList = regions ? regions.split(',').map(r => r.trim()).filter(Boolean) : [];

    const where: any = {};
    if (regionList.length > 0) {
      where.region = { in: regionList };
    }
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const data = await prisma.weeklyData.findMany({
      where,
      orderBy: [{ region: 'asc' }, { date: 'asc' }],
    });

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/monthly/regions - 계층형 지역 트리
 */
router.get('/monthly/regions', async (_req, res) => {
  try {
    const tree = await getRegionTree();
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/monthly/timeseries?regionPath=전국&metric=saleAptIndex
 * regionPath 콤마 구분으로 다중 지역 허용. 지역별 폴백 적용.
 */
router.get('/monthly/timeseries', async (req, res) => {
  try {
    const { regionPath, metric } = req.query as Record<string, string>;
    if (!regionPath || !metric || !isValidMetric(metric)) {
      res.status(400).json({ success: false, error: 'regionPath, metric(유효값) 필요' });
      return;
    }
    const paths = regionPath.split(',').map(p => p.trim()).filter(Boolean);
    const series = await Promise.all(
      paths.map(async p => {
        const result = await getTimeseries(p, metric);
        return { requestedPath: p, ...(result ?? { resolved: null, data: [] }) };
      }),
    );
    res.json({ success: true, data: series });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/monthly/region-compare?metric=saleAptIndex&parentPath=전국>서울특별시&date=2026-05
 */
router.get('/monthly/region-compare', async (req, res) => {
  try {
    const { metric, parentPath, date } = req.query as Record<string, string>;
    if (!parentPath || !metric || !isValidMetric(metric)) {
      res.status(400).json({ success: false, error: 'parentPath, metric(유효값) 필요' });
      return;
    }
    const result = await getRegionCompare(metric, parentPath, date || undefined);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/collection/status
 */
router.get('/collection/status', async (_req, res) => {
  try {
    const status = await getCollectionStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /api/collection/trigger - manually trigger collection
 */
router.post('/collection/trigger', async (req, res) => {
  try {
    const type = (req.body?.type as string) || 'weekly';

    let result;
    if (type === 'monthly') {
      result = await collectMonthlyFromFile();
    } else {
      result = await collectWeekly();
    }

    res.json({ success: result.success, message: result.message, recordCount: result.recordCount, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /api/collection/latest-date
 */
router.get('/collection/latest-date', async (_req, res) => {
  try {
    const row = await prisma.weeklyData.findFirst({
      orderBy: { date: 'desc' },
      select: { date: true },
    });
    res.json({ success: true, latestDate: row?.date ?? null });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
