import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const MONTHLY_METRICS = [
  'saleAptIndex',
  'jeonseAptIndex',
  'aptSaleJeonseRatio',
  'aptAvgSalePerM2',
  'aptAvgJeonsePerM2',
] as const;
export type MonthlyMetric = (typeof MONTHLY_METRICS)[number];

export function isValidMetric(m: string): m is MonthlyMetric {
  return (MONTHLY_METRICS as readonly string[]).includes(m);
}

export interface RegionNode {
  regionPath: string;
  region: string;
  level: number;
  parentPath: string | null;
  children: RegionNode[];
}

interface RegionRow {
  regionPath: string;
  region: string;
  level: number;
  parentPath: string | null;
}

/**
 * monthly_data의 distinct 지역으로 계층 트리를 구성한다.
 */
export async function getRegionTree(): Promise<RegionNode[]> {
  const rows = await prisma.$queryRawUnsafe<RegionRow[]>(
    `SELECT DISTINCT regionPath, region, level, parentPath FROM monthly_data ORDER BY level ASC, regionPath ASC`,
  );

  const map = new Map<string, RegionNode>();
  for (const r of rows) {
    map.set(r.regionPath, { ...r, children: [] });
  }

  const roots: RegionNode[] = [];
  for (const node of map.values()) {
    if (node.parentPath && map.has(node.parentPath)) {
      map.get(node.parentPath)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

interface ResolveRow {
  region: string;
  level: number;
  parentPath: string | null;
  cnt: number | bigint;
}

export interface ResolvedRegion {
  requestedPath: string;
  resolvedPath: string;
  resolvedRegion: string;
  resolvedLevel: number;
  fallback: boolean; // 요청한 지역과 달라졌는지
}

/**
 * 지정 지역에 해당 지표 데이터가 없으면 상위(parentPath)로 올라가며 첫 데이터 보유 지역을 찾는다.
 */
export async function resolveRegionForMetric(
  regionPath: string,
  metric: MonthlyMetric,
): Promise<ResolvedRegion | null> {
  let current: string | null = regionPath;
  const visited = new Set<string>();

  while (current && !visited.has(current)) {
    visited.add(current);
    const rows: ResolveRow[] = await prisma.$queryRawUnsafe<ResolveRow[]>(
      `SELECT region, level, parentPath, COUNT(${metric}) AS cnt FROM monthly_data WHERE regionPath = ? GROUP BY regionPath`,
      current,
    );
    const row: ResolveRow | undefined = rows[0];
    if (!row) return null;
    if (Number(row.cnt) > 0) {
      return {
        requestedPath: regionPath,
        resolvedPath: current,
        resolvedRegion: row.region,
        resolvedLevel: row.level,
        fallback: current !== regionPath,
      };
    }
    current = row.parentPath;
  }
  return null;
}

export interface TimeseriesPoint {
  date: string;
  value: number | null;
}

export async function getTimeseries(
  regionPath: string,
  metric: MonthlyMetric,
): Promise<{ resolved: ResolvedRegion; data: TimeseriesPoint[] } | null> {
  const resolved = await resolveRegionForMetric(regionPath, metric);
  if (!resolved) return null;

  const rows = await prisma.$queryRawUnsafe<{ date: string; value: number | null }[]>(
    `SELECT date, ${metric} AS value FROM monthly_data WHERE regionPath = ? AND ${metric} IS NOT NULL ORDER BY date ASC`,
    resolved.resolvedPath,
  );
  return { resolved, data: rows };
}

export interface RegionCompareItem {
  regionPath: string;
  region: string;
  prev: number | null;
  curr: number | null;
  change: number | null; // 증감률(%) 또는 단순 변화 (지수/비율은 %p성격, 가격은 % 변화)
}

function prevMonth(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const d = new Date(y!, m! - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 특정 상위 지역(parentPath)의 직계 하위 지역들을 한 지표로 비교.
 * date 미지정 시 해당 지표의 최신월 사용.
 */
export async function getRegionCompare(
  metric: MonthlyMetric,
  parentPath: string,
  date?: string,
): Promise<{ date: string; prevDate: string; items: RegionCompareItem[] }> {
  let targetDate = date;
  if (!targetDate) {
    const latest = await prisma.$queryRawUnsafe<{ d: string }[]>(
      `SELECT MAX(date) AS d FROM monthly_data WHERE parentPath = ? AND ${metric} IS NOT NULL`,
      parentPath,
    );
    targetDate = latest[0]?.d ?? '';
  }
  if (!targetDate) return { date: '', prevDate: '', items: [] };

  const prev = prevMonth(targetDate);

  const rows = await prisma.$queryRawUnsafe<
    { regionPath: string; region: string; date: string; value: number | null }[]
  >(
    `SELECT regionPath, region, date, ${metric} AS value FROM monthly_data
     WHERE parentPath = ? AND date IN (?, ?) AND ${metric} IS NOT NULL
     ORDER BY regionPath ASC`,
    parentPath,
    targetDate,
    prev,
  );

  const byRegion = new Map<string, RegionCompareItem>();
  for (const r of rows) {
    let item = byRegion.get(r.regionPath);
    if (!item) {
      item = { regionPath: r.regionPath, region: r.region, prev: null, curr: null, change: null };
      byRegion.set(r.regionPath, item);
    }
    if (r.date === targetDate) item.curr = r.value;
    else if (r.date === prev) item.prev = r.value;
  }

  for (const item of byRegion.values()) {
    if (item.prev != null && item.curr != null && item.prev !== 0) {
      item.change = ((item.curr - item.prev) / item.prev) * 100;
    }
  }

  const items = Array.from(byRegion.values()).sort(
    (a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity),
  );
  return { date: targetDate, prevDate: prev, items };
}
