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
  // 자격증명 없이도 모델 목록(/models)을 조회할 수 있는 공개 엔드포인트 보유 여부.
  // 목록만 키 없이 가능하며, 실제 추론(chat)에는 무료 모델도 키가 필요하다.
  publicModelList?: boolean;
}

export interface ModelInfo {
  id: string;
  label?: string;
  created?: number;       // 출시/등록 시각(Unix sec) — 최신순 정렬
  promptPrice?: number;   // 입력 토큰당 단가(USD) — 가격순 정렬
  contextLength?: number; // 최대 컨텍스트 길이 — 컨텍스트순 정렬
  isFree?: boolean;       // 무료 모델 여부 — 무료 우선 정렬
}

export interface ProviderStatus {
  id: string;
  connected: boolean;
  method?: AuthMethod;
}
