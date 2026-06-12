// 분석 요청 감시 스크립트 (dev 전용, 의존성 없음).
// .analysis/requests/ 에 "아직 응답이 없는" 요청이 생기면 그 경로를 출력하고 종료한다.
// Claude(터미널 세션)가 run_in_background 로 띄워두면, 새 요청 시 깨어나 분석을 수행하고
// 응답(.analysis/responses/<id>.md)을 쓴 뒤 이 스크립트를 재실행(재무장)한다.
//
// 사용: node scripts/analysis-watch.mjs
// 출력: 처리할 요청이 생기면  "NEW_REQUEST <절대경로>"  한 줄을 찍고 exit(0).

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestsDir = path.join(root, '.analysis', 'requests');
const responsesDir = path.join(root, '.analysis', 'responses');
const POLL_MS = 1000;

async function ensureDirs() {
  await fs.mkdir(requestsDir, { recursive: true });
  await fs.mkdir(responsesDir, { recursive: true });
}

// 응답(.md)이 아직 없는 가장 오래된 요청 id 를 찾는다.
async function findPending() {
  const files = await fs.readdir(requestsDir).catch(() => []);
  const ids = files
    .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
    .map(f => f.slice(0, -'.json'.length))
    .sort(); // id 앞부분이 타임스탬프라 정렬=시간순

  for (const id of ids) {
    const responded = await fs
      .access(path.join(responsesDir, `${id}.md`))
      .then(() => true)
      .catch(() => false);
    if (!responded) return id;
  }
  return null;
}

async function main() {
  await ensureDirs();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const id = await findPending();
    if (id) {
      const reqPath = path.join(requestsDir, `${id}.json`);
      process.stdout.write(`NEW_REQUEST ${reqPath}\n`);
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

main().catch(err => {
  process.stderr.write(`watch error: ${err?.message ?? err}\n`);
  process.exit(1);
});
