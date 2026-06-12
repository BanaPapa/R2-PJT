// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseCodexResponse, chatgptCodex } from '../../vite-plugins/adapters/chatgpt-codex';
import type { ProviderDef } from '../../src/entities/provider/model/provider.types';
import type { Credential } from '../../vite-plugins/credentials-store';

const def = { id: 'openai', baseUrl: 'https://chatgpt.com/backend-api/codex' } as ProviderDef;

afterEach(() => vi.restoreAllMocks());

describe('parseCodexResponse', () => {
  it('SSE delta 이벤트를 누적해 텍스트를 만든다', () => {
    const sse = [
      'data: {"type":"response.output_text.delta","delta":"안녕"}',
      'data: {"type":"response.output_text.delta","delta":"하세요"}',
      'data: {"type":"response.completed","response":{"usage":{"input_tokens":10,"output_tokens":5,"total_tokens":15}}}',
      'data: [DONE]',
    ].join('\n');
    const r = parseCodexResponse(sse);
    expect(r.text).toBe('안녕하세요');
    expect(r.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it('단일 JSON 응답(output 배열)도 파싱한다', () => {
    const json = JSON.stringify({
      output: [{ type: 'message', content: [{ type: 'output_text', text: '결과' }] }],
      usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
    });
    const r = parseCodexResponse(json);
    expect(r.text).toBe('결과');
    expect(r.usage?.totalTokens).toBe(5);
  });
});

describe('chatgptCodex.chat', () => {
  it('responses 엔드포인트에 account-id 헤더와 Responses 바디로 POST한다', async () => {
    const cred: Credential = { method: 'subscription', accessToken: 'AT', accountId: 'acc-1' };
    let captured: { url: string; init: RequestInit } | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: string, init?: RequestInit) => {
      captured = { url, init: init! };
      return new Response('data: {"type":"response.output_text.delta","delta":"ok"}\n', { status: 200 });
    }) as unknown as typeof fetch);

    const r = await chatgptCodex.chat(def, cred, { system: 'sys', user: 'hi', model: 'gpt-5' });
    expect(r.text).toBe('ok');
    expect(captured!.url).toBe('https://chatgpt.com/backend-api/codex/responses');
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer AT');
    expect(headers['chatgpt-account-id']).toBe('acc-1');
    const body = JSON.parse(String(captured!.init.body));
    expect(body.model).toBe('gpt-5');
    expect(body.instructions).toBe('sys');
    expect(body.stream).toBe(true);
    expect(body.input[0].content[0].text).toBe('hi');
  });

  it('listModels는 Codex /models를 조회해 visibility=list만 반환한다', async () => {
    let capturedUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (url: string) => {
      capturedUrl = url;
      return new Response(
        JSON.stringify({
          models: [
            { slug: 'gpt-5.5', display_name: 'GPT-5.5', visibility: 'list', supported_in_api: true, context_window: 272000 },
            { slug: 'gpt-5.4-mini', display_name: 'GPT-5.4-Mini', visibility: 'list', supported_in_api: true },
            { slug: 'codex-auto-review', display_name: 'Codex Auto Review', visibility: 'hide', supported_in_api: true },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch);

    const models = await chatgptCodex.listModels(def, { method: 'subscription', accessToken: 'AT', accountId: 'acc-1' });
    expect(capturedUrl).toContain('/models?client_version=');
    expect(models.map(m => m.id)).toEqual(['gpt-5.5', 'gpt-5.4-mini']);
    expect(models.find(m => m.id === 'gpt-5.5')?.contextLength).toBe(272000);
  });
});
