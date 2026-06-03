import * as XLSX from 'xlsx';

export interface DataRow {
  date: string;
  region: string;
  saleChange?: number;
  jeonseChange?: number;
  saleIndex?: number;
  jeonseIndex?: number;
  buyerAdvantage?: number;
  saleActivity?: number;
  jeonseSupply?: number;
  jeonseActivity?: number;
}

type SheetField = keyof Omit<DataRow, 'date' | 'region'>;

// Sheets 1-4: simple structure (row1=Korean headers, row3+=data)
const SIMPLE_SHEETS: Record<string, SheetField> = {
  '1.매매증감': 'saleChange',
  '2.전세증감': 'jeonseChange',
  '3.매매지수': 'saleIndex',
  '4.전세지수': 'jeonseIndex',
};

// Sheets 5-8: grouped structure (3 cols per region, target is 3rd col)
const GROUPED_SHEETS: Record<string, { field: SheetField; targetMetric: string }> = {
  '5.매수우위':    { field: 'buyerAdvantage', targetMetric: '매수우위지수' },
  '6.매매거래활발': { field: 'saleActivity',   targetMetric: '매매거래활발지수' },
  '7.전세수급':    { field: 'jeonseSupply',    targetMetric: '전세수급지수' },
  '8.전세거래활발': { field: 'jeonseActivity',  targetMetric: '전세거래활발지수' },
};

function excelSerialToDate(serial: number): string | null {
  if (typeof serial !== 'number' || isNaN(serial) || serial <= 0) return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  if (isNaN(date.getTime())) return null;
  const parts = date.toISOString().split('T');
  return parts[0] ?? null;
}

// Strip English suffix from combined names like "서울특별시 Seoul", "5개광역시 5 Large Cities"
function normalizeRegionName(name: any): string {
  if (name == null) return '';
  const str = String(name).trim();
  // Tokenize by spaces, keep only leading tokens that contain at least one Korean character
  // Stop at the first token that is purely ASCII or a lone digit before ASCII
  const tokens = str.split(/\s+/);
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (/[가-힣]/.test(token)) {
      result.push(token);
    } else {
      // lone digit or ASCII — stop
      break;
    }
  }
  return result.length > 0 ? result.join(' ') : str;
}

export function parseWeeklyExcel(buffer: Buffer): DataRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  // date -> region -> partial DataRow fields
  const dataMap = new Map<string, Map<string, Partial<DataRow>>>();

  function upsert(date: string, region: string, field: SheetField, value: number | null) {
    if (!region || value === null) return;
    if (!dataMap.has(date)) dataMap.set(date, new Map());
    const rMap = dataMap.get(date)!;
    if (!rMap.has(region)) rMap.set(region, {});
    (rMap.get(region)! as any)[field] = value;
  }

  // --- Parse simple sheets (1-4) ---
  for (const [sheetName, fieldKey] of Object.entries(SIMPLE_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) { console.warn(`Sheet not found: ${sheetName}`); continue; }

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (rows.length < 4) continue;

    // Row index 1 = Korean region names
    const headerRow: any[] = rows[1] ?? [];
    const regionNames: string[] = [];
    for (let col = 1; col < headerRow.length; col++) {
      regionNames.push(normalizeRegionName(headerRow[col]) || `col_${col}`);
    }

    // Data starts at row index 3
    for (let rowIdx = 3; rowIdx < rows.length; rowIdx++) {
      const row: any[] = rows[rowIdx] ?? [];
      if (!row.length) continue;
      const dateStr = excelSerialToDate(row[0]);
      if (!dateStr) continue;

      for (let col = 1; col < row.length; col++) {
        const region = regionNames[col - 1];
        if (!region) continue;
        const v = row[col];
        const numValue = typeof v === 'number' && !isNaN(v) ? v : null;
        upsert(dateStr, region, fieldKey, numValue);
      }
    }
  }

  // --- Parse grouped sheets (5-8) ---
  for (const [sheetName, { field, targetMetric }] of Object.entries(GROUPED_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) { console.warn(`Sheet not found: ${sheetName}`); continue; }

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (rows.length < 5) continue;

    // Row index 1: region group headers (merged cells → nulls follow)
    // Row index 2: sub-metric names per column
    // Data starts at row index 4
    const regionRow: any[] = rows[1] ?? [];
    const subMetricRow: any[] = rows[2] ?? [];

    // Build map: region name → column index of target metric
    const regionColMap = new Map<string, number>(); // region -> target column
    let currentRegion = '';
    for (let col = 1; col < regionRow.length; col++) {
      if (regionRow[col] != null) {
        currentRegion = normalizeRegionName(regionRow[col]);
      }
      const subMetric = subMetricRow[col];
      if (currentRegion && subMetric === targetMetric) {
        regionColMap.set(currentRegion, col);
      }
    }

    // Data starts at row 4
    for (let rowIdx = 4; rowIdx < rows.length; rowIdx++) {
      const row: any[] = rows[rowIdx] ?? [];
      if (!row.length) continue;
      const dateStr = excelSerialToDate(row[0]);
      if (!dateStr) continue;

      for (const [region, col] of regionColMap) {
        const v = row[col];
        const numValue = typeof v === 'number' && !isNaN(v) ? v : null;
        upsert(dateStr, region, field, numValue);
      }
    }
  }

  // Flatten map to array
  const results: DataRow[] = [];
  for (const [date, regionMap] of dataMap) {
    for (const [region, partial] of regionMap) {
      results.push({ date, region, ...partial });
    }
  }
  return results;
}
