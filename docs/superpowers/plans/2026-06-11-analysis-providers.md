# 분석 프로바이더 / 모델 설정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 분석 모달 안에서 여러 LLM 프로바이더·모델을 선택해 분석을 실행하고, 자격증명(API 키 / 구독인증)은 dev 브릿지(서버)에만 저장하며 모델 목록은 실시간 조회한다.

**Architecture:** 프론트는 정적 프로바이더 레지스트리 + zustand 스토어 + fetch 래퍼만 갖고, 키/토큰은 보유하지 않는다. dev 브릿지(Vite 플러그인, Node)가 자격증명 저장·라이브 모델 조회·OAuth PKCE·분석 프록시를 담당한다. 프로바이더 호출은 API 형태별 어댑터 3종(openai-compatible / anthropic / gemini)으로 추상화하고, 기존 Claude 흐름은 `claude-bridge` 프로바이더로 보존한다.

**Tech Stack:** TypeScript, React 19, zustand(+persist), Vite 7 플러그인 미들웨어, Node `fs`/`crypto`, Vitest + Testing Library.

> **커밋 주의:** 이 저장소는 "명시 요청 전 git commit 금지" 규칙이 있다. 각 Task의 커밋 스텝은 TDD 절차로 포함돼 있으나, **실행 중에는 커밋 전 사용자 확인을 받는다.** working tree 변경까지는 자유.

> **참고 문서:** OAuth/모델 API 세부는 구현 시 `claude-api` 스킬과 각 프로바이더 공식 문서로 값(authorize/token URL·clientId·scope·모델 엔드포인트)을 확정한다. 레지스트리 상수에만 모여 있어 코드 구조는 그대로다.

---

## File Structure

**신규 (프론트)**
- `src/entities/provider/model/provider.types.ts` — 타입 정의(ProviderDef, ModelInfo, AuthMethod, ProviderStatus).
- `src/entities/provider/model/registry.ts` — 내장 ProviderDef 목록 + `getProvider(id)`. **프론트/서버 공용 단일 소스**(순수 TS, DOM 의존 없음).
- `src/entities/provider/api/provider.api.ts` — 브릿지 fetch 래퍼.
- `src/entities/provider/model/provider.store.ts` — zustand persist 스토어(선택/상태/모델캐시).
- `src/entities/provider/index.ts` — 공개 배럴.
- `src/features/analysis/ui/ProviderSelector.tsx` — 상단 [프로바이더▾][모델▾][⚙][🔄] 바.
- `src/features/analysis/ui/ProviderManager.tsx` — 관리 뷰(연결/해제/키입력/구독로그인).

**신규 (서버 / vite-plugins)**
- `vite-plugins/credentials-store.ts` — `.analysis/providers.local.json` 원자적 읽기/쓰기 + 상태 변환.
- `vite-plugins/oauth.ts` — PKCE verifier/challenge/state + 메모리 세션맵.
- `vite-plugins/adapters/openai-compatible.ts` / `anthropic.ts` / `gemini.ts` / `index.ts` — `listModels`/`chat`.
- `vite-plugins/analysis-runner.ts` — `buildMessages(request)` + `runProviderAnalysis(root,id,request)`.
- `vite-plugins/provider-bridge.ts` — 프로바이더/OAuth 엔드포인트 플러그인 + `listProviderModels` 헬퍼.

**수정**
- `src/entities/analysis/model/analysis.types.ts` — `AnalysisRequest`에 `provider?`, `model?` 추가.
- `src/features/analysis/ui/AnalysisModal.tsx` — 셀렉터/관리뷰 통합 + payload에 provider/model.
- `src/features/analysis/index.ts` — 신규 UI export(선택).
- `vite-plugins/analysis-bridge.ts` — POST 분기(프로바이더 프록시), GET 에러 surface.
- `vite.config.ts` — `providerBridge()` 등록.

**테스트** — `tests/entities/provider/*`, `tests/vite-plugins/*`, `tests/features/analysis/provider-*.test.tsx`.

---

## Task 1: 프로바이더 타입 & 레지스트리

**Files:**
- Create: `src/entities/provider/model/provider.types.ts`
- Create: `src/entities/provider/model/registry.ts`
- Test: `tests/entities/provider/registry.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/entities/provider/registry.test.ts
import { describe, it, expect } from 'vitest';
import { PROVIDERS, getProvider } from '../../../src/entities/provider/model/registry';

describe('provider registry', () => {
  it('id가 중복되지 않는다', () => {
    const ids = PROVIDERS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('claude-bridge가 맨 앞 내장 프로바이더로 존재한다', () => {
    expect(PROVIDERS[0]?.id).toBe('claude-bridge');
    expect(PROVIDERS[0]?.auth).toEqual([]);
  });

  it('subscription 선언이 있으면 kind를 가진다', () => {
    for (const p of PROVIDERS) {
      if (p.auth.includes('subscription')) {
        expect(p.subscription?.kind).toBeTruthy();
      }
    }
  });

  it('getProvider는 정의를 반환하고 미존재는 undefined', () => {
    expect(getProvider('openai')?.label).toBe('OpenAI');
    expect(getProvider('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/entities/provider/registry.test.ts`
Expected: FAIL — `Cannot find module '.../registry'`.

- [ ] **Step 3: 타입 정의**

```ts
// src/entities/provider/model/provider.types.ts
export type ApiShape = 'openai-compatible' | 'anthropic' | 'gemini' | 'claude-bridge';
export type AuthMethod = 'apiKey' | 'subscription';
export type SubscriptionKind = 'oauth-pkce' | 'session-token';

export interface SubscriptionConfig {
  kind: SubscriptionKind;
  authorizeUrl?: string; // oauth-pkce
  tokenUrl?: string;     // oauth-pkce
  clientId?: string;     // oauth-pkce
  scopes?: string[];     // oauth-pkce
  tokenHint?: string;    // session-token: 토큰 복사 위치 안내
}

export interface ProviderDef {
  id: string;
  label: string;
  apiShape: ApiShape;
  baseUrl: string;
  auth: AuthMethod[];
  subscription?: SubscriptionConfig;
  docsUrl?: string;
}

export interface ModelInfo {
  id: string;
  label?: string;
}

export interface ProviderStatus {
  id: string;
  connected: boolean;
  method?: AuthMethod;
}
```

- [ ] **Step 4: 레지스트리 구현**

