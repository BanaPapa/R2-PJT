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
  if (!cred) {
    // 공개 /models 엔드포인트가 있으면 자격증명 없이도 목록만 조회 가능.
    if (def.publicModelList) return getAdapter(def.apiShape).listModels(def, { method: 'apiKey' });
    throw new Error(`연결되지 않은 프로바이더: ${id}`);
  }
  return getAdapter(def.apiShape).listModels(def, cred);
}

export function providerBridge(): Plugin {
  return {
    name: 'provider-bridge',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root;

      server.middlewares.use('/api/providers', (req, res, next) => {
        const method = req.method ?? 'GET';
        const url = (req.url ?? '').split('?')[0]!.replace(/^\//, ''); // '', 'openai/models', 'openai/credentials', 'openai/oauth/start'
        const refresh = (req.url ?? '').includes('refresh=1');
        const [id, sub, action] = url.split('/');

        void (async () => {
          try {
            if (method === 'GET' && url === '') {
              sendJson(res, 200, await toStatuses(root));
              return;
            }
            if (!id || !getProvider(id)) { sendJson(res, 404, { error: '알 수 없는 프로바이더' }); return; }

            if (method === 'GET' && sub === 'models') {
              sendJson(res, 200, await listProviderModels(root, id, refresh));
              return;
            }
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

      void PROVIDERS;
    },
  };
}
