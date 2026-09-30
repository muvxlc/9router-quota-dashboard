import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as postGovernor } from '../app/api/connections/[id]/governor/route.js';
import { defaultSessionStore } from '../lib/server/session.js';
import { defaultUpstreamClient } from '../lib/server/upstream.js';
import { buildSessionCookie } from '../lib/server/routeHelpers.js';
import { APP_ORIGIN } from '../lib/server/config.js';

const appHost = new URL(APP_ORIGIN).host;

test('POST governor rejects requests with invalid origin (CSRF protection)', async () => {
  const req = new Request('http://127.0.0.1:20130/api/connections/c1/governor', {
    method: 'POST',
    headers: {
      origin: 'https://evil.com',
      host: appHost,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ active: false }),
  });

  const res = await postGovernor(req, { params: Promise.resolve({ id: 'c1' }) });
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.error.code, 'ORIGIN_REJECTED');
});

test('POST governor rejects unauthenticated requests', async () => {
  const req = new Request('http://127.0.0.1:20130/api/connections/c1/governor', {
    method: 'POST',
    headers: {
      origin: APP_ORIGIN,
      host: appHost,
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: JSON.stringify({ active: false }),
  });

  const res = await postGovernor(req, { params: Promise.resolve({ id: 'c1' }) });
  assert.equal(res.status, 401);
});

test('POST governor returns upstream mode when 9router PATCH succeeds', async () => {
  const sessionInfo = defaultSessionStore.createSession('mock-upstream-token');
  defaultSessionStore.addKnownAccounts(sessionInfo.token, [{ id: 'c1', provider: 'codex' }]);

  defaultUpstreamClient.revalidateAuthResult = async () => ({ status: 'authenticated' });
  defaultUpstreamClient.request = async (path, options) => {
    if (path === '/api/providers/client/c1' && options.method === 'PATCH') {
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const req = new Request('http://127.0.0.1:20130/api/connections/c1/governor', {
    method: 'POST',
    headers: {
      origin: APP_ORIGIN,
      host: appHost,
      cookie: buildSessionCookie(sessionInfo.token),
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: JSON.stringify({ active: false }),
  });

  const res = await postGovernor(req, { params: Promise.resolve({ id: 'c1' }) });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.connectionId, 'c1');
  assert.equal(data.active, false);
  assert.equal(data.mode, 'upstream');
  assert.equal(data.notice, null);
});

test('POST governor returns simulated mode when 9router returns 405 Method Not Allowed', async () => {
  const sessionInfo = defaultSessionStore.createSession('mock-upstream-token-2');
  defaultSessionStore.addKnownAccounts(sessionInfo.token, [{ id: 'c2', provider: 'antigravity' }]);

  defaultUpstreamClient.revalidateAuthResult = async () => ({ status: 'authenticated' });
  defaultUpstreamClient.request = async (path, options) => {
    if (path === '/api/providers/client/c2' && options.method === 'PATCH') {
      return { ok: false, status: 405, json: async () => ({ error: 'Method Not Allowed' }) };
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const req = new Request('http://127.0.0.1:20130/api/connections/c2/governor', {
    method: 'POST',
    headers: {
      origin: APP_ORIGIN,
      host: appHost,
      cookie: buildSessionCookie(sessionInfo.token),
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: JSON.stringify({ active: false }),
  });

  const res = await postGovernor(req, { params: Promise.resolve({ id: 'c2' }) });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.connectionId, 'c2');
  assert.equal(data.active, false);
  assert.equal(data.mode, 'simulated');
  assert.match(data.notice, /read-only/i);

  const override = defaultSessionStore.getConnectionOverride(sessionInfo.token, 'c2');
  assert.deepEqual(override, { active: false });
});

test('POST governor propagates 504 on upstream timeout without claiming read-only', async () => {
  const sessionInfo = defaultSessionStore.createSession('mock-upstream-token-3');
  defaultSessionStore.addKnownAccounts(sessionInfo.token, [{ id: 'c3', provider: 'codex' }]);

  defaultUpstreamClient.revalidateAuthResult = async () => ({ status: 'authenticated' });
  defaultUpstreamClient.request = async () => {
    const timeoutErr = new Error('Upstream request timed out');
    timeoutErr.code = 'UPSTREAM_TIMEOUT';
    timeoutErr.status = 504;
    throw timeoutErr;
  };

  const req = new Request('http://127.0.0.1:20130/api/connections/c3/governor', {
    method: 'POST',
    headers: {
      origin: APP_ORIGIN,
      host: appHost,
      cookie: buildSessionCookie(sessionInfo.token),
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: JSON.stringify({ active: true }),
  });

  const res = await postGovernor(req, { params: Promise.resolve({ id: 'c3' }) });
  assert.equal(res.status, 504);
  const data = await res.json();
  assert.equal(data.error.code, 'UPSTREAM_TIMEOUT');
});
