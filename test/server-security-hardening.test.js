import test from 'node:test';
import assert from 'node:assert/strict';
import { getCookie, readBoundedText } from '../lib/server/routeHelpers.js';
import { validateOriginAndHeaders } from '../lib/server/security.js';
import { createSessionStore } from '../lib/server/session.js';
import { createUpstreamClient } from '../lib/server/upstream.js';
import { APP_ORIGIN, UPSTREAM_BASE_URL } from '../lib/server/config.js';
import { GET as getAuthStatus } from '../app/api/auth/status/route.js';
import { GET as getQuota } from '../app/api/quota/[id]/route.js';
import { defaultSessionStore } from '../lib/server/session.js';
import { defaultUpstreamClient } from '../lib/server/upstream.js';
import { buildSessionCookie } from '../lib/server/routeHelpers.js';

test('UPSTREAM_BASE_URL defaults to https://9router.bangkhan.com', () => {
  assert.equal(UPSTREAM_BASE_URL, 'https://9router.bangkhan.com');
});

// 2. Cookie decode safety
test('getCookie handles malformed percent-encoding safely without throwing URIError', () => {
  const req = {
    headers: {
      get: (h) => (h.toLowerCase() === 'cookie' ? 'quota_session=%E0%A4%A' : null),
    },
  };
  let result;
  assert.doesNotThrow(() => {
    result = getCookie(req, 'quota_session');
  });
  assert.equal(result, null);
});

// 3. Streaming bounded body reader
test('readBoundedText aborts early when stream exceeds 4KiB limit', async () => {
  const chunks = [
    new Uint8Array(2048).fill(97),
    new Uint8Array(2049).fill(97), // total 4097 bytes > 4096
  ];
  let chunkIndex = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (chunkIndex < chunks.length) {
        controller.enqueue(chunks[chunkIndex++]);
      } else {
        controller.close();
      }
    },
  });

  const req = new Request('http://127.0.0.1:20130/api/auth/login', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  });

  await assert.rejects(
    async () => readBoundedText(req, 4096),
    (err) => err.code === 'INVALID_REQUEST'
  );
});

// 4. Host header exact match and Sec-Fetch-Site check
test('validateOriginAndHeaders enforces Host match to APP_ORIGIN and rejects cross-site Sec-Fetch-Site', () => {
  const allowedOrigin = 'http://127.0.0.1:20130';

  // Mismatched Host
  const badHostReq = {
    method: 'POST',
    headers: {
      get: (h) => {
        const lower = h.toLowerCase();
        if (lower === 'origin') return 'http://127.0.0.1:20130';
        if (lower === 'content-type') return 'application/json';
        if (lower === 'host') return 'attacker.com:20130';
        return null;
      },
    },
  };
  const hostCheck = validateOriginAndHeaders(badHostReq, allowedOrigin);
  assert.equal(hostCheck.ok, false);
  assert.equal(hostCheck.code, 'ORIGIN_REJECTED');

  // Sec-Fetch-Site: cross-site
  const crossSiteReq = {
    method: 'POST',
    headers: {
      get: (h) => {
        const lower = h.toLowerCase();
        if (lower === 'origin') return 'http://127.0.0.1:20130';
        if (lower === 'content-type') return 'application/json';
        if (lower === 'host') return '127.0.0.1:20130';
        if (lower === 'sec-fetch-site') return 'cross-site';
        return null;
      },
    },
  };
  const siteCheck = validateOriginAndHeaders(crossSiteReq, allowedOrigin);
  assert.equal(siteCheck.ok, false);
  assert.equal(siteCheck.code, 'ORIGIN_REJECTED');
});

// 5. Session capacity 100 rejects with SESSION_CAPACITY instead of silently evicting
test('createSessionStore rejects with SESSION_CAPACITY when all 100 sessions are active', () => {
  const store = createSessionStore({ maxSessions: 2, defaultTtlMs: 3600000 });
  const s1 = store.createSession('tok-1');
  const s2 = store.createSession('tok-2');
  assert.equal(store.size(), 2);

  // Both s1 and s2 are active. Third creation must fail with capacity error
  assert.throws(
    () => store.createSession('tok-3'),
    (err) => err.code === 'SESSION_CAPACITY' && err.status === 503
  );
});

// 6. Upstream auth revalidation distinguishes network 503/504 from unauthenticated 401
test('revalidateAuthResult distinguishes transport errors from invalid credentials', async () => {
  const client = createUpstreamClient({
    baseUrl: 'http://127.0.0.1:20128',
    fetchFn: async () => {
      const err = new Error('ECONNREFUSED');
      err.code = 'ECONNREFUSED';
      throw err;
    },
  });

  const res = await client.revalidateAuthResult('token-abc');
  assert.equal(res.status, 'error');
  assert.equal(res.transportError, true);
  assert.equal(res.authenticated, null);

  const client401 = createUpstreamClient({
    baseUrl: 'http://127.0.0.1:20128',
    fetchFn: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ authenticated: false }),
    }),
  });
  const res401 = await client401.revalidateAuthResult('token-abc');
  assert.equal(res401.status, 'unauthenticated');
  assert.equal(res401.authenticated, false);
});

// 7. GET /api/auth/status clears invalid cookie
test('GET /api/auth/status clears cookie when session is invalid or expired', async () => {
  defaultUpstreamClient.revalidateAuthResult = async () => ({
    status: 'unauthenticated',
    authenticated: false,
  });
  defaultUpstreamClient.request = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ authenticated: false, authMode: 'password' }),
  });

  const req = new Request('http://127.0.0.1:20130/api/auth/status', {
    headers: { cookie: 'quota_session=expired-or-invalid-token' },
  });

  const res = await getAuthStatus(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.authenticated, false);

  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie);
  assert.ok(setCookie.includes('Max-Age=0'));
});

// 8. Quota 401 disambiguation: provider token expired vs 9router session expired
test('GET /api/quota/[id] returns PROVIDER_AUTH_REQUIRED when provider returns 401 but session is valid', async () => {
  const session = defaultSessionStore.createSession('valid-session-upstream-token');
  const cookieVal = buildSessionCookie(session.token);

  defaultSessionStore.addKnownAccounts(session.token, ['c-codex-exp']);
  defaultUpstreamClient.revalidateAuthResult = async () => ({
    status: 'authenticated',
    authenticated: true,
  });

  defaultUpstreamClient.request = async (path) => {
    if (path.includes('/api/usage/c-codex-exp')) {
      return {
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Codex token expired. Reconnect in providers.',
          provider: 'codex',
        }),
      };
    }
    if (path.includes('/api/auth/status')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ authenticated: true }),
      };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const req = new Request('http://127.0.0.1:20130/api/quota/c-codex-exp', {
    headers: { cookie: cookieVal },
  });

  const res = await getQuota(req, { params: Promise.resolve({ id: 'c-codex-exp' }) });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'unavailable');
  assert.equal(data.reason, 'PROVIDER_AUTH_REQUIRED');
  // Must NOT contain raw error message leaks
  assert.equal(JSON.stringify(data).includes('Codex token expired. Reconnect'), false);
});
