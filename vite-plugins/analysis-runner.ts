import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getProvider } from '../src/entities/provider/model/registry';
import { readOne } from './credentials-store';
import { getAdapter } from './adapters';

interface AnalysisRequestLike {
  id?: string;
  scope: unknown;
  datasets: unknown;
  provider?: string;
  model?: string | null;
}

export async function buildMessages(root: string, req: AnalysisRequestLike): Promise<{ system: string; user: string }> {
  const system = await fs.readFile(path.join(root, 'docs/analysis-prompt.md'), 'utf8').catch(() => '당신은 부동산 데이터 분석가입니다. 한국어 마크다운으로 답하세요.');
  const user = JSON.stringify({ scope: req.scope, datasets: req.datasets }, null, 2);
  return { system, user };
}

export async function runProviderAnalysis(root: string, id: string, req: AnalysisRequestLike): Promise<void> {
  const responses = path.join(root, '.analysis', 'responses');
  try {
    await fs.mkdir(responses, { recursive: true });
    const def = getProvider(req.provider ?? '');
    if (!def || def.apiShape === 'claude-bridge') throw new Error(`프록시 대상이 아닌 프로바이더: ${req.provider}`);
    const cred = await readOne(root, def.id);
    if (!cred) throw new Error(`연결되지 않은 프로바이더: ${def.id}`);
    const { system, user } = await buildMessages(root, req);
    const text = await getAdapter(def.apiShape).chat(def, cred, { system, user, model: req.model ?? '' });
    await fs.writeFile(path.join(responses, `${id}.md`), text || '_빈 응답_', 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '분석 실행 실패';
    await fs.mkdir(responses, { recursive: true }).catch(() => {});
    await fs.writeFile(path.join(responses, `${id}.error.txt`), msg, 'utf8');
  }
}
