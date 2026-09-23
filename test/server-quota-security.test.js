import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as getQuota } from '../app/api/quota/[id]/route.js';
import { defaultSessionStore } from '../lib/server/session.js';
import { defaultUpstreamClient } from '../lib/server/upstream.js';
import { buildSessionCookie, getLastKnownGoodQuota } from '../lib/server/routeHelpers.js';

test('GET /api/quota/[id] clears cached quota on 404/403 account revocation', async () => {
  const session = defaultSessionStore.createSession('tok-revoke');
  const cookieVal = buildSessionCookie(session.token);
  defaultUpstreamClient.revalidateAuth = async () => true;
  defaultSessionStore.addKnownAccounts(session.token, [{ id: 'c-rev-1', provider: 'codex' }]);

  defaultUpstreamClient.request = async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({ quotas: { session: { used: 10, total: 100 } } }),
  });
  const res1 = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-rev-1', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-rev-1' }) });
  assert.equal(res1.status, 200);
  assert.ok(getLastKnownGoodQuota(session.token, 'c-rev-1'));

  defaultUpstreamClient.request = async () => {
    const err = new Error('Not found upstream');
    err.status = 404;
    err.code = 'CONNECTION_NOT_FOUND';
    throw err;
  };
  const res404 = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-rev-1?force=true', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-rev-1' }) });
  assert.equal(res404.status, 404);
  assert.equal(getLastKnownGoodQuota(session.token, 'c-rev-1'), null);
});

test('GET /api/quota/[id] enforces provider cadence on force refresh for Claude and throttles force hammering', async () => {
  const session = defaultSessionStore.createSession('tok-cadence');
  const cookieVal = buildSessionCookie(session.token);
  defaultUpstreamClient.revalidateAuth = async () => true;
  defaultSessionStore.addKnownAccounts(session.token, [
    { id: 'c-claude-cadence', provider: 'claude' },
    { id: 'c-codex-cadence', provider: 'codex' },
  ]);

  let claudeCalls = 0;
  defaultUpstreamClient.request = async (path) => {
    if (path.includes('c-claude-cadence')) {
      claudeCalls++;
      return { ok: true, status: 200, text: async () => JSON.stringify({ provider: 'claude', quotas: { session: { used: 10, total: 100 } } }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify({ provider: 'codex', quotas: { session: { used: 20, total: 100 } } }) };
  };

  const cRes1 = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-claude-cadence', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-claude-cadence' }) });
  assert.equal(cRes1.status, 200);
  assert.equal(claudeCalls, 1);

  const cResForce = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-claude-cadence?force=true', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-claude-cadence' }) });
  assert.equal(cResForce.status, 200);
  assert.equal(claudeCalls, 1);

  let codexCalls = 0;
  defaultUpstreamClient.request = async () => {
    codexCalls++;
    return { ok: true, status: 200, text: async () => JSON.stringify({ provider: 'codex', quotas: { session: { used: 20 + codexCalls, total: 100 } } }) };
  };
  await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-codex-cadence', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-codex-cadence' }) });
  assert.equal(codexCalls, 1);

  await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-codex-cadence?force=true', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-codex-cadence' }) });
  assert.equal(codexCalls, 2);

  await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-codex-cadence?force=true', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-codex-cadence' }) });
  assert.equal(codexCalls, 2);
});

test('GET /api/quota/[id] preserves original receivedAt and applies retry backoff without mutating cache in-place', async () => {
  const session = defaultSessionStore.createSession('tok-backoff');
  const cookieVal = buildSessionCookie(session.token);
  defaultUpstreamClient.revalidateAuth = async () => true;
  defaultSessionStore.addKnownAccounts(session.token, [{ id: 'c-mut-1', provider: 'codex' }]);

  defaultUpstreamClient.request = async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({ quotas: { session: { used: 15, total: 100 } } }),
  });
  const res1 = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-mut-1', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-mut-1' }) });
  const data1 = await res1.json();
  const originalReceivedAt = data1.receivedAt;
  assert.ok(originalReceivedAt);

  const cachedBefore = getLastKnownGoodQuota(session.token, 'c-mut-1');
  const cachedNextRefreshBefore = cachedBefore.nextRefreshAt;

  defaultUpstreamClient.request = async () => {
    const err = new Error('Upstream timeout');
    err.code = 'UPSTREAM_TIMEOUT';
    err.status = 504;
    throw err;
  };
  const staleRes = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-mut-1?force=true', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-mut-1' }) });
  const staleData = await staleRes.json();
  assert.equal(staleData.status, 'stale');
  assert.equal(staleData.receivedAt, originalReceivedAt);

  assert.equal(cachedBefore.nextRefreshAt, cachedNextRefreshBefore);
});