```ts
// src/entities/provider/model/registry.ts
import type { ProviderDef } from './provider.types';

// 정당한 공식 구독 OAuth가 있는 곳에만 subscription을 둔다.
// authorizeUrl/tokenUrl/clientId는 구현 시 공식 문서로 확정(현재 best-known 값).
export const PROVIDERS: ProviderDef[] = [
  {
    id: 'claude-bridge',
    label: 'Claude (현재 세션)',
    apiShape: 'claude-bridge',
    baseUrl: '',
    auth: [],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    apiShape: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    auth: ['apiKey', 'subscription'],
    subscription: {
      kind: 'oauth-pkce',
      authorizeUrl: 'https://auth.openai.com/oauth/authorize',
      tokenUrl: 'https://auth.openai.com/oauth/token',
      clientId: 'TODO_CONFIRM_OPENAI_CLIENT_ID',
      scopes: ['openid', 'profile', 'email', 'offline_access'],
    },
    docsUrl: 'https://platform.openai.com/docs/api-reference/models',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    apiShape: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    auth: ['apiKey', 'subscription'],
    subscription: {
      kind: 'session-token',
      tokenHint: 'grok.com 로그인 후 개발자도구 > Network에서 Authorization 베어러 토큰을 복사해 붙여넣으세요.',
    },
    docsUrl: 'https://docs.x.ai',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    apiShape: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    auth: ['apiKey', 'subscription'],
    subscription: {
      kind: 'oauth-pkce',
      authorizeUrl: 'https://claude.ai/oauth/authorize',
      tokenUrl: 'https://console.anthropic.com/v1/oauth/token',
      clientId: 'TODO_CONFIRM_ANTHROPIC_CLIENT_ID',
      scopes: ['org:create_api_key', 'user:profile'],
    },
    docsUrl: 'https://docs.anthropic.com',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    apiShape: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    auth: ['apiKey', 'subscription'],
    subscription: {
      kind: 'oauth-pkce',
      authorizeUrl: 'https://openrouter.ai/auth',
      tokenUrl: 'https://openrouter.ai/api/v1/auth/keys',
      scopes: [],
    },
    docsUrl: 'https://openrouter.ai/docs',
  },
  { id: 'google', label: 'Google (Gemini)', apiShape: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', auth: ['apiKey'], docsUrl: 'https://ai.google.dev' },
  { id: 'deepseek', label: 'DeepSeek', apiShape: 'openai-compatible', baseUrl: 'https://api.deepseek.com/v1', auth: ['apiKey'] },
  { id: 'groq', label: 'Groq', apiShape: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', auth: ['apiKey'] },
  { id: 'mistral', label: 'Mistral', apiShape: 'openai-compatible', baseUrl: 'https://api.mistral.ai/v1', auth: ['apiKey'] },
  { id: 'together', label: 'Together', apiShape: 'openai-compatible', baseUrl: 'https://api.together.xyz/v1', auth: ['apiKey'] },
];

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find(p => p.id === id);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/entities/provider/registry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: 커밋(확인 후)**

```bash
git add src/entities/provider/model tests/entities/provider/registry.test.ts
git commit -m "feat(provider): 프로바이더 타입·레지스트리 추가"
```

---

## Task 2: 프론트 프로바이더 API 클라이언트

**Files:**
- Create: `src/entities/provider/api/provider.api.ts`
- Test: `tests/entities/provider/provider-api.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/entities/provider/provider-api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as api from '../../../src/entities/provider/api/provider.api';

