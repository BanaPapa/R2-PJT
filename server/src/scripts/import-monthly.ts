import path from 'path';
import { collectMonthlyFromFile } from '../services/monthly-collector.service.js';

/**
 * 월간 엑셀 파일을 DB에 적재한다.
 * 사용법: npm run import:monthly [파일경로]
 * 기본 경로: server/data/202605_월간 주택 시계열.xlsx
 */
async function main() {
  const arg = process.argv[2];
  const filePath = arg ? path.resolve(arg) : undefined;

  const result = await collectMonthlyFromFile(filePath);
  if (result.success) {
    console.log(`✅ ${result.message}`);
    process.exit(0);
  } else {
    console.error(`❌ ${result.message}: ${result.error}`);
    process.exit(1);
  }
}

main();
