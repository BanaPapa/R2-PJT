import { promises as fs } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { parseMonthlyExcel, type MonthlyRow } from './monthly-excel-parser.service.js';

const prisma = new PrismaClient();

const BATCH_SIZE = 500;
const DEFAULT_MONTHLY_FILE = path.resolve('./data/202605_월간 주택 시계열.xlsx');

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlFloat(v: number | null | undefined): string {
  if (v === undefined || v === null || isNaN(v)) return 'NULL';
  return v.toString();
}

async function bulkUpsertMonthly(rows: MonthlyRow[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const valueSets = batch.map(r =>
      `(${sqlStr(r.date)}, ${sqlStr(r.regionPath)}, ${sqlStr(r.region)}, ${r.level}, ${r.parentPath ? sqlStr(r.parentPath) : 'NULL'}, ` +
      `${sqlFloat(r.saleAptIndex)}, ${sqlFloat(r.jeonseAptIndex)}, ${sqlFloat(r.aptSaleJeonseRatio)}, ${sqlFloat(r.aptAvgSalePerM2)}, ${sqlFloat(r.aptAvgJeonsePerM2)})`,
    );
    const sql =
      `INSERT OR REPLACE INTO monthly_data ` +
      `(date, regionPath, region, level, parentPath, saleAptIndex, jeonseAptIndex, aptSaleJeonseRatio, aptAvgSalePerM2, aptAvgJeonsePerM2) ` +
      `VALUES ${valueSets.join(', ')}`;
    const result = await prisma.$executeRawUnsafe(sql);
    total += result;
  }
  return total;
}

/**
 * 로컬 월간 엑셀 파일을 읽어 파싱·적재한다.
 */
export async function collectMonthlyFromFile(
  filePath: string = DEFAULT_MONTHLY_FILE,
): Promise<{ success: boolean; message: string; recordCount?: number; error?: string }> {
  let logId: number | undefined;
  const fileName = path.basename(filePath);

  try {
    const buffer = await fs.readFile(filePath);

    const log = await prisma.collectionLog.create({
      data: { dataType: 'monthly-housing', fileName, status: 'processing' },
    });
    logId = log.id;

    console.log(`[MonthlyCollector] Parsing ${fileName} (${buffer.length} bytes)...`);
    const rows = parseMonthlyExcel(buffer);
    console.log(`[MonthlyCollector] Parsed ${rows.length} (date,region) rows`);

    const inserted = await bulkUpsertMonthly(rows);
    console.log(`[MonthlyCollector] Upserted ${inserted} rows`);

    await prisma.collectionLog.update({
      where: { id: logId },
      data: { status: 'success', recordCount: inserted },
    });

    return { success: true, message: `Collected ${inserted} monthly records from ${fileName}`, recordCount: inserted };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[MonthlyCollector] Error:', errMsg);
    if (logId !== undefined) {
      await prisma.collectionLog
        .update({ where: { id: logId }, data: { status: 'failed', errorMsg: errMsg } })
        .catch(() => {});
    }
    return { success: false, message: 'Monthly collection failed', error: errMsg };
  }
}