const okJson = (body: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') } as Response);

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('provider.api', () => {
  it('fetchProviders는 상태 배열을 반환한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(okJson([{ id: 'openai', connected: true, method: 'apiKey' }]));
    const res = await api.fetchProviders();
    expect(res[0]?.id).toBe('openai');
  });

  it('fetchModels는 refresh 플래그를 쿼리로 보낸다', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(okJson([{ id: 'gpt-4o' }]));
    await api.fetchModels('openai', true);
    expect(spy).toHaveBeenCalledWith('/api/providers/openai/models?refresh=1', expect.anything());
  });

  it('saveApiKey는 method=apiKey 바디로 POST 한다', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockReturnValue(okJson({ ok: true }));
    await api.saveApiKey('openai', 'sk-x');
    const [, init] = spy.mock.calls[0]!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ method: 'apiKey', apiKey: 'sk-x' });
  });

  it('실패 응답이면 throw 한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('boom') } as Response);
    await expect(api.fetchProviders()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/entities/provider/provider-api.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```ts
// src/entities/provider/api/provider.api.ts
import type { ModelInfo, ProviderStatus } from '../model/provider.types';

const BASE = '/api/providers';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`프로바이더 요청 실패 (${res.status}) ${msg}`);
  }
  return (await res.json()) as T;
}

export async function fetchProviders(): Promise<ProviderStatus[]> {
  return jsonOrThrow<ProviderStatus[]>(await fetch(BASE, { headers: { Accept: 'application/json' } }));
}

export async function fetchModels(id: string, force = false): Promise<ModelInfo[]> {
  const q = force ? '?refresh=1' : '';
  return jsonOrThrow<ModelInfo[]>(await fetch(`${BASE}/${id}/models${q}`, { headers: { Accept: 'application/json' } }));
}

async function postCredentials(id: string, body: Record<string, unknown>): Promise<void> {
  await jsonOrThrow<unknown>(
    await fetch(`${BASE}/${id}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function saveApiKey(id: string, apiKey: string): Promise<void> {
  await postCredentials(id, { method: 'apiKey', apiKey });
}

export async function saveSessionToken(id: string, token: string): Promise<void> {
  await postCredentials(id, { method: 'subscription', token });
}

export async function startOAuth(id: string): Promise<{ authUrl: string }> {
  return jsonOrThrow<{ authUrl: string }>(await fetch(`${BASE}/${id}/oauth/start`));
}

export async function disconnect(id: string): Promise<void> {
  await jsonOrThrow<unknown>(await fetch(`${BASE}/${id}/credentials`, { method: 'DELETE' }));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/entities/provider/provider-api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋(확인 후)**

```bash
git add src/entities/provider/api tests/entities/provider/provider-api.test.ts
git commit -m "feat(provider): 브릿지 fetch 래퍼 추가"
```

---

## Task 3: 프론트 프로바이더 스토어

**Files:**
- Create: `src/entities/provider/model/provider.store.ts`
- Create: `src/entities/provider/index.ts`
- Test: `tests/entities/provider/provider-store.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/entities/provider/provider-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({
  fetchProviders: vi.fn(async () => [{ id: 'openai', connected: true, method: 'apiKey' as const }]),
  fetchModels: vi.fn(async () => [{ id: 'gpt-4o' }]),
}));
vi.mock('../../../src/entities/provider/api/provider.api', () => apiMock);

import { useProviderStore } from '../../../src/entities/provider/model/provider.store';

beforeEach(() => {
  useProviderStore.setState({ selectedProviderId: 'claude-bridge', selectedModelId: null, statuses: {}, models: {}, loadingModels: {} });
  vi.clearAllMocks();
});

describe('useProviderStore', () => {
  it('refreshProviders는 statuses를 id맵으로 채운다', async () => {
    await useProviderStore.getState().refreshProviders();
    expect(useProviderStore.getState().statuses.openai?.connected).toBe(true);
  });

  it('refreshModels는 캐시가 있으면 force 없이는 재조회하지 않는다', async () => {
    useProviderStore.setState({ models: { openai: [{ id: 'cached' }] } });
    await useProviderStore.getState().refreshModels('openai');
    expect(apiMock.fetchModels).not.toHaveBeenCalled();
    await useProviderStore.getState().refreshModels('openai', true);
    expect(apiMock.fetchModels).toHaveBeenCalledWith('openai', true);
  });

  it('select는 프로바이더·모델을 갱신한다', () => {
    useProviderStore.getState().select('openai', 'gpt-4o');
    expect(useProviderStore.getState().selectedProviderId).toBe('openai');
    expect(useProviderStore.getState().selectedModelId).toBe('gpt-4o');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/entities/provider/provider-store.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 스토어 구현**

```ts
// src/entities/provider/model/provider.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthMethod, ModelInfo, ProviderStatus } from './provider.types';
import * as api from '../api/provider.api';

interface ProviderStore {
  selectedProviderId: string;
  selectedModelId: string | null;
  statuses: Record<string, { connected: boolean; method?: AuthMethod }>;
  models: Record<string, ModelInfo[]>;
  loadingModels: Record<string, boolean>;

  refreshProviders: () => Promise<void>;
  refreshModels: (id: string, force?: boolean) => Promise<void>;
  saveApiKey: (id: string, key: string) => Promise<void>;
  saveSessionToken: (id: string, token: string) => Promise<void>;
  startOAuth: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  select: (providerId: string, modelId: string | null) => void;
}

export const useProviderStore = create<ProviderStore>()(
  persist(
    (set, get) => ({
      selectedProviderId: 'claude-bridge',
      selectedModelId: null,
      statuses: {},
      models: {},
      loadingModels: {},

      refreshProviders: async () => {
        const list: ProviderStatus[] = await api.fetchProviders();
        const statuses: ProviderStore['statuses'] = {};
        for (const s of list) statuses[s.id] = { connected: s.connected, method: s.method };
        set({ statuses });
      },

      refreshModels: async (id, force = false) => {
        if (!force && get().models[id]?.length) return;
        set(s => ({ loadingModels: { ...s.loadingModels, [id]: true } }));
        try {
          const models = await api.fetchModels(id, force);
          set(s => ({ models: { ...s.models, [id]: models } }));
        } finally {
          set(s => ({ loadingModels: { ...s.loadingModels, [id]: false } }));
        }
      },

      saveApiKey: async (id, key) => { await api.saveApiKey(id, key); await get().refreshProviders(); },
      saveSessionToken: async (id, token) => { await api.saveSessionToken(id, token); await get().refreshProviders(); },
      startOAuth: async (id) => { const { authUrl } = await api.startOAuth(id); window.open(authUrl, '_blank', 'width=520,height=720'); },
      disconnect: async (id) => { await api.disconnect(id); await get().refreshProviders(); },

      select: (providerId, modelId) => set({ selectedProviderId: providerId, selectedModelId: modelId }),
    }),
    {
      name: 'kb-provider',
      partialize: s => ({ selectedProviderId: s.selectedProviderId, selectedModelId: s.selectedModelId }),
    },
  ),
);
```

- [ ] **Step 4: 배럴 작성**

```ts
// src/entities/provider/index.ts
export { PROVIDERS, getProvider } from './model/registry';
export { useProviderStore } from './model/provider.store';
export type { ProviderDef, ModelInfo, AuthMethod, ProviderStatus, ApiShape, SubscriptionKind } from './model/provider.types';
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/entities/provider/provider-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: 커밋(확인 후)**

```bash
git add src/entities/provider/model/provider.store.ts src/entities/provider/index.ts tests/entities/provider/provider-store.test.ts
git commit -m "feat(provider): 선택/모델캐시 zustand 스토어 추가"
```

---

## Task 4: 서버 자격증명 스토어

**Files:**
- Create: `vite-plugins/credentials-store.ts`
- Test: `tests/vite-plugins/credentials-store.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/vite-plugins/credentials-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readOne, writeOne, removeOne, toStatuses } from '../../vite-plugins/credentials-store';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'cred-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

describe('credentials-store', () => {
  it('writeOne 후 readOne으로 되읽는다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'sk-1' });
    expect((await readOne(root, 'openai'))?.apiKey).toBe('sk-1');
  });

  it('writeOne은 다른 프로바이더를 보존(병합)한다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'a' });
    await writeOne(root, 'xai', { method: 'subscription', token: 'b' });
    expect((await readOne(root, 'openai'))?.apiKey).toBe('a');
    expect((await readOne(root, 'xai'))?.token).toBe('b');
  });

  it('removeOne은 해당 항목만 지운다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'a' });
    await removeOne(root, 'openai');
    expect(await readOne(root, 'openai')).toBeNull();
  });

  it('toStatuses는 비밀을 노출하지 않고 connected/method만 낸다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'sk-secret' });
    const statuses = await toStatuses(root);
    const openai = statuses.find(s => s.id === 'openai');
    expect(openai).toEqual({ id: 'openai', connected: true, method: 'apiKey' });
    expect(JSON.stringify(statuses)).not.toContain('sk-secret');
  });

  it('claude-bridge는 항상 connected로 표기된다', async () => {
    const statuses = await toStatuses(root);
    expect(statuses.find(s => s.id === 'claude-bridge')).toEqual({ id: 'claude-bridge', connected: true });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/vite-plugins/credentials-store.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```ts
// vite-plugins/credentials-store.ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PROVIDERS } from '../src/entities/provider/model/registry';
import type { AuthMethod, ProviderStatus } from '../src/entities/provider/model/provider.types';

export interface Credential {
  method: AuthMethod;
  apiKey?: string;       // apiKey
  token?: string;        // session-token 구독
  accessToken?: string;  // oauth
  refreshToken?: string;
  expiresAt?: number;
}
export type CredentialStore = Record<string, Credential>;

const FILE = '.analysis/providers.local.json';

function filePath(root: string): string {
  return path.join(root, FILE);
}

export async function readAll(root: string): Promise<CredentialStore> {
  const raw = await fs.readFile(filePath(root), 'utf8').catch(() => null);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CredentialStore;
  } catch {
    return {};
  }
}

export async function readOne(root: string, id: string): Promise<Credential | null> {
  return (await readAll(root))[id] ?? null;
}

async function writeAll(root: string, store: CredentialStore): Promise<void> {
  const target = filePath(root);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(tmp, target);
}

export async function writeOne(root: string, id: string, cred: Credential): Promise<void> {
  const store = await readAll(root);
  await writeAll(root, { ...store, [id]: cred });
}

export async function removeOne(root: string, id: string): Promise<void> {
  const store = await readAll(root);
  delete store[id];
  await writeAll(root, store);
}

// 비밀을 제외한 연결 상태만. claude-bridge는 항상 connected.
export async function toStatuses(root: string): Promise<ProviderStatus[]> {
  const store = await readAll(root);
  return PROVIDERS.map(p => {
    if (p.apiShape === 'claude-bridge') return { id: p.id, connected: true };
    const cred = store[p.id];
    return cred ? { id: p.id, connected: true, method: cred.method } : { id: p.id, connected: false };
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/vite-plugins/credentials-store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋(확인 후)**

```bash
git add vite-plugins/credentials-store.ts tests/vite-plugins/credentials-store.test.ts
git commit -m "feat(bridge): 서버측 자격증명 스토어 추가"
```

---

## Task 5: OAuth PKCE 헬퍼

**Files:**
- Create: `vite-plugins/oauth.ts`
- Test: `tests/vite-plugins/oauth.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/vite-plugins/oauth.test.ts
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { createVerifier, challengeFor, createState, base64url } from '../../vite-plugins/oauth';

describe('oauth PKCE', () => {
  it('verifier는 43~128자 url-safe 문자열', () => {
    const v = createVerifier();
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(v.length).toBeGreaterThanOrEqual(43);
  });

  it('challengeFor는 verifier의 S256 base64url 해시', () => {
    const v = 'test-verifier';
    const expected = base64url(crypto.createHash('sha256').update(v).digest());
    expect(challengeFor(v)).toBe(expected);
  });

  it('createState는 매번 다른 값', () => {
    expect(createState()).not.toBe(createState());
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/vite-plugins/oauth.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```ts
// vite-plugins/oauth.ts
import crypto from 'node:crypto';

export function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createVerifier(): string {
  return base64url(crypto.randomBytes(48)); // 64자 내외
}

export function challengeFor(verifier: string): string {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

export function createState(): string {
  return base64url(crypto.randomBytes(16));
}

export interface PkceSession {
  providerId: string;
  verifier: string;
  createdAt: number;
}

// state → 세션. dev 서버 수명 동안만 유효(메모리).
export const pkceSessions = new Map<string, PkceSession>();

export function putSession(state: string, session: PkceSession): void {
  pkceSessions.set(state, session);
  // 10분 후 정리
  setTimeout(() => pkceSessions.delete(state), 10 * 60 * 1000).unref?.();
}

export function takeSession(state: string): PkceSession | undefined {
  const s = pkceSessions.get(state);
  if (s) pkceSessions.delete(state);
  return s;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/vite-plugins/oauth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋(확인 후)**

```bash
git add vite-plugins/oauth.ts tests/vite-plugins/oauth.test.ts
git commit -m "feat(bridge): OAuth PKCE 헬퍼 추가"
```

---

## Task 6: 프로바이더 어댑터 (모델조회 + 채팅)

**Files:**
- Create: `vite-plugins/adapters/openai-compatible.ts`
- Create: `vite-plugins/adapters/anthropic.ts`
- Create: `vite-plugins/adapters/gemini.ts`
- Create: `vite-plugins/adapters/index.ts`
- Test: `tests/vite-plugins/adapters.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/vite-plugins/adapters.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdapter } from '../../vite-plugins/adapters';
import type { ProviderDef } from '../../src/entities/provider/model/provider.types';

const openaiDef: ProviderDef = { id: 'openai', label: 'OpenAI', apiShape: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', auth: ['apiKey'] };
const anthropicDef: ProviderDef = { id: 'anthropic', label: 'Anthropic', apiShape: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', auth: ['apiKey'] };
const geminiDef: ProviderDef = { id: 'google', label: 'Gemini', apiShape: 'gemini', baseUrl: 'https://gen.googleapis.com/v1beta', auth: ['apiKey'] };

const mockFetch = (body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') } as Response);

beforeEach(() => vi.restoreAllMocks());

describe('adapters.listModels', () => {
  it('openai-compatible: data[].id 파싱', async () => {
    mockFetch({ data: [{ id: 'gpt-4o' }, { id: 'o1' }] });
    const models = await getAdapter('openai-compatible').listModels(openaiDef, { method: 'apiKey', apiKey: 'k' });
    expect(models.map(m => m.id)).toEqual(['gpt-4o', 'o1']);
  });

  it('gemini: models[].name에서 prefix 제거', async () => {
    mockFetch({ models: [{ name: 'models/gemini-1.5-pro' }] });
    const models = await getAdapter('gemini').listModels(geminiDef, { method: 'apiKey', apiKey: 'k' });
    expect(models[0]?.id).toBe('gemini-1.5-pro');
  });
});

describe('adapters.chat', () => {
  it('openai-compatible: choices[0].message.content 반환', async () => {
    const spy = mockFetch({ choices: [{ message: { content: '# 결과' } }] });
    const out = await getAdapter('openai-compatible').chat(openaiDef, { method: 'apiKey', apiKey: 'k' }, { system: 'S', user: 'U', model: 'gpt-4o' });
    expect(out).toBe('# 결과');
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer k' });
  });

  it('anthropic: content[0].text 반환 + system 분리', async () => {
    const spy = mockFetch({ content: [{ type: 'text', text: '안녕' }] });
    const out = await getAdapter('anthropic').chat(anthropicDef, { method: 'apiKey', apiKey: 'k' }, { system: 'S', user: 'U', model: 'claude-x' });
    expect(out).toBe('안녕');
    const body = JSON.parse((spy.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.system).toBe('S');
    expect(body.messages).toEqual([{ role: 'user', content: 'U' }]);
  });

  it('gemini: candidates[0].content.parts[0].text 반환', async () => {
    mockFetch({ candidates: [{ content: { parts: [{ text: '지' }] } }] });
    const out = await getAdapter('gemini').chat(geminiDef, { method: 'apiKey', apiKey: 'k' }, { system: 'S', user: 'U', model: 'gemini-1.5-pro' });
    expect(out).toBe('지');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/vite-plugins/adapters.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 공통 타입 + openai-compatible 어댑터**

```ts
// vite-plugins/adapters/openai-compatible.ts
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
```

- [ ] **Step 4: anthropic 어댑터**

```ts
// vite-plugins/adapters/anthropic.ts
import type { Adapter } from './openai-compatible';
import type { Credential } from '../credentials-store';

function headers(cred: Credential): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (cred.apiKey) h['x-api-key'] = cred.apiKey;
  else if (cred.accessToken) h['Authorization'] = `Bearer ${cred.accessToken}`;
  else throw new Error('자격증명이 없습니다.');
  return h;
}

async function asJson(res: Response): Promise<Record<string, unknown>> {
  if (!res.ok) throw new Error(`Anthropic 오류 (${res.status}) ${await res.text().catch(() => '')}`);
  return (await res.json()) as Record<string, unknown>;
}

export const anthropic: Adapter = {
  async listModels(def, cred) {
    const json = await asJson(await fetch(`${def.baseUrl}/models`, { headers: headers(cred) }));
    const data = (json.data as { id: string }[]) ?? [];
    return data.map(m => ({ id: m.id }));
  },
  async chat(def, cred, { system, user, model }) {
    const json = await asJson(
      await fetch(`${def.baseUrl}/messages`, {
        method: 'POST',
        headers: headers(cred),
        body: JSON.stringify({ model, max_tokens: 4096, system, messages: [{ role: 'user', content: user }] }),
      }),
    );
    const content = json.content as { type: string; text?: string }[] | undefined;
    return content?.map(c => c.text ?? '').join('') ?? '';
  },
};
```

- [ ] **Step 5: gemini 어댑터**

```ts
// vite-plugins/adapters/gemini.ts
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
```

- [ ] **Step 6: 어댑터 선택기**

```ts
// vite-plugins/adapters/index.ts
import type { ApiShape } from '../../src/entities/provider/model/provider.types';
import { openAiCompatible, type Adapter } from './openai-compatible';
import { anthropic } from './anthropic';
import { gemini } from './gemini';

export type { Adapter, ChatInput } from './openai-compatible';

export function getAdapter(shape: ApiShape): Adapter {
  switch (shape) {
    case 'openai-compatible': return openAiCompatible;
    case 'anthropic': return anthropic;
    case 'gemini': return gemini;
    case 'claude-bridge': throw new Error('claude-bridge는 어댑터가 아닌 디스크 흐름으로 처리됩니다.');
  }
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npx vitest run tests/vite-plugins/adapters.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 8: 커밋(확인 후)**

```bash
git add vite-plugins/adapters tests/vite-plugins/adapters.test.ts
git commit -m "feat(bridge): 프로바이더 어댑터 3종(모델조회·채팅) 추가"
```

---

## Task 7: 프로바이더 브릿지 엔드포인트 + 등록

**Files:**
- Create: `vite-plugins/provider-bridge.ts`
- Modify: `vite.config.ts`
- Test: `tests/vite-plugins/provider-bridge.test.ts`

> 미들웨어 자체보다 **순수 헬퍼**(`listProviderModels`)를 테스트한다. HTTP 라우팅은 얇은 글루로 둔다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// tests/vite-plugins/provider-bridge.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeOne } from '../../vite-plugins/credentials-store';
import { listProviderModels } from '../../vite-plugins/provider-bridge';

let root: string;
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'pb-')); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('listProviderModels', () => {
  it('자격증명이 없으면 에러', async () => {
    await expect(listProviderModels(root, 'openai', false)).rejects.toThrow(/연결/);
  });

  it('알 수 없는 프로바이더면 에러', async () => {
    await expect(listProviderModels(root, 'nope', false)).rejects.toThrow(/알 수 없는/);
  });

  it('연결돼 있으면 어댑터로 모델을 조회한다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'k' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [{ id: 'gpt-4o' }] }), text: () => Promise.resolve('') } as Response);
    const models = await listProviderModels(root, 'openai', true);
    expect(models[0]?.id).toBe('gpt-4o');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/vite-plugins/provider-bridge.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```ts
// vite-plugins/provider-bridge.ts
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { getProvider, PROVIDERS } from '../src/entities/provider/model/registry';
import type { ModelInfo } from '../src/entities/provider/model/provider.types';
import { readOne, writeOne, removeOne, toStatuses, type Credential } from './credentials-store';
import { getAdapter } from './adapters';
import { createVerifier, challengeFor, createState, putSession, takeSession } from './oauth';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

// 모델 라이브 조회(테스트 대상 헬퍼).
export async function listProviderModels(root: string, id: string, _force: boolean): Promise<ModelInfo[]> {
  const def = getProvider(id);
  if (!def) throw new Error(`알 수 없는 프로바이더: ${id}`);
  if (def.apiShape === 'claude-bridge') return [];
  const cred = await readOne(root, id);
  if (!cred) throw new Error(`연결되지 않은 프로바이더: ${id}`);
  return getAdapter(def.apiShape).listModels(def, cred);
}

export function providerBridge(): Plugin {
  return {
    name: 'provider-bridge',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root;

      // /api/providers ...
      server.middlewares.use('/api/providers', (req, res, next) => {
        const method = req.method ?? 'GET';
        const url = (req.url ?? '').split('?')[0]!.replace(/^\//, ''); // '', 'openai/models', 'openai/credentials', 'openai/oauth/start'
        const refresh = (req.url ?? '').includes('refresh=1');
        const [id, sub, action] = url.split('/');

        void (async () => {
          try {
            // GET /api/providers
            if (method === 'GET' && url === '') {
              sendJson(res, 200, await toStatuses(root));
              return;
            }
            if (!id || !getProvider(id)) { sendJson(res, 404, { error: '알 수 없는 프로바이더' }); return; }

            // GET /api/providers/:id/models
            if (method === 'GET' && sub === 'models') {
              sendJson(res, 200, await listProviderModels(root, id, refresh));
              return;
            }
            // POST/DELETE /api/providers/:id/credentials
            if (sub === 'credentials') {
              if (method === 'POST') {
                const parsed = JSON.parse(await readBody(req)) as Partial<Credential>;
                if (parsed.method !== 'apiKey' && parsed.method !== 'subscription') { sendJson(res, 400, { error: '잘못된 method' }); return; }
                await writeOne(root, id, parsed as Credential);
                sendJson(res, 200, { ok: true });
                return;
              }
              if (method === 'DELETE') { await removeOne(root, id); sendJson(res, 200, { ok: true }); return; }
            }
            // GET /api/providers/:id/oauth/start
            if (method === 'GET' && sub === 'oauth' && action === 'start') {
              const def = getProvider(id)!;
              const cfg = def.subscription;
              if (cfg?.kind !== 'oauth-pkce' || !cfg.authorizeUrl) { sendJson(res, 400, { error: 'OAuth 미지원 프로바이더' }); return; }
              const verifier = createVerifier();
              const state = createState();
              putSession(state, { providerId: id, verifier, createdAt: Date.now() });
              const redirectUri = `http://localhost:${server.config.server.port ?? 5174}/api/oauth/callback`;
              const params = new URLSearchParams({
                response_type: 'code',
                client_id: cfg.clientId ?? '',
                redirect_uri: redirectUri,
                scope: (cfg.scopes ?? []).join(' '),
                state,
                code_challenge: challengeFor(verifier),
                code_challenge_method: 'S256',
              });
              sendJson(res, 200, { authUrl: `${cfg.authorizeUrl}?${params.toString()}` });
              return;
            }
            next();
          } catch (err) {
            sendJson(res, 500, { error: err instanceof Error ? err.message : '프로바이더 처리 실패' });
          }
        })();
      });

      // GET /api/oauth/callback?code&state
      server.middlewares.use('/api/oauth/callback', (req, res) => {
        void (async () => {
          try {
            const u = new URL(req.url ?? '', 'http://localhost');
            const code = u.searchParams.get('code');
            const state = u.searchParams.get('state');
            const session = state ? takeSession(state) : undefined;
            if (!code || !session) { res.statusCode = 400; res.end('잘못된 OAuth 콜백입니다. 창을 닫아주세요.'); return; }
            const def = getProvider(session.providerId)!;
            const cfg = def.subscription!;
            const redirectUri = `http://localhost:${server.config.server.port ?? 5174}/api/oauth/callback`;
            const tokenRes = await fetch(cfg.tokenUrl!, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: cfg.clientId ?? '',
                redirect_uri: redirectUri,
                code_verifier: session.verifier,
              }).toString(),
            });
            const tok = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number };
            if (!tokenRes.ok || !tok.access_token) { res.statusCode = 502; res.end('토큰 교환 실패. 창을 닫고 다시 시도하세요.'); return; }
            await writeOne(root, session.providerId, {
              method: 'subscription',
              accessToken: tok.access_token,
              refreshToken: tok.refresh_token,
              expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
            });
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<script>window.opener&&window.opener.postMessage({type:"oauth-done"},"*");window.close();</script>구독 연결 완료. 이 창을 닫아주세요.');
          } catch (err) {
            res.statusCode = 500;
            res.end(`OAuth 오류: ${err instanceof Error ? err.message : ''}`);
          }
        })();
      });

      // 사용 안내(레지스트리 노출은 안 함 — 상태는 toStatuses로 충분)
      void PROVIDERS;
    },
  };
}
```

- [ ] **Step 4: vite.config 등록**

```ts
// vite.config.ts (수정)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { analysisBridge } from './vite-plugins/analysis-bridge'
import { providerBridge } from './vite-plugins/provider-bridge'

