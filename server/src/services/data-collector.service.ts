import { PrismaClient } from '@prisma/client';
import { getLatestFileInfo, downloadExcelFile } from './kb-api.service.js';
import { parseWeeklyExcel, type DataRow } from './excel-parser.service.js';

const prisma = new PrismaClient();

const BATCH_SIZE = 500;

function nullableFloat(v: number | undefined | null): string {
  if (v === undefined || v === null) return 'NULL';
  return v.toString();
}

async function bulkInsertWeekly(rows: DataRow[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    // Build VALUES string for batch
    const valueSets = batch.map(r => {
      const region = r.region.replace(/'/g, "''"); // escape single quotes
      return `('${r.date}', '${region}', ${nullableFloat(r.saleChange)}, ${nullableFloat(r.jeonseChange)}, ${nullableFloat(r.saleIndex)}, ${nullableFloat(r.jeonseIndex)}, ${nullableFloat(r.buyerAdvantage)}, ${nullableFloat(r.saleActivity)}, ${nullableFloat(r.jeonseSupply)}, ${nullableFloat(r.jeonseActivity)})`;
    });
    const sql = `INSERT OR IGNORE INTO weekly_data (date, region, saleChange, jeonseChange, saleIndex, jeonseIndex, buyerAdvantage, saleActivity, jeonseSupply, jeonseActivity) VALUES ${valueSets.join(', ')}`;
    const result = await prisma.$executeRawUnsafe(sql);
    total += result;
    if ((i / BATCH_SIZE) % 10 === 0) {
      console.log(`[Collector] Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} (${total} inserted)`);
    }
  }
  return total;
}

export async function collectWeekly(): Promise<{ success: boolean; message: string; recordCount?: number; error?: string }> {
  let logId: number | undefined;

  try {
    console.log('[Collector] Fetching weekly file info...');
    const fileInfo = await getLatestFileInfo('weekly');

    if (!fileInfo) {
      return { success: false, message: 'No file info returned from KB API' };
    }

    console.log(`[Collector] Latest weekly file: ${fileInfo.originalFileName}`);

    // Check if already collected
    const existing = await prisma.collectionLog.findFirst({
      where: { fileName: fileInfo.originalFileName, status: 'success', dataType: 'weekly' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      console.log('[Collector] Already collected:', fileInfo.originalFileName);
      return { success: true, message: `Already up to date: ${fileInfo.originalFileName}` };
    }

    // Create processing log
    const log = await prisma.collectionLog.create({
      data: { dataType: 'weekly', fileName: fileInfo.originalFileName, status: 'processing' },
    });
    logId = log.id;

    console.log('[Collector] Downloading Excel file...');
    const buffer = await downloadExcelFile(fileInfo);
    console.log(`[Collector] Downloaded ${buffer.length} bytes`);

    console.log('[Collector] Parsing Excel file...');
    const rows = parseWeeklyExcel(buffer);
    console.log(`[Collector] Parsed ${rows.length} rows`);

    const totalInserted = await bulkInsertWeekly(rows);
    console.log(`[Collector] Total inserted: ${totalInserted}`);

    await prisma.collectionLog.update({
      where: { id: logId },
      data: { status: 'success', recordCount: totalInserted },
    });

    return { success: true, message: `Collected ${totalInserted} new records from ${fileInfo.originalFileName}`, recordCount: totalInserted };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Collector] Error:', errMsg);

    if (logId !== undefined) {
      await prisma.collectionLog.update({
        where: { id: logId },
        data: { status: 'failed', errorMsg: errMsg },
      }).catch(() => {});
    }

    return { success: false, message: 'Collection failed', error: errMsg };
  }
}

export async function getCollectionStatus() {
  const logs = await prisma.collectionLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const latestWeekly = await prisma.weeklyData.findFirst({
    orderBy: { date: 'desc' },
    select: { date: true },
  });

  const totalRecords = await prisma.weeklyData.count();

  return {
    logs,
    latestDate: latestWeekly?.date ?? null,
    totalRecords,
  };
}
