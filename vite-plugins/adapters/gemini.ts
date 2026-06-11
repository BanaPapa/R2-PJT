import type { Adapter } from './openai-compatible';
import type { Credential } from '../credentials-store';

function key(cred: Credential): string {
  const k = cred.apiKey ?? cred.accessToken;
  if (!k) throw new Error('자격증명이 없습니다.');
  return k;
}

async function asJson(res: Response): Promise<Record<string, unknown>> {
  if (!res.ok) throw new Error(`Gemini 오류 (${res.status}) ${await res.text().catch(() => '')}`);
  return (await res.json()) as Record<string, unknown>;
}

export const gemini: Adapter = {
  async listModels(def, cred) {
    const json = await asJson(await fetch(`${def.baseUrl}/models?key=${key(cred)}`));
    const models = (json.models as { name: string }[]) ?? [];
    return models.map(m => ({ id: m.name.replace(/^models\//, '') }));
  },
  async chat(def, cred, { system, user, model }) {
    const json = await asJson(
      await fetch(`${def.baseUrl}/models/${model}:generateContent?key=${key(cred)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
        }),
      }),
    );
    const candidates = json.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined;
    return candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  },
};
