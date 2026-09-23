import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpstreamClient, defaultUpstreamClient } from '../lib/server/upstream.js';
import { LIMITS } from '../lib/server/config.js';
import { GET as getQuota } from '../app/api/quota/[id]/route.js';
import { GET as getAuthStatus } from '../app/api/auth/status/route.js';
import { createLiveModelsStream } from '../lib/server/liveModels.js';
import { defaultSessionStore } from '../lib/server/session.js';
import { buildSessionCookie } from '../lib/server/routeHelpers.js';

test('createUpstreamClient respects per-request timeoutMs override while retaining default 10s', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

  let overrideAborted = false;
  const clientWithOverride = createUpstreamClient({
    fetchFn: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        overrideAborted = true;
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }),
  });

  const overridePromise = clientWithOverride.request('/api/usage/c-test', { timeoutMs: 25000 });

  t.mock.timers.tick(10001);
  assert.equal(overrideAborted, false);

  t.mock.timers.tick(15000);
  assert.equal(overrideAborted, true);
  await assert.rejects(overridePromise, { code: 'UPSTREAM_TIMEOUT', status: 504 });

  let defaultAborted = false;
  const clientDefault = createUpstreamClient({
    fetchFn: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        defaultAborted = true;
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }),
  });

  const defaultPromise = clientDefault.request('/api/auth/status');
  t.mock.timers.tick(9999);
  assert.equal(defaultAborted, false);
  t.mock.timers.tick(2);
  assert.equal(defaultAborted, true);
  await assert.rejects(defaultPromise, { code: 'UPSTREAM_TIMEOUT', status: 504 });
});

test('GET /api/quota/[id] passes bounded 20-30s timeoutMs to upstreamClient while auth and SSE retain default 10s', async () => {
  const originalRequest = defaultUpstreamClient.request;
  const originalRevalidate = defaultUpstreamClient.revalidateAuth;

  try {
    const session = defaultSessionStore.createSession('tok-quota-timeout-test');
    const cookieVal = buildSessionCookie(session.token);
    defaultSessionStore.addKnownAccounts(session.token, [{ id: 'c-codex-timeout', provider: 'codex' }]);
    defaultUpstreamClient.revalidateAuth = async () => true;

    const capturedInits = [];
    defaultUpstreamClient.request = async (path, init = {}, token) => {
      capturedInits.push({ path, init, token });
      if (path.startsWith('/api/usage/c-codex-timeout')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            provider: 'codex',
            quotas: { session: { used: 5, total: 100 } },
          }),
        };
      }
      if (path === '/api/auth/status') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ authenticated: false, authMode: 'password' }),
        };
      }
      if (path === '/api/usage/stream') {
        return {
          ok: true,
          status: 200,
          body: {
            getReader() {
              return {
                read: async () => ({ done: true, value: undefined }),
                cancel: async () => {},
                releaseLock: () => {},
              };
            },
          },
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    };

    const quotaReq = new Request('http://127.0.0.1:20130/api/quota/c-codex-timeout', {
      headers: { cookie: cookieVal },
    });
    const quotaRes = await getQuota(quotaReq, { params: Promise.resolve({ id: 'c-codex-timeout' }) });
    assert.equal(quotaRes.status, 200);

    const quotaCall = capturedInits.find((c) => c.path.startsWith('/api/usage/c-codex-timeout'));
    assert.ok(quotaCall, 'Quota route must call upstream /api/usage/[id]');
    assert.equal(typeof quotaCall.init?.timeoutMs, 'number', 'Quota call must pass explicit timeoutMs');
    assert.ok(
      quotaCall.init.timeoutMs >= 20000 && quotaCall.init.timeoutMs <= 30000,
      `Quota timeoutMs must be bounded between 20-30s, got ${quotaCall.init.timeoutMs}`
    );
    assert.equal(quotaCall.init.timeoutMs, LIMITS.QUOTA_UPSTREAM_TIMEOUT_MS);

    const authReq = new Request('http://127.0.0.1:20130/api/auth/status');
    const authRes = await getAuthStatus(authReq);
    assert.equal(authRes.status, 200);

    const authCall = capturedInits.find((c) => c.path === '/api/auth/status');
    assert.ok(authCall, 'Auth route must call upstream /api/auth/status');
    assert.equal(authCall.init?.timeoutMs, undefined, 'Auth call must retain default 10s timeout without override');

    const stream = createLiveModelsStream({
      upstreamToken: 'test-upstream-token',
      sessionToken: session.token,
      abortSignal: new AbortController().signal,
    });
    const reader = stream.getReader();
    await reader.read();
    reader.cancel();

    const sseCall = capturedInits.find((c) => c.path === '/api/usage/stream');
    assert.ok(sseCall, 'SSE stream must call upstream /api/usage/stream');
    assert.equal(sseCall.init?.timeoutMs, undefined, 'SSE live-models must retain default 10s timeout without override');
  } finally {
    defaultUpstreamClient.request = originalRequest;
    defaultUpstreamClient.revalidateAuth = originalRevalidate;
  }
});

test('GET /api/quota/[id] avoids false Unavailable when upstream responds beyond 10s default', async () => {
  const originalRequest = defaultUpstreamClient.request;
  const originalRevalidate = defaultUpstreamClient.revalidateAuth;

  try {
    const session = defaultSessionStore.createSession('tok-codex-slow');
    const cookieVal = buildSessionCookie(session.token);
    defaultSessionStore.addKnownAccounts(session.token, [{ id: 'c-codex-slow', provider: 'codex' }]);
    defaultUpstreamClient.revalidateAuth = async () => true;

    defaultUpstreamClient.request = async (path, init = {}) => {
      if (path.startsWith('/api/usage/c-codex-slow')) {
        assert.ok(init.timeoutMs >= 20000, 'timeoutMs must be increased to at least 20s');
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            provider: 'codex',
            quotas: {
              session: { used: 30, total: 100, remainingPercentage: 70 },
            },
          }),
        };
      }
      throw new Error(`Unexpected path: ${path}`);
    };

    const req = new Request('http://127.0.0.1:20130/api/quota/c-codex-slow', {
      headers: { cookie: cookieVal },
    });
    const res = await getQuota(req, { params: Promise.resolve({ id: 'c-codex-slow' }) });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.notEqual(data.status, 'unavailable');
    assert.notEqual(data.reason, 'PROVIDER_UNAVAILABLE');
    assert.equal(data.windows[0].used, 30);
  } finally {
    defaultUpstreamClient.request = originalRequest;
    defaultUpstreamClient.revalidateAuth = originalRevalidate;
  }
});
