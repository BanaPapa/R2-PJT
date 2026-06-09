import * as XLSX from 'xlsx';

/**
 * 월간 주택 시계열 파서.
 *
 * 5개 데이터 시트만 사용한다. 시트마다 헤더 구조가 다르다:
 *  - 매매APT/전세APT/㎡당매매/㎡당전세: 병합 2단 헤더(row1=그룹, row2=소지역[한글], row3=영문)
 *  - 아파트매매전세비: 평면 헤더(row1=지역[한글], row2=영문) + 2자리 연도 사용
 *
 * 따라서 가장 풍부한 시트(매매APT)에서 표준 계층(canonical)을 먼저 구축하고,
 * 모든 시트는 (시도, 지역명) 키로 표준 regionPath를 조회한다. → 시트 간 경로 일관성 보장.
 */

export type MonthlyMetric =
  | 'saleAptIndex'
  | 'jeonseAptIndex'
  | 'aptSaleJeonseRatio'
  | 'aptAvgSalePerM2'
  | 'aptAvgJeonsePerM2';

export interface MonthlyRow {
  date: string; // YYYY-MM
  regionPath: string;
  region: string;
  level: number;
  parentPath: string | null;
  saleAptIndex?: number | null;
  jeonseAptIndex?: number | null;
  aptSaleJeonseRatio?: number | null;
  aptAvgSalePerM2?: number | null;
  aptAvgJeonsePerM2?: number | null;
}

// 시트명 → 지표 필드. 매매APT(최다 지역)를 먼저 처리해 canonical 우선권 부여.
const SHEET_METRICS: ReadonlyArray<[string, MonthlyMetric]> = [
  ['2.매매APT', 'saleAptIndex'],
  ['6.전세APT', 'jeonseAptIndex'],
  ['47.㎡당아파트평균매매', 'aptAvgSalePerM2'],
  ['48.㎡당아파트평균전세', 'aptAvgJeonsePerM2'],
  ['28.아파트매매전세비', 'aptSaleJeonseRatio'],
];

const ROOT = '전국';

// 전국 직속 집계(권역) — 시도가 아닌 묶음. 자식 없음.
const AGGREGATE_REGIONS = new Set([
  '수도권',
  '6개광역시',
  '5개광역시(인천外)',
  '기타지방',
  '제주/서귀포',
]);

interface BlockInfo {
  path: string;
  region: string;
  level: number;
  parentPath: string | null;
}

interface ColumnRef {
  c: number;
  name: string;
  fromRow1: boolean;
}

function norm(value: unknown): string {
  if (value == null) return '';
  return String(value).replace(/\r?\n/g, '').trim();
}

function hangul(value: unknown): string | null {
  const s = norm(value);
  return s && /[가-힣]/.test(s) ? s : null;
}

function isSido(name: string): boolean {
  return /(특별시|광역시|특별자치시|도)$/.test(name);
}

function isAggregate(name: string): boolean {
  return AGGREGATE_REGIONS.has(name) || /개광역시/.test(name);
}

type RegionClass = 'root' | 'aggregate' | 'sido' | 'sub';

function classify(name: string): RegionClass {
  if (name === ROOT) return 'root';
  if (isAggregate(name)) return 'aggregate';
  if (isSido(name)) return 'sido';
  return 'sub';
}

// sub 지역 canonical 키 정규화: 시트 간 시(市) 접미사 표기 차이 흡수
// (예: "동두천" vs "동두천시", "의왕" vs "의왕시"). 시도/구는 영향 없음.
function keyName(name: string): string {
  return name.endsWith('시') ? name.slice(0, -1) : name;
}

/**
 * 한 시트의 데이터 컬럼 목록과 병합헤더 여부를 추출.
 * name = row1 한글값, 없으면(병합헤더일 때) row2 한글값.
 */
function getSheetColumns(rows: any[][]): { merged: boolean; cols: ColumnRef[] } {
  const r1 = rows[1] ?? [];
  const r2 = rows[2] ?? [];
  const width = Math.max(r1.length, r2.length);

  // row2에 한글이 있으면 병합헤더(소지역이 row2), 영문뿐이면 평면헤더
  let merged = false;
  for (let c = 1; c < width; c++) {
    if (hangul(r2[c])) { merged = true; break; }
  }

  const cols: ColumnRef[] = [];
  for (let c = 1; c < width; c++) {
    const n1 = hangul(r1[c]);
    if (n1) {
      cols.push({ c, name: n1, fromRow1: true });
    } else if (merged) {
      const n2 = hangul(r2[c]);
      if (n2) cols.push({ c, name: n2, fromRow1: false });
    }
  }
  return { merged, cols };
}

const rootBlock = (): BlockInfo => ({ path: ROOT, region: ROOT, level: 1, parentPath: null });

/**
 * 병합헤더 시트에서 표준 계층(sub 지역들)을 구축한다.
 * key = `${시도}|${지역명}` → BlockInfo (깊은 parentPath 포함)
 */
