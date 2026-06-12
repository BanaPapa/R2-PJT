# 분석 프로바이더 / 모델 설정 — 설계

작성일: 2026-06-11

## 목표

1. **분석 모달 안에서** 프로바이더·모델을 드롭다운으로 선택하고, 그 조합으로 분석을 실행한다.
2. 헤르메스(데스크탑 LLM 클라이언트) 스타일로 **다양한 프로바이더**를 연결한다. 인증은 **API 키**와 **구독인증**(서드파티 구독 계정 로그인) 두 방식 모두 지원.
3. 모델 목록은 **각 프로바이더에서 실시간 조회**해 항상 최신을 반영한다(하드코딩 금지).
4. 자격증명(키·토큰)은 **서버(dev 브릿지)에만** 저장한다. 브라우저엔 절대 내려보내지 않는다. 추후 Supabase Edge Function으로 이전 가능한 시그니처로 둔다.

## 배경 (현재 구조)

- `AnalysisModal` → `runAnalysis()` → `POST /api/analysis`(디스크 저장) → `scripts/analysis-watch.mjs`가 깨운 Claude(터미널 세션)가 `.analysis/responses/<id>.md`를 작성 → `pollAnalysis()`가 폴링.
- `vite-plugins/analysis-bridge.ts`가 `POST/GET /api/analysis`만 처리. 응답 `model` 필드는 `'claude-code'` 하드코딩.
- 프로바이더·자격증명 개념 없음. `.analysis/`는 이미 gitignore.

핵심 결정(브레인스토밍 확정):
- **실행 위치**: dev 브릿지 프록시(키는 서버 보관, CORS·노출 회피, 추후 Supabase Edge로 교체).
- **프로바이더는 하드코딩 레지스트리 + 모델은 라이브 fetch** (헤르메스/Jan/Cherry Studio 등과 동일 패턴).
- **구독인증 통합**: OpenAI=정식 OAuth PKCE, Grok=세션토큰 붙여넣기. UI에선 둘 다 "구독으로 로그인". 정당한 구독 OAuth가 있는 다른 프로바이더(Anthropic, OpenRouter)는 선언형으로 추가.
- 기존 "Claude가 직접 분석"은 **내장 프로바이더(`claude-bridge`)**로 유지 → 키 없이 쓰던 흐름 보존.

## 아키텍처 개요

```
브라우저 (분석 모달)
  └─ ProviderSelector / ProviderManager
       │  fetch /api/providers, /models, /credentials, /oauth/*
       ▼
dev 브릿지 (vite-plugins, Node — 서버측)
  ├─ credentials-store   (.analysis/providers.local.json, 서버 only)
  ├─ adapters/           (openai-compatible | anthropic | gemini)
  ├─ oauth (PKCE helper)
  └─ /api/analysis 프록시 → 어댑터 chat() → 응답 .md
       (provider === claude-bridge 면 기존 디스크+감시스크립트 흐름)
```

## 1. 프로바이더 레지스트리 (정적, `entities/provider/model/registry.ts`)

```ts
type ApiShape = 'openai-compatible' | 'anthropic' | 'gemini' | 'claude-bridge';
type AuthMethod = 'apiKey' | 'subscription';
type SubscriptionKind = 'oauth-pkce' | 'session-token';

interface ProviderDef {
  id: string;                 // 'openai', 'xai', ...
  label: string;              // 'OpenAI', 'xAI (Grok)'
  apiShape: ApiShape;
  baseUrl: string;            // 'https://api.openai.com/v1'
  auth: AuthMethod[];         // ['apiKey', 'subscription'] 등
  subscription?: {
    kind: SubscriptionKind;
    authorizeUrl?: string;    // oauth-pkce
    tokenUrl?: string;
    clientId?: string;
    scopes?: string[];
    tokenHint?: string;       // session-token: 어디서 복사하는지 안내문
  };
  docsUrl?: string;
}
```

**내장 목록(시작값)** — 추가는 레지스트리에 한 줄:

| id | label | apiShape | auth |
|----|-------|----------|------|
| `claude-bridge` | Claude (현재 세션) | claude-bridge | (없음, 항상 연결) |
| `openai` | OpenAI | openai-compatible | apiKey, subscription(oauth-pkce) |
| `xai` | xAI (Grok) | openai-compatible | apiKey, subscription(session-token) |
| `anthropic` | Anthropic (Claude) | anthropic | apiKey, subscription(oauth-pkce) |
| `openrouter` | OpenRouter | openai-compatible | apiKey, subscription(oauth-pkce) |
| `google` | Google (Gemini) | gemini | apiKey |
| `deepseek` | DeepSeek | openai-compatible | apiKey |
| `groq` | Groq | openai-compatible | apiKey |
| `mistral` | Mistral | openai-compatible | apiKey |
| `together` | Together | openai-compatible | apiKey |

