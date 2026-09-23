import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as getAuthStatus } from '../app/api/auth/status/route.js';
import { POST as postLogin } from '../app/api/auth/login/route.js';
import { POST as postLogout } from '../app/api/auth/logout/route.js';
import { GET as getConnections } from '../app/api/connections/route.js';
import { GET as getQuota } from '../app/api/quota/[id]/route.js';
import { GET as getStats } from '../app/api/stats/route.js';
import { defaultSessionStore } from '../lib/server/session.js';
import { defaultUpstreamClient } from '../lib/server/upstream.js';
import { buildSessionCookie } from '../lib/server/routeHelpers.js';
import { APP_ORIGIN } from '../lib/server/config.js';

test('GET /api/auth/status returns unauthenticated when no cookie present', async () => {
  // Mock upstream unauthenticated status
  defaultUpstreamClient.request = async (path) => {
    if (path === '/api/auth/status') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          authenticated: false,
          authMode: 'password',
        }),
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const req = new Request('http://127.0.0.1:20130/api/auth/status');
  const res = await getAuthStatus(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, false);
  assert.equal(data.loginMode, 'password');
  assert.equal(data.expiresAt, null);
});

test('GET /api/auth/status detects upstream SSO and returns unsupported-sso', async () => {
  defaultUpstreamClient.request = async (path) => {
    if (path === '/api/auth/status') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          authenticated: false,
          authMode: 'sso',
          oidcConfigured: true,
        }),
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const req = new Request('http://127.0.0.1:20130/api/auth/status');
  const res = await getAuthStatus(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, false);
  assert.equal(data.loginMode, 'unsupported-sso');
});

test('POST /api/auth/login succeeds with valid origin, sets HttpOnly SameSite=Strict cookie', async () => {
  defaultUpstreamClient.request = async (path, init) => {
    if (path === '/api/auth/status') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ authenticated: false, authMode: 'password' }),
      };
    }
    if (path === '/api/auth/login') {
      return {
        ok: true,
        status: 200,
        headers: new Headers({
          'set-cookie': 'auth_token=upstream-jwt-token-123; Path=/; HttpOnly',
        }),
        json: async () => ({ success: true }),
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const req = new Request('http://127.0.0.1:20130/api/auth/login', {
    method: 'POST',
    headers: {
      origin: APP_ORIGIN,
      'content-type': 'application/json',
      host: '127.0.0.1:20130',
    },
    body: JSON.stringify({ password: 'valid-password' }),
  });

  const res = await postLogin(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, true);
  assert.ok(data.expiresAt);

  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie.includes('quota_session='));
  assert.ok(setCookie.includes('HttpOnly'));
  assert.ok(setCookie.includes('SameSite=Strict'));
});

test('POST /api/auth/login rejects cross-site origin with 403', async () => {
  const req = new Request('http://127.0.0.1:20130/api/auth/login', {
    method: 'POST',
    headers: {
      origin: 'http://attacker-site.com',
      'content-type': 'application/json',
      host: '127.0.0.1:20130',
    },
    body: JSON.stringify({ password: 'valid-password' }),
  });

  const res = await postLogin(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, 'ORIGIN_REJECTED');
});

test('POST /api/auth/logout destroys local session and clears cookie', async () => {
  const session = defaultSessionStore.createSession('upstream-token-logout');
  const cookieVal = buildSessionCookie(session.token);

  const req = new Request('http://127.0.0.1:20130/api/auth/logout', {
    method: 'POST',
    headers: {
      origin: APP_ORIGIN,
      'content-type': 'application/json',
      host: '127.0.0.1:20130',
      cookie: cookieVal,
    },
    body: JSON.stringify({}),
  });

  const res = await postLogout(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, false);

  // Session destroyed in store
  assert.equal(defaultSessionStore.getSession(session.token), null);
  // Cookie cleared
  assert.ok(res.headers.get('set-cookie').includes('Max-Age=0'));
});

test('GET /api/connections rejects unauthorized requests with 401', async () => {
  const req = new Request('http://127.0.0.1:20130/api/connections');
  const res = await getConnections(req);
  assert.equal(res.status, 401);
});