function buildCanonical(workbook: XLSX.WorkBook): Map<string, BlockInfo> {
  const canonical = new Map<string, BlockInfo>();

  for (const [sheetName] of SHEET_METRICS) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const { merged, cols } = getSheetColumns(rows);
    if (!merged) continue; // 평면 시트(28)는 계층 정보 없음 → 건너뜀

    let currentSido = rootBlock();
    let currentBlock = rootBlock();

    for (const { name, fromRow1 } of cols) {
      const cls = classify(name);
      if (cls === 'root') {
        currentSido = rootBlock();
        currentBlock = currentSido;
        continue;
      }
      if (cls === 'aggregate') {
        currentBlock = { path: `${ROOT}>${name}`, region: name, level: 2, parentPath: ROOT };
        continue;
      }
      if (cls === 'sido') {
        currentSido = { path: `${ROOT}>${name}`, region: name, level: 2, parentPath: ROOT };
        currentBlock = currentSido;
        continue;
      }
      // sub
      // 시(市)는 항상 시도의 직속 하위(구는 시의 하위가 될 수 있어도 시는 시의 하위가 될 수 없음).
      // 일부 시트는 형제 도시(예: 강릉시)를 row2에 잘못 배치하므로 이름 기준으로 보정.
      // row1 블록(강북14개구 등)도 시도 직속.
      let blk: BlockInfo;
      const isCity = name.endsWith('시');
      if (isCity || fromRow1) {
        blk = {
          path: `${currentSido.path}>${name}`,
          region: name,
          level: currentSido.level + 1,
          parentPath: currentSido.path,
        };
        currentBlock = blk;
      } else {
        // row2 소지역(예: 장안구, 기장군) → 직전 블록의 하위
        blk = {
          path: `${currentBlock.path}>${name}`,
          region: name,
          level: currentBlock.level + 1,
          parentPath: currentBlock.path,
        };
      }
      const key = `${currentSido.region}|${keyName(name)}`;
      if (!canonical.has(key)) canonical.set(key, blk);
    }
  }
  return canonical;
}

/**
 * 시트 컬럼들을 표준 경로로 해석. sub 지역은 canonical 조회.
 */
function resolveColumns(cols: ColumnRef[], canonical: Map<string, BlockInfo>): Map<number, BlockInfo> {
  const map = new Map<number, BlockInfo>();
  let currentSido = rootBlock();

  for (const { c, name } of cols) {
    const cls = classify(name);
    if (cls === 'root') {
      const info = rootBlock();
      currentSido = info;
      map.set(c, info);
    } else if (cls === 'aggregate') {
      map.set(c, { path: `${ROOT}>${name}`, region: name, level: 2, parentPath: ROOT });
    } else if (cls === 'sido') {
      currentSido = { path: `${ROOT}>${name}`, region: name, level: 2, parentPath: ROOT };
      map.set(c, currentSido);
    } else {
      const key = `${currentSido.region}|${keyName(name)}`;
      let info = canonical.get(key);
      if (!info) {
        info = {
          path: `${currentSido.path}>${name}`,
          region: name,
          level: currentSido.level + 1,
          parentPath: currentSido.path,
        };
        console.warn(`[MonthlyParser] canonical 미존재: ${key} → 임시경로 ${info.path}`);
      }
      map.set(c, info);
    }
  }
  return map;
}

interface DateContext {
  year: number | null;
}

function expandYear(intPart: number): number {
  if (intPart >= 100) return intPart; // 2013, 2026
  if (intPart >= 50) return 1900 + intPart; // 86→1986, 99→1999
  return 2000 + intPart; // 0→2000, 13→2013, 25→2025
}

/**
 * 날짜 마커 파싱.
 * - 소수부가 있으면 연도.월 마커 (예: 86.1, '99.1, 2013.4, '13.4) → 연도 갱신
 * - 정수 1..12 → 직전 연도의 해당 월
 * - 각주/빈값/그 외 → null
 */
function parseDateMarker(raw: unknown, ctx: DateContext): string | null {
  if (raw == null) return null;
  let v: number;
  if (typeof raw === 'number') {
    v = raw;
  } else {
    const cleaned = String(raw).replace(/'/g, '').trim();
    if (!/^\d/.test(cleaned)) return null;
    v = parseFloat(cleaned);
  }
  if (isNaN(v)) return null;

  const intPart = Math.floor(v);
  const frac = v - intPart;

  if (frac > 0.001) {
    // 연도.월 마커
    const year = expandYear(intPart);
    let month = Math.round(frac * 10);
    if (month < 1 || month > 12) month = 1;
    ctx.year = year;
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  if (intPart >= 1 && intPart <= 12) {
    if (ctx.year == null) return null;
    return `${ctx.year}-${String(intPart).padStart(2, '0')}`;
  }

  return null;
}

function parseSheetData(
  rows: any[][],
  colMap: Map<number, BlockInfo>,
  metric: MonthlyMetric,
  out: Map<string, MonthlyRow>,
): number {
  const ctx: DateContext = { year: null };
  let count = 0;
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const date = parseDateMarker(row[0], ctx);
    if (!date) continue;

    for (const [c, info] of colMap) {
      const raw = row[c];
      const value = typeof raw === 'number' && !isNaN(raw) ? raw : null;
      if (value === null) continue;

      const key = `${date}|${info.path}`;
      let mr = out.get(key);
      if (!mr) {
        mr = {
          date,
          regionPath: info.path,
          region: info.region,
          level: info.level,
          parentPath: info.parentPath,
        };
        out.set(key, mr);
      }
      mr[metric] = value;
      count++;
    }
  }
  return count;
}

export function parseMonthlyExcel(buffer: Buffer): MonthlyRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  const canonical = buildCanonical(workbook);
  console.log(`[MonthlyParser] canonical 지역 ${canonical.size}개 구축`);

  const out = new Map<string, MonthlyRow>();

  for (const [sheetName, metric] of SHEET_METRICS) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.warn(`[MonthlyParser] Sheet not found: ${sheetName}`);
      continue;
    }
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const { cols } = getSheetColumns(rows);
    const colMap = resolveColumns(cols, canonical);
    const n = parseSheetData(rows, colMap, metric, out);
    console.log(`[MonthlyParser] ${sheetName} → ${n} values (${colMap.size} cols)`);
  }

  return Array.from(out.values());
}