> 대부분이 `openai-compatible`이라 신규 프로바이더는 baseUrl 한 줄로 추가된다. 구독인증은 정당한 공식 흐름이 있는 곳에만 둔다.

## 2. 어댑터 (서버측, `vite-plugins/adapters/`)

각 어댑터는 두 함수만 노출:

- `listModels(def, cred): Promise<ModelInfo[]>`
  - openai-compatible: `GET {baseUrl}/models` → `data[].id`
  - anthropic: `GET {baseUrl}/models` (`anthropic-version` 헤더)
  - gemini: `GET .../models?key=` → `models[]`
- `chat(def, cred, { system, user, model }): Promise<string>`
  - openai-compatible: `POST /chat/completions`
  - anthropic: `POST /messages` (system 분리, max_tokens 필요)
  - gemini: `POST /models/{model}:generateContent`

`claude-bridge`는 어댑터가 아니라 기존 디스크 흐름으로 분기.

`ModelInfo = { id: string; label?: string }`.

## 3. 자격증명 저장 (서버, `vite-plugins/credentials-store.ts`)

```jsonc
// .analysis/providers.local.json  (gitignore: .analysis/ + *.local)
{
  "openai": { "method": "apiKey", "apiKey": "sk-..." },
  "xai":    { "method": "subscription", "token": "..." },
  "anthropic": { "method": "subscription",
    "accessToken": "...", "refreshToken": "...", "expiresAt": 1700000000 }
}
```

- 원자적 쓰기(tmp→rename). 파일 없으면 빈 객체.
- **브라우저로 비밀을 반환하는 경로는 존재하지 않는다.** `GET /api/providers`는 `{ id, connected, method }`만 노출.

## 4. 브릿지 엔드포인트 (`vite-plugins/provider-bridge.ts` + 기존 analysis-bridge 확장)

| Method · Path | 동작 |
|---|---|
| `GET /api/providers` | 레지스트리 + 연결상태(비밀 제외) |
| `POST /api/providers/:id/credentials` | apiKey 또는 session-token 저장 |
| `DELETE /api/providers/:id/credentials` | 연결해제 |
| `GET /api/providers/:id/models` | 어댑터로 **라이브 조회**(짧은 캐시 + `?refresh=1`) |
| `GET /api/providers/:id/oauth/start` | PKCE 시작 → `{ authUrl }` |
| `GET /api/oauth/callback` | 코드 교환 → 토큰 저장 → 창 닫는 HTML |
| `POST /api/analysis` | **확장**: body에 `provider`, `model` → 어댑터 분기 |
| `GET /api/analysis/:id` | 기존과 동일(폴링) |

## 5. OAuth PKCE 흐름 (구독인증)

1. 프론트가 `GET …/oauth/start` 호출 → 서버가 `code_verifier` 생성·메모리 보관, `code_challenge`로 `authUrl` 구성해 반환.
2. 프론트가 `window.open(authUrl)`. 사용자가 프로바이더에서 로그인·동의.
3. 프로바이더가 `GET /api/oauth/callback?code&state`로 리다이렉트 → 서버가 `code`+`verifier`로 토큰 교환 → `providers.local.json` 저장 → "창을 닫아도 됩니다" HTML 응답(+`postMessage`).
4. 프론트는 `postMessage`/연결상태 재조회로 완료 감지.
- `state`로 CSRF 검증. 토큰 만료 시 `refreshToken`으로 갱신(어댑터 호출 직전 체크).
- **세션토큰 방식(Grok)**: OAuth 대신 사용자가 grok.com 세션 토큰을 붙여넣어 `POST credentials`. 만료 시 재입력 안내.
- OpenAI/Anthropic의 구체 authorize/token URL·clientId·scope는 구현 시 확정(`claude-api` 스킬/공식 문서 참조).

## 6. 분석 실행 변경

- `runAnalysis()` payload에 `provider: string`, `model?: string` 추가.
- `POST /api/analysis` 처리:
  - `provider === 'claude-bridge'` → 기존 디스크 흐름(감시스크립트가 Claude 깨움). 변경 없음.
  - 그 외 → 자격증명 로드(없으면 400). `system` = `docs/analysis-prompt.md`, `user` = 기존 `collect`/`summarize` 결과를 직렬화한 텍스트. 어댑터 `chat()` 호출 → 결과를 `.analysis/responses/<id>.md`로 기록(폴링 호환).
- 폴링 인터페이스(`pollAnalysis`)와 프론트 결과 렌더는 **그대로 재사용**.

