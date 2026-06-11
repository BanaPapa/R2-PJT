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
