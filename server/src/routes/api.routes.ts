import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { collectWeekly, collectMonthly, getCollectionStatus } from '../services/data-collector.service.js';

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
 * GET /api/data/monthly?regions=서울특별시&dataType=housing&from=2023-01-01&to=2026-05-25
 */
router.get('/data/monthly', async (req, res) => {
  try {
    const { regions, dataType, from, to } = req.query as Record<string, string>;

    const regionList = regions ? regions.split(',').map(r => r.trim()).filter(Boolean) : [];

    const where: any = {};
    if (regionList.length > 0) {
      where.region = { in: regionList };
    }
    if (dataType) {
      where.dataType = dataType;
    }
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }

    const data = await prisma.monthlyData.findMany({
      where,
      orderBy: [{ region: 'asc' }, { date: 'asc' }],
    });

    res.json({ success: true, data });
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
      result = await collectMonthly('monthly-housing');
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