export default defineConfig({
  plugins: [react(), analysisBridge(), providerBridge()],
  css: {
    postcss: './postcss.config.js'
  },
  server: {
    host: '0.0.0.0',
    port: 5174
  }
})
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/vite-plugins/provider-bridge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: 커밋(확인 후)**

```bash
git add vite-plugins/provider-bridge.ts vite.config.ts tests/vite-plugins/provider-bridge.test.ts
git commit -m "feat(bridge): 프로바이더/OAuth 엔드포인트 + 등록"
```

---

## Task 8: 분석 페이로드 확장 + 프로바이더 프록시 실행

**Files:**
- Modify: `src/entities/analysis/model/analysis.types.ts`
- Create: `vite-plugins/analysis-runner.ts`
- Modify: `vite-plugins/analysis-bridge.ts`
- Test: `tests/vite-plugins/analysis-runner.test.ts`

- [ ] **Step 1: AnalysisRequest 타입 확장**

```ts
// src/entities/analysis/model/analysis.types.ts 의 AnalysisRequest 에 두 필드 추가
export interface AnalysisRequest {
  id?: string;
  generatedAt: string;
  scope: AnalysisScope;
  datasets: AnalysisDataset[];
  provider?: string;       // 추가: 미지정 시 claude-bridge
  model?: string | null;   // 추가
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

```ts
// tests/vite-plugins/analysis-runner.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeOne } from '../../vite-plugins/credentials-store';
import { buildMessages, runProviderAnalysis } from '../../vite-plugins/analysis-runner';

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'run-'));
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.writeFile(path.join(root, 'docs/analysis-prompt.md'), '시스템 프롬프트', 'utf8');
  await fs.mkdir(path.join(root, '.analysis/responses'), { recursive: true });
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); vi.restoreAllMocks(); });