test('GET /api/connections returns sanitized connections and populates known directory', async () => {
  const session = defaultSessionStore.createSession('upstream-token-conn');
  const cookieVal = buildSessionCookie(session.token);

  defaultUpstreamClient.revalidateAuth = async () => true;
  defaultUpstreamClient.request = async (path) => {
    if (path.startsWith('/api/providers/client')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          connections: [
            { id: 'c-1', provider: 'codex', email: 'dev@test.local', isActive: true },
            { id: 'c-2', provider: 'antigravity', name: 'sk-99999999999999999999999999999999', isActive: false },
          ],
          providerOptions: ['antigravity', 'codex'],
          pagination: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
        }),
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const req = new Request('http://127.0.0.1:20130/api/connections?page=1&pageSize=100', {
    headers: { cookie: cookieVal },
  });

  const res = await getConnections(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.connections.length, 2);
  assert.equal(data.connections[0].label, 'dev@test.local');
  assert.equal(data.connections[1].label, 'sk-99999***'); // Sanitized
  assert.ok(defaultSessionStore.isKnownAccount(session.token, 'c-1'));
  assert.ok(defaultSessionStore.isKnownAccount(session.token, 'c-2'));
});

test('GET /api/quota/[id] rejects path traversal and unknown account', async () => {
  const session = defaultSessionStore.createSession('upstream-token-quota');
  const cookieVal = buildSessionCookie(session.token);
  defaultUpstreamClient.revalidateAuth = async () => true;

  // Path traversal
  const badReq = new Request('http://127.0.0.1:20130/api/quota/..%2Fetc', {
    headers: { cookie: cookieVal },
  });
  const badRes = await getQuota(badReq, { params: Promise.resolve({ id: '../etc' }) });
  assert.equal(badRes.status, 400);

  // Unknown account not in directory even after fetch
  defaultUpstreamClient.request = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ connections: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }),
  });
  const notFoundReq = new Request('http://127.0.0.1:20130/api/quota/c-unknown', {
    headers: { cookie: cookieVal },
  });
  const notFoundRes = await getQuota(notFoundReq, { params: Promise.resolve({ id: 'c-unknown' }) });
  assert.equal(notFoundRes.status, 404);
});

test('GET /api/stats returns aggregated totals and accounts', async () => {
  const session = defaultSessionStore.createSession('upstream-token-stats');
  const cookieVal = buildSessionCookie(session.token);
  defaultUpstreamClient.revalidateAuth = async () => true;

  defaultUpstreamClient.request = async (path) => {
    if (path.includes('/api/usage/stats')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          totalRequests: 5,
          totalPromptTokens: 500,
          totalCompletionTokens: 200,
          totalCachedTokens: 50,
          totalCost: 0.01,
          byAccount: {},
        }),
      };
    }
    if (path.includes('/api/usage/chart')) {
      return {
        ok: true,
        status: 200,
        json: async () => [{ label: '12:00', tokens: 100, cost: 0.001 }],
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const req = new Request('http://127.0.0.1:20130/api/stats?period=7d', {
    headers: { cookie: cookieVal },
  });
  const res = await getStats(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.period, '7d');
  assert.equal(data.totals.totalTokens, 700);
  assert.equal(data.chartStatus, 'ok');
});

test('GET /api/quota/[id] rejects query params with 400 and prioritizes stored directory provider', async () => {
  const session = defaultSessionStore.createSession('upstream-token-quota-test');
  const cookieVal = buildSessionCookie(session.token);
  defaultUpstreamClient.revalidateAuth = async () => true;

  defaultSessionStore.addKnownAccounts(session.token, [{ id: 'c-anti-1', provider: 'antigravity' }]);

  defaultUpstreamClient.request = async (path) => {
    if (path.includes('/api/usage/c-anti-1')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          plan: 'pro',
          quotas: {
            'gemini-3.8-flash-high': { used: 537, total: 1000, remainingPercentage: 46 },
            'claude-sonnet-4-6': { used: 537, total: 1000, remainingPercentage: 46 },
          },
        }),
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const poisonedReq = new Request('http://127.0.0.1:20130/api/quota/c-anti-1?provider=codex', {
    headers: { cookie: cookieVal },
  });
  const poisonedRes = await getQuota(poisonedReq, { params: Promise.resolve({ id: 'c-anti-1' }) });
  assert.equal(poisonedRes.status, 400);

  const cleanReq = new Request('http://127.0.0.1:20130/api/quota/c-anti-1', {
    headers: { cookie: cookieVal },
  });
  const cleanRes = await getQuota(cleanReq, { params: Promise.resolve({ id: 'c-anti-1' }) });
  assert.equal(cleanRes.status, 200);
  const data = await cleanRes.json();
  assert.equal(data.provider, 'antigravity');
  const keys = data.windows.map((w) => w.key);
  assert.ok(keys.includes('gemini'));
  assert.ok(keys.includes('claude'));
  assert.equal(data.windows.length, 2);
});
