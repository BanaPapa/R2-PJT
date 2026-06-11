import type { ProviderDef, ModelInfo } from '../../src/entities/provider/model/provider.types';
import type { Credential } from '../credentials-store';

export interface ChatInput { system: string; user: string; model: string }
export interface Adapter {
  listModels: (def: ProviderDef, cred: Credential) => Promise<ModelInfo[]>;
  chat: (def: ProviderDef, cred: Credential, input: ChatInput) => Promise<string>;
}

function bearer(cred: Credential): string {
  const token = cred.apiKey ?? cred.accessToken ?? cred.token;
  if (!token) throw new Error('자격증명이 없습니다.');
  return `Bearer ${token}`;
}

async function asJson(res: Response): Promise<Record<string, unknown>> {
  if (!res.ok) throw new Error(`프로바이더 오류 (${res.status}) ${await res.text().catch(() => '')}`);
  return (await res.json()) as Record<string, unknown>;
}

export const openAiCompatible: Adapter = {
  async listModels(def, cred) {
    const json = await asJson(await fetch(`${def.baseUrl}/models`, { headers: { Authorization: bearer(cred) } }));
    const data = (json.data as { id: string }[]) ?? [];
    return data.map(m => ({ id: m.id }));
  },
  async chat(def, cred, { system, user, model }) {
    const json = await asJson(
      await fetch(`${def.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: bearer(cred), 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      }),
    );
    const choices = json.choices as { message?: { content?: string } }[] | undefined;
    return choices?.[0]?.message?.content ?? '';
  },
};