const req = {
  generatedAt: '2026-06-11T00:00:00Z',
  scope: { mode: 'weekly' as const, regions: ['서울특별시'], regionLabels: { 서울특별시: '서울' }, period: { from: '2023-01-01', to: '2026-01-01' }, tabs: ['weekly-price' as const] },
  datasets: [],
  provider: 'openai',
  model: 'gpt-4o',
};

describe('analysis-runner', () => {
  it('buildMessages는 system=프롬프트, user=직렬화 payload', async () => {
    const { system, user } = await buildMessages(root, req);
    expect(system).toContain('시스템 프롬프트');
    expect(user).toContain('서울특별시');
  });

  it('성공 시 응답 .md를 쓴다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'k' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: () => Promise.resolve({ choices: [{ message: { content: '# 분석결과' } }] }), text: () => Promise.resolve('') } as Response);
    await runProviderAnalysis(root, 'id1', req);
    const md = await fs.readFile(path.join(root, '.analysis/responses/id1.md'), 'utf8');
    expect(md).toBe('# 분석결과');
  });

  it('실패 시 .error.txt를 쓴다', async () => {
    await writeOne(root, 'openai', { method: 'apiKey', apiKey: 'k' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('unauthorized') } as Response);
    await runProviderAnalysis(root, 'id2', req);
    const err = await fs.readFile(path.join(root, '.analysis/responses/id2.error.txt'), 'utf8');
    expect(err).toContain('401');
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run tests/vite-plugins/analysis-runner.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 4: analysis-runner 구현**

```ts
// vite-plugins/analysis-runner.ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getProvider } from '../src/entities/provider/model/registry';
import { readOne } from './credentials-store';
import { getAdapter } from './adapters';

interface AnalysisRequestLike {
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
  await fs.mkdir(responses, { recursive: true });
  try {
    const def = getProvider(req.provider ?? '');
    if (!def || def.apiShape === 'claude-bridge') throw new Error(`프록시 대상이 아닌 프로바이더: ${req.provider}`);
    const cred = await readOne(root, def.id);
    if (!cred) throw new Error(`연결되지 않은 프로바이더: ${def.id}`);
    const { system, user } = await buildMessages(root, req);
    const text = await getAdapter(def.apiShape).chat(def, cred, { system, user, model: req.model ?? '' });
    await fs.writeFile(path.join(responses, `${id}.md`), text || '_빈 응답_', 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '분석 실행 실패';
    await fs.writeFile(path.join(responses, `${id}.error.txt`), msg, 'utf8');
  }
}
```

- [ ] **Step 5: analysis-bridge 분기 + GET 에러 surface**

```ts
// vite-plugins/analysis-bridge.ts 의 POST 블록에서 record 저장(rename) 직후에 추가:
//   await fs.rename(tmp, target);
//   // ▼ 추가: 프로바이더 프록시 (claude-bridge 외)
//   const provider = (parsed as { provider?: string }).provider;
//   if (provider && provider !== 'claude-bridge') {
//     void runProviderAnalysis(root, id, { ...(parsed as any), id });
//   }
//   sendJson(res, 200, { id, status: 'pending' });
//
// 파일 상단에 import 추가:
//   import { runProviderAnalysis } from './analysis-runner';
//
// GET 블록에서 응답 읽기 전에 .error.txt 우선 확인:
//   const errFile = path.join(responsesDir, `${id}.error.txt`);
//   const errText = await fs.readFile(errFile, 'utf8').catch(() => null);
//   if (errText != null) { sendJson(res, 200, { status: 'error', error: errText }); return; }
//   const file = path.join(responsesDir, `${id}.md`);
//   ... 기존 로직 유지 ...
```

실제 편집 후 `analysis-bridge.ts` POST/GET 핸들러가 위 동작을 포함하는지 확인한다. (claude-bridge·미지정 provider는 기존 디스크+감시스크립트 흐름 그대로.)

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/vite-plugins/analysis-runner.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: 커밋(확인 후)**

```bash
git add src/entities/analysis/model/analysis.types.ts vite-plugins/analysis-runner.ts vite-plugins/analysis-bridge.ts tests/vite-plugins/analysis-runner.test.ts
git commit -m "feat(analysis): provider/model 페이로드 + 프로바이더 프록시 실행"
```

---

## Task 9: ProviderSelector UI (상단 바)

**Files:**
- Create: `src/features/analysis/ui/ProviderSelector.tsx`
- Test: `tests/features/analysis/provider-selector.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/features/analysis/provider-selector.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProviderSelector } from '../../../src/features/analysis/ui/ProviderSelector';
import { useProviderStore } from '../../../src/entities/provider';

vi.spyOn(useProviderStore.getState(), 'refreshModels').mockResolvedValue();

beforeEach(() => {
  useProviderStore.setState({
    selectedProviderId: 'openai', selectedModelId: 'gpt-4o',
    statuses: { openai: { connected: true, method: 'apiKey' } },
    models: { openai: [{ id: 'gpt-4o' }, { id: 'o1' }] },
    loadingModels: {},
  });
});

describe('ProviderSelector', () => {
  it('프로바이더·모델 드롭다운을 렌더한다', () => {
    render(<ProviderSelector onManage={() => {}} />);
    expect(screen.getByLabelText('프로바이더')).toHaveValue('openai');
    expect(screen.getByLabelText('모델')).toHaveValue('gpt-4o');
  });

  it('모델 변경 시 select가 호출된다', () => {
    const selectSpy = vi.spyOn(useProviderStore.getState(), 'select');
    render(<ProviderSelector onManage={() => {}} />);
    fireEvent.change(screen.getByLabelText('모델'), { target: { value: 'o1' } });
    expect(selectSpy).toHaveBeenCalledWith('openai', 'o1');
  });

  it('관리 버튼 클릭 시 onManage 호출', () => {
    const onManage = vi.fn();
    render(<ProviderSelector onManage={onManage} />);
    fireEvent.click(screen.getByLabelText('프로바이더 관리'));
    expect(onManage).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/features/analysis/provider-selector.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```tsx
// src/features/analysis/ui/ProviderSelector.tsx
import React, { useEffect } from 'react';
import { Settings, RefreshCw } from 'lucide-react';
import { PROVIDERS, getProvider, useProviderStore } from '../../../entities/provider';

interface ProviderSelectorProps {
  onManage: () => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({ onManage }) => {
  const selectedProviderId = useProviderStore(s => s.selectedProviderId);
  const selectedModelId = useProviderStore(s => s.selectedModelId);
  const models = useProviderStore(s => s.models[selectedProviderId]) ?? [];
  const loading = useProviderStore(s => s.loadingModels[selectedProviderId] ?? false);
  const select = useProviderStore(s => s.select);
  const refreshModels = useProviderStore(s => s.refreshModels);

  const def = getProvider(selectedProviderId);
  const isBridge = def?.apiShape === 'claude-bridge';

  // 프로바이더 바뀌면 모델 목록 확보
  useEffect(() => {
    if (!isBridge) void refreshModels(selectedProviderId);
  }, [selectedProviderId, isBridge, refreshModels]);

  return (
    <div className="mb-4 flex items-center gap-2">
      <label className="sr-only" htmlFor="prov">프로바이더</label>
      <select
        id="prov"
        aria-label="프로바이더"
        value={selectedProviderId}
        onChange={e => select(e.target.value, null)}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
      >
        {PROVIDERS.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      {!isBridge && (
        <>
          <label className="sr-only" htmlFor="model">모델</label>
          <select
            id="model"
            aria-label="모델"
            value={selectedModelId ?? ''}
            onChange={e => select(selectedProviderId, e.target.value || null)}
            className="min-w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">{loading ? '불러오는 중…' : '모델 선택'}</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.label ?? m.id}</option>
            ))}
          </select>
          <button
            aria-label="모델 새로고침"
            onClick={() => void refreshModels(selectedProviderId, true)}
            className="rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </>
      )}

      <button
        aria-label="프로바이더 관리"
        onClick={onManage}
        className="ml-auto rounded-lg border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  );
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/features/analysis/provider-selector.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋(확인 후)**

```bash
git add src/features/analysis/ui/ProviderSelector.tsx tests/features/analysis/provider-selector.test.tsx
git commit -m "feat(analysis): 프로바이더·모델 셀렉터 바 추가"
```

---

## Task 10: ProviderManager UI (관리 뷰)

**Files:**
- Create: `src/features/analysis/ui/ProviderManager.tsx`
- Test: `tests/features/analysis/provider-manager.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/features/analysis/provider-manager.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProviderManager } from '../../../src/features/analysis/ui/ProviderManager';
import { useProviderStore } from '../../../src/entities/provider';

beforeEach(() => {
  useProviderStore.setState({
    statuses: { openai: { connected: false }, xai: { connected: true, method: 'subscription' } },
    models: {}, loadingModels: {},
  });
  vi.restoreAllMocks();
});

describe('ProviderManager', () => {
  it('각 프로바이더 행과 연결상태를 보여준다', () => {
    render(<ProviderManager onBack={() => {}} />);
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('xAI (Grok)')).toBeInTheDocument();
  });

  it('API 키 입력 후 저장 시 saveApiKey 호출', async () => {
    const spy = vi.spyOn(useProviderStore.getState(), 'saveApiKey').mockResolvedValue();
    render(<ProviderManager onBack={() => {}} />);
    fireEvent.click(screen.getAllByText('API 키')[0]!);
    fireEvent.change(screen.getByPlaceholderText('API 키 입력'), { target: { value: 'sk-z' } });
    fireEvent.click(screen.getByText('저장'));
    expect(spy).toHaveBeenCalledWith('openai', 'sk-z');
  });

  it('연결된 프로바이더는 연결해제 버튼을 보인다', () => {
    const spy = vi.spyOn(useProviderStore.getState(), 'disconnect').mockResolvedValue();
    render(<ProviderManager onBack={() => {}} />);
    fireEvent.click(screen.getByLabelText('xai 연결해제'));
    expect(spy).toHaveBeenCalledWith('xai');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/features/analysis/provider-manager.test.tsx`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

```tsx
// src/features/analysis/ui/ProviderManager.tsx
import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { PROVIDERS, useProviderStore } from '../../../entities/provider';

interface ProviderManagerProps {
  onBack: () => void;
}

export const ProviderManager: React.FC<ProviderManagerProps> = ({ onBack }) => {
  const statuses = useProviderStore(s => s.statuses);
  const refreshProviders = useProviderStore(s => s.refreshProviders);
  const saveApiKey = useProviderStore(s => s.saveApiKey);
  const saveSessionToken = useProviderStore(s => s.saveSessionToken);
  const startOAuth = useProviderStore(s => s.startOAuth);
  const disconnect = useProviderStore(s => s.disconnect);

  const [openForm, setOpenForm] = useState<{ id: string; kind: 'apiKey' | 'token' } | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => { void refreshProviders(); }, [refreshProviders]);

  const submit = async () => {
    if (!openForm || !value.trim()) return;
    if (openForm.kind === 'apiKey') await saveApiKey(openForm.id, value.trim());
    else await saveSessionToken(openForm.id, value.trim());
    setOpenForm(null);
    setValue('');
  };

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> 돌아가기
      </button>

      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
        {PROVIDERS.filter(p => p.apiShape !== 'claude-bridge').map(p => {
          const st = statuses[p.id];
          const sub = p.subscription;
          return (
            <li key={p.id} className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{p.label}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${st?.connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {st?.connected ? '연결됨' : '미연결'}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  {p.auth.includes('apiKey') && (
                    <button onClick={() => { setOpenForm({ id: p.id, kind: 'apiKey' }); setValue(''); }} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">API 키</button>
                  )}
                  {p.auth.includes('subscription') && sub?.kind === 'oauth-pkce' && (
                    <button onClick={() => void startOAuth(p.id)} className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">구독으로 로그인</button>
                  )}
                  {p.auth.includes('subscription') && sub?.kind === 'session-token' && (
                    <button onClick={() => { setOpenForm({ id: p.id, kind: 'token' }); setValue(''); }} className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50">구독 토큰</button>
                  )}
                  {st?.connected && (
                    <button aria-label={`${p.id} 연결해제`} onClick={() => void disconnect(p.id)} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">연결해제</button>
                  )}
                </div>
              </div>

              {openForm?.id === p.id && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      placeholder={openForm.kind === 'apiKey' ? 'API 키 입력' : '구독 토큰 입력'}
                      value={value}
                      onChange={e => setValue(e.target.value)}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button onClick={() => void submit()} className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">저장</button>
                    <button onClick={() => setOpenForm(null)} className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600">취소</button>
                  </div>
                  {openForm.kind === 'token' && sub?.tokenHint && <p className="text-xs text-gray-400">{sub.tokenHint}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/features/analysis/provider-manager.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋(확인 후)**

```bash
git add src/features/analysis/ui/ProviderManager.tsx tests/features/analysis/provider-manager.test.tsx
git commit -m "feat(analysis): 프로바이더 관리 뷰 추가"
```

---

## Task 11: AnalysisModal 통합 (셀렉터·관리뷰·payload)

**Files:**
- Modify: `src/features/analysis/ui/AnalysisModal.tsx`
- Test: `tests/features/analysis/analysis-modal-provider.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// tests/features/analysis/analysis-modal-provider.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const runAnalysisMock = vi.hoisted(() => vi.fn(async () => ({ id: 'x', status: 'done', result: '# ok' })));
vi.mock('../../../src/entities/analysis', async (orig) => {
  const actual = await orig<typeof import('../../../src/entities/analysis')>();
  return { ...actual, runAnalysis: runAnalysisMock };
});
vi.mock('../../../src/features/analysis/lib/collect', () => ({
  collectCurrentView: () => ({ generatedAt: 't', scope: { mode: 'weekly', regions: ['서울특별시'], regionLabels: { 서울특별시: '서울' }, period: { from: 'a', to: 'b' }, tabs: ['weekly-price'] }, datasets: [{ tab: 'weekly-price', metric: 'm', label: 'l', unit: '', byRegion: { 서울특별시: {} } }] }),
  collectFor: vi.fn(), selectedRegionUnion: () => [{ region: '서울특별시', label: '서울' }], collectTabs: vi.fn(), ALL_TABS: [],
}));

import { AnalysisModal } from '../../../src/features/analysis/ui/AnalysisModal';
import { useProviderStore } from '../../../src/entities/provider';
import { useMonthlyStore } from '../../../src/shared/lib/monthly-store';
import { useAppStore } from '../../../src/shared/lib/store';

beforeEach(() => {
  runAnalysisMock.mockClear();
  useProviderStore.setState({ selectedProviderId: 'openai', selectedModelId: 'gpt-4o', statuses: { openai: { connected: true, method: 'apiKey' } }, models: { openai: [{ id: 'gpt-4o' }] }, loadingModels: {} });
  useMonthlyStore.setState({ mode: 'weekly', weeklyTab: 'price' } as never);
  useAppStore.setState({ selectedRegions: ['서울특별시'], regionLabels: { 서울특별시: '서울' }, fromDate: 'a', toDate: 'b' } as never);
});

describe('AnalysisModal × provider', () => {
  it('분석 실행 시 payload에 provider/model을 포함한다', async () => {
    render(<AnalysisModal open onClose={() => {}} />);
    fireEvent.click(screen.getByText('분석하기'));
    await waitFor(() => expect(runAnalysisMock).toHaveBeenCalled());
    const payload = runAnalysisMock.mock.calls[0]![0] as { provider?: string; model?: string };
    expect(payload.provider).toBe('openai');
    expect(payload.model).toBe('gpt-4o');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/features/analysis/analysis-modal-provider.test.tsx`
Expected: FAIL — payload에 provider 없음.

- [ ] **Step 3: AnalysisModal 수정**

import 추가:

```tsx
import { ProviderSelector } from './ProviderSelector';
import { ProviderManager } from './ProviderManager';
import { useProviderStore } from '../../../entities/provider';
```

상태 추가(컴포넌트 상단 useState 모음 근처):

```tsx
const [showManager, setShowManager] = useState(false);
const selectedProviderId = useProviderStore(s => s.selectedProviderId);
const selectedModelId = useProviderStore(s => s.selectedModelId);
```

`runWith` 안에서 `build()` 결과에 provider/model 주입 — `const payload = await build();` 바로 다음 줄에 삽입:

```tsx
      const payload = await build();
      payload.provider = selectedProviderId;            // 추가
      payload.model = selectedModelId;                  // 추가
      if (ctrl.signal.aborted) return;
```

idle 패널의 방법 선택 탭 위(`{phase === 'idle' && (` 직후, `<>` 안 첫 줄)에 셀렉터/관리뷰 분기 삽입:

```tsx
              {showManager ? (
                <ProviderManager onBack={() => setShowManager(false)} />
              ) : (
                <>
                  <ProviderSelector onManage={() => setShowManager(true)} />
                  {/* ↓ 기존 방법 선택 탭 + 패널들 그대로 */}
```

그리고 기존 idle `<>...</>`의 닫는 위치에 맞춰 위 조건부의 닫는 괄호를 맞춘다(관리뷰가 아닐 때만 방법탭/패널 표시). `phase === 'idle'`이 아닌 분기(loading/error/done)는 변경 없음. 모달이 닫힐 때 `setShowManager(false)`로 초기화하도록 open 초기화 effect에 한 줄 추가:

```tsx
    setShowManager(false);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/features/analysis/analysis-modal-provider.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: 전체 테스트 + 빌드 확인**

Run: `npx vitest run`
Expected: 모든 테스트 PASS.

Run: `npm run build`
Expected: 타입체크·빌드 성공.

- [ ] **Step 6: 커밋(확인 후)**

```bash
git add src/features/analysis/ui/AnalysisModal.tsx tests/features/analysis/analysis-modal-provider.test.tsx
git commit -m "feat(analysis): 모달에 프로바이더 셀렉터·관리뷰 통합 + payload 전달"
```

---

## 수동 검증 (실행 후)

1. `npm run dev -- --port 5180` → 분석 모달 열기.
2. 상단 프로바이더 드롭다운에 목록 표시, `claude-bridge` 선택 시 모델 드롭다운 숨김 확인.
3. ⚙ → 관리 뷰에서 OpenAI에 임시 API 키 저장 → "연결됨" 배지 확인(`.analysis/providers.local.json` 생성, gitignore로 추적 안 됨 확인).
4. OpenAI 선택 → 모델 드롭다운에 실시간 목록 로드, 🔄로 갱신.
5. 분석 실행 → 결과 마크다운 표시. 잘못된 키면 에러 메시지 표시(.error.txt 경로).
6. `claude-bridge` 선택 분석은 기존 감시스크립트 흐름대로 동작.

---

## Self-Review 결과 (작성자 점검)

- **스펙 커버리지:** §1 레지스트리→T1, §2 어댑터→T6, §3 자격증명→T4, §4 엔드포인트→T7, §5 OAuth→T5·T7, §6 실행변경→T8, §7 프론트상태→T3, §8 UI→T9·T10·T11, §10 보안→T4(toStatuses 비밀제외)·gitignore 기존, §11 테스트→각 Task, §12 Supabase→구조상 BASE 교체로 충족.
- **Placeholder:** 코드 내 미완 없음. 레지스트리의 `TODO_CONFIRM_*_CLIENT_ID`는 의도된 외부 비밀값(구현 시 공식 문서로 확정) — 헤더 참고 문서에 명시.
- **타입 일관성:** `Credential`/`Adapter`/`ChatInput`/`ProviderStatus`/`ModelInfo`/`ProviderDef` 명칭이 정의(T1·T4·T6)와 사용처(T7·T8·T9·T10) 전반에서 일치. 스토어 액션명(`refreshModels`,`saveApiKey`,`saveSessionToken`,`startOAuth`,`disconnect`,`select`)이 UI 사용처와 일치.
