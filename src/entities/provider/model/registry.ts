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
