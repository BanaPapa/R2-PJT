// KB 주간시계열 xlsx → public/data/kb-weekly.json (클라이언트 사이드용, 백엔드 불필요)
// 4개 시트(매매증감/전세증감/매매지수/전세지수)를 "대지역|지역명" 복합키로 파싱한다.
// 위치 순서 기반 계층: 시도 컬럼을 만나면 현재 대지역 갱신, 집계 컬럼은 그대로,
// 나머지(구/시/군)는 "현재대지역|이름" 키. → 중구 등 시도별 중복 구를 충돌 없이 구분.
//
// 사용: cd server && node scripts/build-weekly-json.mjs [xlsx경로]
import XLSX from 'xlsx';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const DATA_DIR = resolve(__dirname, '..', 'data');
const OUT = resolve(REPO_ROOT, 'public', 'data', 'kb-weekly.json');

const SHEET_METRIC = {
  '1.매매증감': 'saleChange',
  '2.전세증감': 'jeonseChange',
  '3.매매지수': 'saleIndex',
  '4.전세지수': 'jeonseIndex',
};
const METRIC_KEYS = ['saleIndex', 'jeonseIndex', 'saleChange', 'jeonseChange'];

// 거래지표 4개 시트(대지역/집계만). 지역마다 3개 하위컬럼이고 그중 3번째(시작+2)가 지수값.
// 데이터는 row4부터(시세 시트는 row3부터). 별도 파일 kb-weekly-trade.json으로 출력.
const TRADE_SHEET_METRIC = {
  '5.매수우위': 'buyerAdvantage',
  '6.매매거래활발': 'saleActivity',
  '7.전세수급': 'jeonseSupply',
  '8.전세거래활발': 'jeonseActivity',
};
const TRADE_METRIC_KEYS = ['buyerAdvantage', 'saleActivity', 'jeonseSupply', 'jeonseActivity'];
const TRADE_OUT = resolve(REPO_ROOT, 'public', 'data', 'kb-weekly-trade.json');

// 시도 별칭 → KB Land 표준명. 엑셀은 시트/지역마다 약칭("경북")과 정식명("경상북도")을 혼용하므로
// 반드시 정규화해야 셀렉터(KB Land API)의 키와 일치한다. 정규화 실패 시 하위 도시들이
// 직전 시도로 잘못 귀속되는 치명적 버그 발생(예: 경북 도시들이 전라남도로 흡수됨).
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
const AGG = new Set(['전국', '수도권', '6개광역시', '5개광역시', '강북14개구', '강남11개구', '기타지방']);

function serialToDate(serial) {
  if (typeof serial !== 'number' || isNaN(serial) || serial <= 0) return null;
  const d = new Date((serial - 25569) * 86400 * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// 헤더(row1)를 컬럼 인덱스 → 복합키 로 매핑
function buildColumnKeys(headerRow) {
  const keys = {};
  let cur = '';
  for (let c = 1; c < headerRow.length; c++) {
    const raw = headerRow[c];
    const n = raw == null ? '' : String(raw).trim();
    if (!n) continue;
    const canonical = SIDO_ALIAS[n];
    if (canonical) {
      cur = canonical;
      keys[c] = canonical; // 시도 전체 (표준명)
    } else if (AGG.has(n)) {
      keys[c] = n; // 집계 (대지역 변경 안 함)
    } else {
      keys[c] = cur ? `${cur}|${n}` : n;
    }
  }
  return keys;
}

// 거래지표 헤더(row1): 지역명이 3컬럼 그룹의 시작 컬럼에 있고, 지수값은 시작+2 컬럼.
// 반환: 지수값 컬럼인덱스 → 정규화된 대지역 키
function buildTradeColumnKeys(headerRow) {
  const keys = {};
  for (let c = 1; c < headerRow.length; c++) {
    const raw = headerRow[c];
    const n = raw == null ? '' : String(raw).trim();
    if (!n) continue;
    const name = n.split(/\s+/)[0]; // "전국 Total" → "전국"
    const canonical = SIDO_ALIAS[name] ?? name; // 집계/시도 모두 이미 표준명
    keys[c + 2] = canonical;
  }
  return keys;
}

// 거래지표 시트들을 파싱해 kb-weekly-trade.json 생성 (시세 빌드와 독립)
async function buildTrade(wb) {
  const acc = new Map();
  const allDates = new Set();

  for (const [sheetName, metric] of Object.entries(TRADE_SHEET_METRIC)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) { console.warn('시트 없음:', sheetName); continue; }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (rows.length < 5) continue;
    const colKeys = buildTradeColumnKeys(rows[1] ?? []);

    for (let r = 4; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const date = serialToDate(row[0]);
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
  const files = (await readdir(DATA_DIR)).filter(f => /주간|weekly/i.test(f) && f.endsWith('.xlsx'));
  if (!files.length) throw new Error(`주간 xlsx를 찾을 수 없음: ${DATA_DIR}`);
  files.sort();
  return join(DATA_DIR, files[files.length - 1]);
}

async function main() {
  const input = await resolveInput();
  console.log('입력 파일:', input);
  const wb = XLSX.read(await readFile(input), { type: 'buffer', cellDates: false });

  // key -> metric -> Map<date, value>
  const acc = new Map();
  const allDates = new Set();

  for (const [sheetName, metric] of Object.entries(SHEET_METRIC)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) { console.warn('시트 없음:', sheetName); continue; }
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (rows.length < 4) continue;
    const colKeys = buildColumnKeys(rows[1] ?? []);

    for (let r = 3; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const date = serialToDate(row[0]);
      if (!date) continue;
      allDates.add(date);
      for (const [cStr, key] of Object.entries(colKeys)) {
        const c = Number(cStr);
        const v = row[c];
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
    for (const mk of METRIC_KEYS) {
      const arr = new Array(dates.length).fill(null);
      const m = byMetric[mk];
      if (m) for (const [date, v] of m) arr[dateIdx.get(date)] = v;
      series[mk] = arr;
    }
    data[key] = series;
  }

  await mkdir(dirname(OUT), { recursive: true });
  const out = JSON.stringify({ dates, data });
  await writeFile(OUT, out);
  console.log(`완료: ${OUT}`);
  console.log(`지역(키) ${Object.keys(data).length}개 · 날짜 ${dates.length}개 (${dates[0]}~${dates[dates.length - 1]}) · ${(out.length / 1e6).toFixed(2)} MB`);

  await buildTrade(wb);
}

main().catch(e => { console.error('빌드 실패:', e.message); process.exit(1); });