test('GET /api/quota/[id] returns stale status during retry backoff instead of false healthy ok', async () => {
  const session = defaultSessionStore.createSession('tok-stale-cache');
  const cookieVal = buildSessionCookie(session.token);
  defaultUpstreamClient.revalidateAuth = async () => true;
  defaultSessionStore.addKnownAccounts(session.token, [{ id: 'c-stale-1', provider: 'codex' }]);

  defaultUpstreamClient.request = async () => ({
    ok: true, status: 200, text: async () => JSON.stringify({ quotas: { session: { used: 15, total: 100 } } }),
  });
  const res1 = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-stale-1', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-stale-1' }) });
  assert.equal(res1.status, 200);

  defaultUpstreamClient.request = async () => {
    const err = new Error('Upstream timeout');
    err.code = 'UPSTREAM_TIMEOUT';
    err.status = 504;
    throw err;
  };
  await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-stale-1?force=true', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-stale-1' }) });

  const backoffRes = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-stale-1', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-stale-1' }) });
  assert.equal(backoffRes.status, 200);
  const backoffData = await backoffRes.json();
  assert.equal(backoffData.status, 'stale');
  assert.equal(backoffData.stale, true);
  assert.equal(backoffData.reason, 'STALE_DATA');
  assert.equal(backoffData.windows[0].used, 15);
});

test('GET /api/quota/[id] prevents force hammering after failure and when no cache', async () => {
  const session = defaultSessionStore.createSession('tok-hammer');
  const cookieVal = buildSessionCookie(session.token);
  defaultUpstreamClient.revalidateAuth = async () => true;
  defaultSessionStore.addKnownAccounts(session.token, [
    { id: 'c-fail-hammer', provider: 'codex' },
    { id: 'c-nocache-hammer', provider: 'codex' },
  ]);

  let upstreamCalls = 0;
  defaultUpstreamClient.request = async (path) => {
    upstreamCalls++;
    const err = new Error('Upstream timeout');
    err.code = 'UPSTREAM_TIMEOUT';
    err.status = 504;
    throw err;
  };

  const cachedEntry = {
    connectionId: 'c-fail-hammer',
    provider: 'codex',
    plan: null,
    status: 'ok',
    reason: null,
    windows: [{ key: 'session', used: 10, total: 100 }],
    receivedAt: '2026-09-23T10:00:00.000Z',
    nextRefreshAt: new Date(Date.now() - 1000).toISOString(),
  };
  const { setCachedQuota } = await import('../lib/server/routeHelpers.js');
  setCachedQuota(session.token, 'c-fail-hammer', cachedEntry);

  const failRes1 = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-fail-hammer?force=true', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-fail-hammer' }) });
  assert.equal(failRes1.status, 200);
  assert.equal(upstreamCalls, 1);

  const failRes2 = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-fail-hammer?force=true', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-fail-hammer' }) });
  assert.equal(failRes2.status, 200);
  assert.equal(upstreamCalls, 1);
  const failData2 = await failRes2.json();
  assert.equal(failData2.status, 'stale');

  upstreamCalls = 0;
  const noCacheRes1 = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-nocache-hammer?force=true', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-nocache-hammer' }) });
  assert.equal(upstreamCalls, 1);

  const noCacheRes2 = await getQuota(new Request('http://127.0.0.1:20130/api/quota/c-nocache-hammer?force=true', { headers: { cookie: cookieVal } }), { params: Promise.resolve({ id: 'c-nocache-hammer' }) });
  assert.equal(upstreamCalls, 1);
  assert.equal(noCacheRes2.status, 429);
});
