// KB 월간 주택 시계열 xlsx → public/data/kb-monthly.json (클라이언트 사이드용, 백엔드 불필요)
// server/src/services/monthly-excel-parser.service.ts 의 파싱 로직을 ESM으로 포팅한 자립 스크립트.
// 5개 시트(매매APT/전세APT/㎡당매매/㎡당전세/매매전세비)를 표준 계층(canonical)으로 해석한다.
//
// 출력 형태(주간 kb-weekly.json 패턴 + 계층 정보):
//   { dates:[...YYYY-MM], regions:[{regionPath,region,level,parentPath}], data:{ <regionPath>:{ <metric>:[값|null...] } } }
//
// 사용: cd server && node scripts/build-monthly-json.mjs [xlsx경로]
import XLSX from 'xlsx';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const DATA_DIR = resolve(__dirname, '..', 'data');
const OUT = resolve(REPO_ROOT, 'public', 'data', 'kb-monthly.json');

// 시트명 → 지표 필드. 매매APT(최다 지역)를 먼저 처리해 canonical 우선권 부여.
const SHEET_METRICS = [
  ['2.매매APT', 'saleAptIndex'],
  ['6.전세APT', 'jeonseAptIndex'],
  ['47.㎡당아파트평균매매', 'aptAvgSalePerM2'],
  ['48.㎡당아파트평균전세', 'aptAvgJeonsePerM2'],
  ['28.아파트매매전세비', 'aptSaleJeonseRatio'],
];
const METRIC_KEYS = [
  'saleAptIndex',
  'jeonseAptIndex',
  'aptSaleJeonseRatio',
  'aptAvgSalePerM2',
  'aptAvgJeonsePerM2',
];

// ── 거래지표(확산지수 4종) — 주간 build-weekly-json.mjs 의 buildTrade 와 동일한 산출물.
// 월간 시계열의 21~24 시트가 소스이며 날짜축이 시세지표(매매/전세 등)와 달라 별도 파일로 출력.
const TRADE_SHEET_METRIC = {
  '21.매수우위': 'buyerAdvantage',
  '22.매매거래활발': 'saleActivity',
  '23.전세수급': 'jeonseSupply',
  '24.전세거래활발': 'jeonseActivity',
};
const TRADE_METRIC_KEYS = ['buyerAdvantage', 'saleActivity', 'jeonseSupply', 'jeonseActivity'];
const TRADE_OUT = resolve(REPO_ROOT, 'public', 'data', 'kb-monthly-trade.json');

// 전망지표(KB 매매/전세 가격 전망지수, 0~200 확산지수) — 거래지표와 동일한 그룹 헤더 구조(지역마다
// 6개 하위컬럼 + 마지막 "…전망지수"). 대지역/집계만 제공. 날짜축이 또 달라(매매 2013~, 전세 2016~)
// 별도 파일로 출력하며, 시장지표 탭의 중간행(중지역 없으므로 대지역 기준)에서 사용.
const FORECAST_SHEET_METRIC = {
  '25.KB부동산 매매가격 전망지수': 'saleForecast',
  '26.KB부동산 전세가격 전망지수': 'jeonseForecast',
};
const FORECAST_METRIC_KEYS = ['saleForecast', 'jeonseForecast'];
const FORECAST_OUT = resolve(REPO_ROOT, 'public', 'data', 'kb-monthly-forecast.json');

// 시도 별칭 → KB Land 표준명(선택 키와 일치시키기 위함). 주간 빌드와 동일.
const SIDO_ALIAS = {
  '서울특별시': '서울특별시', '서울': '서울특별시',
  '부산광역시': '부산광역시', '부산': '부산광역시',
  '대구광역시': '대구광역시', '대구': '대구광역시',
  '인천광역시': '인천광역시', '인천': '인천광역시',
  '광주광역시': '광주광역시',
  '대전광역시': '대전광역시', '대전': '대전광역시',
  '울산광역시': '울산광역시', '울산': '울산광역시',
  '세종특별자치시': '세종특별자치시', '세종': '세종특별자치시',
  '경기도': '경기도', '경기': '경기도',
  '강원도': '강원특별자치도', '강원특별자치도': '강원특별자치도', '강원': '강원특별자치도',
  '충청북도': '충청북도', '충북': '충청북도',
  '충청남도': '충청남도', '충남': '충청남도',
  '전라북도': '전북특별자치도', '전북특별자치도': '전북특별자치도', '전북': '전북특별자치도',
  '전라남도': '전라남도', '전남': '전라남도',
  '경상북도': '경상북도', '경북': '경상북도',
  '경상남도': '경상남도', '경남': '경상남도',
  '제주도': '제주특별자치도', '제주특별자치도': '제주특별자치도', '제주': '제주특별자치도',
};

