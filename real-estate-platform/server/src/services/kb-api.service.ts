import axios from 'axios';

const BASE_URL = 'https://api.kbland.kr';
const HEADERS = {
  'Referer': 'https://kbland.kr/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

export interface KBFileInfo {
  fileName: string;         // hashed
  originalFileName: string; // e.g. "20260525_주간시계열.xlsx"
  filePath: string;         // e.g. "//kbstar/land/statc/tmsr/weekly"
  latestDate: string;       // e.g. "2026-05-25"
}

export async function getLatestFileInfo(type: 'weekly' | 'monthly'): Promise<KBFileInfo | null> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0] ?? '';
  const endDate = new Date(now.getFullYear() + 1, 0, 1).toISOString().split('T')[0] ?? '';

  const params = new URLSearchParams({
    '주월간구분': type === 'weekly' ? '0' : '1',
    '기준년월시작일': startDate,
    '기준년월종료일': endDate,
  });

  const resp = await axios.get(`${BASE_URL}/land-extra/statistics/reference?${params}`, { headers: HEADERS, timeout: 30000 });
  const data = resp.data?.dataBody?.data;

  if (!data || !data['시계열'] || data['시계열'].length === 0) return null;

  const entry = data['시계열'][0];
  return {
    fileName: entry['파일명'],
    originalFileName: entry['원본파일명'],
    filePath: entry['파일경로'],
    latestDate: data['통계최신일'],
  };
}

export async function downloadExcelFile(fileInfo: KBFileInfo): Promise<Buffer> {
  const urlPath = `${fileInfo.filePath}/${fileInfo.fileName}`;
  const encodedFileName = encodeURIComponent(fileInfo.originalFileName);
  const url = `${BASE_URL}/land-extra/statistics/getfiledown?urlpath=${urlPath}&filename=${encodedFileName}`;

  const resp = await axios.get(url, {
    headers: HEADERS,
    responseType: 'arraybuffer',
    timeout: 120000,
  });

  return Buffer.from(resp.data);
}