## 7. 프론트 상태 (`entities/provider/model/provider.store.ts`, zustand persist)

```ts
interface ProviderStore {
  selectedProviderId: string;   // persist (기본 'claude-bridge')
  selectedModelId: string | null; // persist
  statuses: Record<string, { connected: boolean; method?: AuthMethod }>;
  models: Record<string, ModelInfo[]>;  // 캐시
  loadingModels: Record<string, boolean>;

  refreshProviders(): Promise<void>;
  refreshModels(id: string, force?: boolean): Promise<void>;
  saveApiKey(id: string, key: string): Promise<void>;
  saveSessionToken(id: string, token: string): Promise<void>;
  startOAuth(id: string): Promise<void>;
  disconnect(id: string): Promise<void>;
  select(providerId: string, modelId: string | null): void;
}
```

- persist 대상은 선택값만(`selectedProviderId`, `selectedModelId`). 상태/모델은 서버 동기화.

## 8. UI (전부 분석 모달 내부)

- **상단 바**(idle 패널 위): `[프로바이더 ▾] [모델 ▾] [⚙ 관리] [🔄]`.
  - 모델 드롭다운은 선택된 프로바이더의 `models[id]`를 표시, 비어 있으면 자동 fetch. 🔄 = `refreshModels(force)`.
  - `claude-bridge` 선택 시 모델 드롭다운 숨김(또는 단일 항목).
- **관리 뷰**(⚙ 토글, 모달 내 전환): 프로바이더 행 목록.
  - 라벨 · 연결상태 배지 · 지원 인증 버튼(`[API 키]` / `[구독으로 로그인]`) · `[모델 새로고침]` · `[연결해제]`.
  - API 키 입력은 인라인 마스킹 폼 → `saveApiKey`. 세션토큰도 동일 폼(+안내문).
  - 구독 로그인 = `startOAuth`(새 창).
- 분석 실행 버튼은 선택된 `provider`/`model`을 payload에 실어 보냄. 미연결 프로바이더 선택 시 실행 비활성 + 안내.

## 9. 파일 구성

```
src/entities/provider/
  model/provider.types.ts     // ProviderDef, ModelInfo, AuthMethod ...
  model/registry.ts           // 내장 ProviderDef 목록
  model/provider.store.ts     // zustand persist
  api/provider.api.ts         // 프론트 fetch 래퍼
  index.ts
vite-plugins/
  provider-bridge.ts          // 새 엔드포인트
  credentials-store.ts        // providers.local.json 읽기/쓰기
  oauth.ts                    // PKCE helper (verifier/challenge/state)
  adapters/
    index.ts                  // apiShape → 어댑터 선택
    openai-compatible.ts
    anthropic.ts
    gemini.ts
src/features/analysis/ui/
  ProviderSelector.tsx        // 상단 드롭다운 바
  ProviderManager.tsx         // 관리 뷰
  (AnalysisModal.tsx 수정: 상단 바 + 관리 뷰 통합, payload에 provider/model)
src/entities/analysis/        // AnalysisRequest에 provider/model 필드 추가
```

기존 변경 최소: `analysis.types.ts`에 `provider`/`model` 추가, `analysis.api.ts`는 그대로(payload만 확장), `AnalysisModal`에 선택 바 삽입, `vite.config.ts`에 `providerBridge()` 등록.

## 10. 보안

- 키/토큰 **서버 only**, gitignore 확인(`.analysis/` + `*.local`). 브라우저 반환 경로 없음.
- 로그·에러 메시지에 비밀 미출력.
- OAuth `state` CSRF 검증, `code_verifier`는 서버 메모리에만.
- 입력 검증: providerId는 레지스트리 화이트리스트, 모델/키 길이 제한.

## 11. 테스트 (Vitest, 80%+)

- 레지스트리 무결성(중복 id 없음, 필수 필드).
- 어댑터 모델/응답 파싱(목 fetch, apiShape별).
- `credentials-store` CRUD + 원자적 쓰기 + 빈 파일.
- PKCE verifier/challenge 생성·검증, `state` 검증.
- `POST /api/analysis` provider 분기(claude-bridge vs 어댑터, 미연결 400).
- provider.store `select`/persist, `refreshModels` 캐시·force.
- UI: 드롭다운 렌더·선택, 관리 뷰 연결/해제 흐름(목 api).

## 12. Supabase 대비

브릿지 엔드포인트 시그니처를 그대로 Edge Function으로 옮기고, `credentials-store`만 Supabase(암호화 컬럼/Vault)로 교체. 프론트(`provider.api.ts`)는 BASE만 바꾸면 됨.