const ROOT = '전국';

// 전국 직속 집계(권역) — 시도가 아닌 묶음. 자식 없음.
const AGGREGATE_REGIONS = new Set([
  '수도권',
  '6개광역시',
  '5개광역시(인천外)',
  '기타지방',
  '제주/서귀포',
]);

function norm(value) {
  if (value == null) return '';
  return String(value).replace(/\r?\n/g, '').trim();
}

function hangul(value) {
  const s = norm(value);
  return s && /[가-힣]/.test(s) ? s : null;
}

function isSido(name) {
  return /(특별시|광역시|특별자치시|도)$/.test(name);
}

function isAggregate(name) {
  return AGGREGATE_REGIONS.has(name) || /개광역시/.test(name);
}

function classify(name) {
  if (name === ROOT) return 'root';
  if (isAggregate(name)) return 'aggregate';
  if (isSido(name)) return 'sido';
  return 'sub';
}

// sub 지역 canonical 키 정규화: 시트 간 시(市) 접미사 표기 차이 흡수.
function keyName(name) {
  return name.endsWith('시') ? name.slice(0, -1) : name;
}

// 한 시트의 데이터 컬럼 목록과 병합헤더 여부를 추출.
function getSheetColumns(rows) {
  const r1 = rows[1] ?? [];
  const r2 = rows[2] ?? [];
  const width = Math.max(r1.length, r2.length);

  let merged = false;
  for (let c = 1; c < width; c++) {
    if (hangul(r2[c])) { merged = true; break; }
  }

  const cols = [];
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

const rootBlock = () => ({ path: ROOT, region: ROOT, level: 1, parentPath: null });

// 병합헤더 시트에서 표준 계층(sub 지역들)을 구축한다.
function buildCanonical(workbook) {
  const canonical = new Map();

  for (const [sheetName] of SHEET_METRICS) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const { merged, cols } = getSheetColumns(rows);
    if (!merged) continue;

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
      let blk;
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

// 시트 컬럼들을 표준 경로로 해석. sub 지역은 canonical 조회.
function resolveColumns(cols, canonical) {
  const map = new Map();
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

function expandYear(intPart) {
  if (intPart >= 100) return intPart;
  if (intPart >= 50) return 1900 + intPart;
  return 2000 + intPart;
}

// 날짜 마커 파싱(연도.월 마커 → 연도 갱신 / 정수 1..12 → 직전 연도의 월).
function parseDateMarker(raw, ctx) {
  if (raw == null) return null;
  let v;
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

function parseSheetData(rows, colMap, metric, out) {
  const ctx = { year: null };
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

function parseMonthlyExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  const canonical = buildCanonical(workbook);
  console.log(`[MonthlyParser] canonical 지역 ${canonical.size}개 구축`);

  const out = new Map();

  for (const [sheetName, metric] of SHEET_METRICS) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      console.warn(`[MonthlyParser] Sheet not found: ${sheetName}`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const { cols } = getSheetColumns(rows);
    const colMap = resolveColumns(cols, canonical);
    const n = parseSheetData(rows, colMap, metric, out);
    console.log(`[MonthlyParser] ${sheetName} → ${n} values (${colMap.size} cols)`);
  }

  return Array.from(out.values());
}

// 주간 트리 구조와 일치시키기 위한 경로 재배치.
// "강남11개구"·"강북14개구" 같은 KB 구(區) 묶음은 행정 계층이 아니라 통계 묶음이므로:
//  - 중간에 끼면 제거해 구를 시도 직속으로 올린다 (전국>서울특별시>강남11개구>강남구 → 전국>서울특별시>강남구)
//  - 묶음 자체는 최상위 집계로 승격한다 (전국>서울특별시>강남11개구 → 전국>강남11개구)
// "N개광역시"(6개광역시 등)는 구/군으로 끝나지 않아 영향 없음.
function remapPath(path) {
  const segs = path.split('>');
  const gi = segs.findIndex(s => /\d+개[구군]$/.test(s));
  if (gi === -1) return path;
  if (gi === segs.length - 1) return `전국>${segs[gi]}`; // 묶음이 말단 → 집계로 승격
  return segs.slice(0, gi).concat(segs.slice(gi + 1)).join('>'); // 중간 묶음 제거
}

// 거래지표 시트의 헤더에서 "지수 값 컬럼 → 표준 지역키" 매핑을 만든다.
// row1: 각 지역 그룹의 시작 컬럼에 지역명. row2: 그룹 내 지수 컬럼에 "…지수" 라벨.
// 시트마다 그룹 폭(지수 위치 +2/+3)이 달라, row2의 "지수" 헤더로 지수 컬럼을 직접 탐지해
// 컬럼 순서대로 지역 시작과 1:1로 짝짓는다.
function buildTradeColumnKeys(rows, keyword = '지수') {
  const r1 = rows[1] ?? [];
  const r2 = rows[2] ?? [];

  const regionKeys = [];
  for (let c = 1; c < r1.length; c++) {
    const raw = r1[c];
    if (raw == null) continue;
    const name = String(raw).trim().split(/\s+/)[0]; // "전국 Total" → "전국"
    if (!name) continue;
    regionKeys.push(SIDO_ALIAS[name] ?? name); // 집계명(전국·수도권 등)은 그대로
  }

  const idxCols = [];
  for (let c = 1; c < r2.length; c++) {
    const v = r2[c];
    if (v != null && String(v).replace(/\r?\n/g, '').includes(keyword)) idxCols.push(c);
  }

  if (regionKeys.length !== idxCols.length) {
    console.warn(`[MonthlyBuild] 헤더 불일치(${keyword}): 지역 ${regionKeys.length} vs 값컬럼 ${idxCols.length}`);
  }
  const keys = {};
  const n = Math.min(regionKeys.length, idxCols.length);
  for (let i = 0; i < n; i++) keys[idxCols[i]] = regionKeys[i];
  return keys;
}

// 전망지표 2개 시트를 파싱해 kb-monthly-forecast.json 생성. buildTrade와 동일 패턴이며
// 각 지역 그룹에서 마지막 "…전망지수" 컬럼만 값으로 취한다.
async function buildForecast(workbook) {
  const acc = new Map();
  const allDates = new Set();

  for (const [sheetName, metric] of Object.entries(FORECAST_SHEET_METRIC)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) { console.warn(`[MonthlyForecast] 시트 없음: ${sheetName}`); continue; }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (rows.length < 5) continue;
    const colKeys = buildTradeColumnKeys(rows, '전망지수');

    const ctx = { year: null };
    for (let r = 4; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const date = parseDateMarker(row[0], ctx);
      if (!date) continue;
      allDates.add(date);
      for (const [cStr, key] of Object.entries(colKeys)) {
        const v = row[Number(cStr)];
        if (typeof v !== 'number' || isNaN(v)) continue;
        let byMetric = acc.get(key);
        if (!byMetric) { byMetric = {}; acc.set(key, byMetric); }
        let m = byMetric[metric];
        if (!m) { m = new Map(); byMetric[metric] = m; }
        m.set(date, v);
      }
    }
  }

  const dates = [...allDates].sort();
  const dateIdx = new Map(dates.map((d, i) => [d, i]));
  const data = {};
  for (const [key, byMetric] of acc) {
    const series = {};
    for (const mk of FORECAST_METRIC_KEYS) {
      const arr = new Array(dates.length).fill(null);
      const m = byMetric[mk];
      if (m) for (const [date, v] of m) arr[dateIdx.get(date)] = v;
      series[mk] = arr;
    }
    data[key] = series;
  }

  await mkdir(dirname(FORECAST_OUT), { recursive: true });
  const out = JSON.stringify({ dates, data });
  await writeFile(FORECAST_OUT, out);
  console.log(`완료(전망지표): ${FORECAST_OUT}`);
  console.log(`지역 ${Object.keys(data).length}개 · 날짜 ${dates.length}개 (${dates[0]}~${dates[dates.length - 1]}) · ${(out.length / 1e6).toFixed(2)} MB`);
}

// 거래지표 4개 시트를 파싱해 kb-monthly-trade.json 생성(시세 빌드와 독립).
async function buildTrade(workbook) {
  const acc = new Map(); // key -> metric -> Map<date, value>
  const allDates = new Set();

  for (const [sheetName, metric] of Object.entries(TRADE_SHEET_METRIC)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) { console.warn(`[MonthlyTrade] 시트 없음: ${sheetName}`); continue; }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (rows.length < 5) continue;
    const colKeys = buildTradeColumnKeys(rows);

    const ctx = { year: null };
    for (let r = 4; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const date = parseDateMarker(row[0], ctx);
      if (!date) continue;
      allDates.add(date);
      for (const [cStr, key] of Object.entries(colKeys)) {
        const v = row[Number(cStr)];
        if (typeof v !== 'number' || isNaN(v)) continue; // "-" 등 결측 제외
        let byMetric = acc.get(key);
        if (!byMetric) { byMetric = {}; acc.set(key, byMetric); }
        let m = byMetric[metric];
        if (!m) { m = new Map(); byMetric[metric] = m; }
        m.set(date, v);
      }
    }
  }

  const dates = [...allDates].sort();
  const dateIdx = new Map(dates.map((d, i) => [d, i]));
  const data = {};
  for (const [key, byMetric] of acc) {
    const series = {};
    for (const mk of TRADE_METRIC_KEYS) {
      const arr = new Array(dates.length).fill(null);
      const m = byMetric[mk];
      if (m) for (const [date, v] of m) arr[dateIdx.get(date)] = v;
      series[mk] = arr;
    }
    data[key] = series;
  }

  await mkdir(dirname(TRADE_OUT), { recursive: true });
  const out = JSON.stringify({ dates, data });
  await writeFile(TRADE_OUT, out);
  console.log(`완료(거래지표): ${TRADE_OUT}`);
  console.log(`지역 ${Object.keys(data).length}개 · 날짜 ${dates.length}개 (${dates[0]}~${dates[dates.length - 1]}) · ${(out.length / 1e6).toFixed(2)} MB`);
}

async function resolveInput() {
  if (process.argv[2]) return resolve(process.argv[2]);
  const files = (await readdir(DATA_DIR)).filter(f => /월간|monthly/i.test(f) && /주택/.test(f) && f.endsWith('.xlsx'));
  if (!files.length) throw new Error(`월간 주택 xlsx를 찾을 수 없음: ${DATA_DIR}`);
  files.sort();
  return join(DATA_DIR, files[files.length - 1]);
}

async function main() {
  const input = await resolveInput();
  console.log('입력 파일:', input);
  const buffer = await readFile(input);
  const rowsParsed = parseMonthlyExcel(buffer);
  console.log(`[MonthlyParser] 파싱된 (date,region) 행 ${rowsParsed.length}개`);

  const allDates = new Set();
  const regionMeta = new Map(); // regionPath -> {region, level, parentPath}
  // regionPath -> metric -> Map<date, value>
  const acc = new Map();

  for (const row of rowsParsed) {
    allDates.add(row.date);
    // 주간 구조에 맞춰 경로 재배치 (구 묶음 평탄화/승격)
    const np = remapPath(row.regionPath);
    if (np !== row.regionPath) {
      const i = np.lastIndexOf('>');
      row.regionPath = np;
      row.parentPath = i === -1 ? null : np.slice(0, i);
      row.level = np.split('>').length;
    }
    if (!regionMeta.has(row.regionPath)) {
      regionMeta.set(row.regionPath, { region: row.region, level: row.level, parentPath: row.parentPath });
    }
    let byMetric = acc.get(row.regionPath);
    if (!byMetric) { byMetric = {}; acc.set(row.regionPath, byMetric); }
    for (const mk of METRIC_KEYS) {
      const v = row[mk];
      if (typeof v !== 'number' || isNaN(v)) continue;
      let m = byMetric[mk];
      if (!m) { m = new Map(); byMetric[mk] = m; }
      m.set(row.date, v);
    }
  }

  const dates = [...allDates].sort();
  const dateIdx = new Map(dates.map((d, i) => [d, i]));

  const regions = [...regionMeta.entries()]
    .map(([regionPath, meta]) => ({ regionPath, region: meta.region, level: meta.level, parentPath: meta.parentPath }))
    .sort((a, b) => (a.level - b.level) || a.regionPath.localeCompare(b.regionPath));

  const data = {};
  for (const [regionPath, byMetric] of acc) {
    const series = {};
    for (const mk of METRIC_KEYS) {
      const m = byMetric[mk];
      if (!m) continue; // 해당 지표 데이터 없으면 키 생략(폴백이 처리)
      const arr = new Array(dates.length).fill(null);
      for (const [date, v] of m) arr[dateIdx.get(date)] = v;
      series[mk] = arr;
    }
    data[regionPath] = series;
  }

  await mkdir(dirname(OUT), { recursive: true });
  const outStr = JSON.stringify({ dates, regions, data });
  await writeFile(OUT, outStr);
  console.log(`완료: ${OUT}`);
  console.log(
    `지역 ${regions.length}개 · 날짜 ${dates.length}개 (${dates[0]}~${dates[dates.length - 1]}) · ${(outStr.length / 1e6).toFixed(2)} MB`,
  );

  // 거래지표(확산지수) · 전망지표 별도 산출물
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  await buildTrade(workbook);
  await buildForecast(workbook);
}

main().catch(e => { console.error('빌드 실패:', e.message); process.exit(1); });
