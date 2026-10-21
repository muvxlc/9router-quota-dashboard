import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSummaryHandler,
  resetSummaryCache,
} from '../lib/server/maxplusSummaryRoute.js';
import { createMaxplusClient } from '../lib/server/maxplus.js';
import { defaultSessionStore } from '../lib/server/session.js';
import { defaultUpstreamClient } from '../lib/server/upstream.js';
import { buildSessionCookie } from '../lib/server/routeHelpers.js';

const NOW_MS = Date.parse('2026-10-20T00:00:00.000Z');
const TTL = 30 * 1000;

function ok(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function failure(code, status) {
  const err = new Error('billing failed');
  err.code = code;
  err.status = status;
  return err;
}

function fakeClient(routes) {
  const calls = [];
  const waiters = [];
  const client = {
    calls,
    onCalls(n, fn) {
      waiters.push({ n, fn });
      if (calls.length >= n) fn();
    },
    async request(path) {
      calls.push(path);
      for (let i = waiters.length - 1; i >= 0; i -= 1) {
        if (calls.length >= waiters[i].n) {
          const [w] = waiters.splice(i, 1);
          w.fn();
        }
      }
      const handler = routes[path];
      if (!handler) throw failure('UPSTREAM_UNAVAILABLE', 503);
      return handler();
    },
  };
  return client;
}

function sessionRequest(query = '') {
  const session = defaultSessionStore.createSession('upstream-token-summary');
  const cookie = buildSessionCookie(session.token);
  return new Request(`http://127.0.0.1:20130/api/live-models/summary${query}`, {
    headers: { cookie },
  });
}

function makeHandler(client, clock) {
  return createSummaryHandler({ client, now: () => clock.ms, cacheTtlMs: TTL });
}

beforeEach(() => {
  resetSummaryCache();
  defaultUpstreamClient.revalidateAuthResult = async () => ({
    status: 'authenticated',
    authenticated: true,
  });
});

test('GET summary returns 401 SESSION_REQUIRED without a session and never bills', async () => {
  const client = fakeClient({});
  const handler = makeHandler(client, { ms: NOW_MS });

  const res = await handler(new Request('http://127.0.0.1:20130/api/live-models/summary'));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error.code, 'SESSION_REQUIRED');
  assert.equal(client.calls.length, 0);
});

test('GET summary rejects any query parameter with 400 INVALID_REQUEST', async () => {
  const client = fakeClient({});
  const handler = makeHandler(client, { ms: NOW_MS });

  for (const query of ['?period=7d', '?x=1']) {
    const res = await handler(sessionRequest(query));
    assert.equal(res.status, 400, query);
    const body = await res.json();
    assert.equal(body.error.code, 'INVALID_REQUEST', query);
  }
  assert.equal(client.calls.length, 0);
});

test('GET summary returns 200 with all five fields when both endpoints answer', async () => {
  const client = fakeClient({
    '/v1/usage': async () => ok({ period: '7d', totals: { total_cost: 12.5 } }),
    '/v1/me': async () => ok({ credit_usd: 3.25 }),
  });
  const handler = makeHandler(client, { ms: NOW_MS });

  const res = await handler(sessionRequest());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    period: '7d',
    totalCost: 12.5,
    creditUsd: 3.25,
    usageReceivedAt: new Date(NOW_MS).toISOString(),
    creditReceivedAt: new Date(NOW_MS).toISOString(),
  });
  assert.deepEqual(client.calls.sort(), ['/v1/me', '/v1/usage']);
});

test('GET summary returns 200 with credit nulls when /v1/me is forbidden', async () => {
  const client = fakeClient({
    '/v1/usage': async () => ok({ period: '30d', totals: { total_cost: 1 } }),
    '/v1/me': async () => new Response('denied', { status: 403 }),
  });
  const handler = makeHandler(client, { ms: NOW_MS });

  const res = await handler(sessionRequest());
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    period: '30d',
    totalCost: 1,
    creditUsd: null,
    usageReceivedAt: new Date(NOW_MS).toISOString(),
    creditReceivedAt: null,
  });
});

test('GET summary maps both-side failures through mapMaxplusStatus', async () => {
  const cases = [
    { status: 401, expected: 403, code: 'UPSTREAM_FORBIDDEN' },
    { status: 403, expected: 403, code: 'UPSTREAM_FORBIDDEN' },
    { status: 404, expected: 404, code: 'UPSTREAM_NOT_FOUND' },
    { status: 500, expected: 503, code: 'UPSTREAM_UNAVAILABLE' },
  ];

  for (const { status, expected, code } of cases) {
    resetSummaryCache();
    const client = fakeClient({
      '/v1/usage': async () => new Response('secret', { status }),
      '/v1/me': async () => new Response('secret', { status }),
    });
    const handler = makeHandler(client, { ms: NOW_MS });
    const res = await handler(sessionRequest());
    assert.equal(res.status, expected, `status ${status}`);
    const body = await res.json();
    assert.equal(body.error.code, code, `status ${status}`);
    assert.equal(client.calls.length, 2, `status ${status}`);
  }
});

test('GET summary returns 502 INVALID_UPSTREAM_RESPONSE on non-JSON bodies', async () => {
  const client = fakeClient({
    '/v1/usage': async () => new Response('not json at all', { status: 200 }),
    '/v1/me': async () => new Response('<html>nope</html>', { status: 200 }),
  });
  const handler = makeHandler(client, { ms: NOW_MS });

  const res = await handler(sessionRequest());
  assert.equal(res.status, 502);
  const body = await res.json();
  assert.equal(body.error.code, 'INVALID_UPSTREAM_RESPONSE');
});

test('single-side 404/500/timeout/non-JSON degrades to 200 with that side null', async () => {
  const meFailures = [
    async () => new Response('nope', { status: 404 }),
    async () => new Response('nope', { status: 500 }),
    async () => {
      throw failure('UPSTREAM_TIMEOUT', 504);
    },
    async () => new Response('not json', { status: 200 }),
  ];

  for (const meFailure of meFailures) {
    resetSummaryCache();
    const client = fakeClient({
      '/v1/usage': async () => ok({ period: '1d', totals: { total_cost: 2 } }),
      '/v1/me': meFailure,
    });
    const handler = makeHandler(client, { ms: NOW_MS });
    const res = await handler(sessionRequest());
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.totalCost, 2);
    assert.equal(body.creditUsd, null);
    assert.equal(body.creditReceivedAt, null);
  }
});

test('both sides timing out returns 504 UPSTREAM_TIMEOUT', async () => {
  const client = fakeClient({
    '/v1/usage': async () => {
      throw failure('UPSTREAM_TIMEOUT', 504);
    },
    '/v1/me': async () => {
      throw failure('UPSTREAM_TIMEOUT', 504);
    },
  });
  const handler = makeHandler(client, { ms: NOW_MS });
  const res = await handler(sessionRequest());
  assert.equal(res.status, 504);
  assert.equal((await res.json()).error.code, 'UPSTREAM_TIMEOUT');
});

test('GET summary returns 503 MAXPLUS_UNCONFIGURED when the API key is empty', async () => {
  let fetched = 0;
  const client = createMaxplusClient({
    fetchFn: async () => {
      fetched += 1;
      return ok({});
    },
    baseUrl: 'https://maxplus.example',
    apiKey: '',
  });
  const handler = makeHandler(client, { ms: NOW_MS });

  const res = await handler(sessionRequest());
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'MAXPLUS_UNCONFIGURED');
  assert.equal(fetched, 0);
});

test('GET summary returns 503 MAXPLUS_UNCONFIGURED when the base URL is absent', async () => {
  let fetched = 0;
  const client = createMaxplusClient({
    fetchFn: async () => {
      fetched += 1;
      return ok({});
    },
    baseUrl: null,
    apiKey: 'ccsk-test',
  });
  const handler = makeHandler(client, { ms: NOW_MS });

  const res = await handler(sessionRequest());
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.code, 'MAXPLUS_UNCONFIGURED');
  assert.equal(fetched, 0);
});

test('singleflight coalesces concurrent cold GETs and caches for 30s', async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const client = fakeClient({
    '/v1/usage': async () => {
      await gate;
      return ok({ period: '7d', totals: { total_cost: 1 } });
    },
    '/v1/me': async () => {
      await gate;
      return ok({ credit_usd: 2 });
    },
  });
  const clock = { ms: NOW_MS };
  const handler = makeHandler(client, clock);

  const callsReady = new Promise((resolve) => client.onCalls(2, resolve));
  const first = handler(sessionRequest());
  const second = handler(sessionRequest());
  await callsReady;
  assert.equal(client.calls.length, 2, 'exactly one billing pair for two cold GETs');

  release();
  const [resA, resB] = await Promise.all([first, second]);
  assert.equal(resA.status, 200);
  assert.equal(resB.status, 200);
  assert.deepEqual(await resA.json(), await resB.json());
  assert.equal(client.calls.length, 2);

  clock.ms = NOW_MS + 29000;
  const warm = await handler(sessionRequest());
  assert.equal(warm.status, 200);
  assert.equal(client.calls.length, 2, 'sequential GET inside TTL is free');

  clock.ms = NOW_MS + 31000;
  const cold = await handler(sessionRequest());
  assert.equal(cold.status, 200);
  assert.equal(client.calls.length, 4, 'GET after TTL re-bills');
});

test('failure cooldown: 503 is cached for 30s and re-billed only after expiry', async () => {
  const client = fakeClient({
    '/v1/usage': async () => {
      throw failure('UPSTREAM_UNAVAILABLE', 503);
    },
    '/v1/me': async () => {
      throw failure('UPSTREAM_UNAVAILABLE', 503);
    },
  });
  const clock = { ms: NOW_MS };
  const handler = makeHandler(client, clock);

  const first = await handler(sessionRequest());
  assert.equal(first.status, 503);
  assert.equal((await first.json()).error.code, 'UPSTREAM_UNAVAILABLE');
  assert.equal(client.calls.length, 2);

  for (const offset of [1000, 5000, 10000, 20000, 29000]) {
    clock.ms = NOW_MS + offset;
    const res = await handler(sessionRequest());
    assert.equal(res.status, 503, `offset ${offset}`);
    assert.equal((await res.json()).error.code, 'UPSTREAM_UNAVAILABLE', `offset ${offset}`);
    assert.equal(client.calls.length, 2, `offset ${offset} made no billing calls`);
  }

  clock.ms = NOW_MS + 31000;
  const expired = await handler(sessionRequest());
  assert.equal(expired.status, 503);
  assert.equal(client.calls.length, 4, 'cooldown expired re-bills');
});

test('partial cooldown: 200-with-nulls is cached for 30s and re-billed only after expiry', async () => {
  const client = fakeClient({
    '/v1/usage': async () => ok({ period: '7d', totals: { total_cost: 4 } }),
    '/v1/me': async () => new Response('boom', { status: 500 }),
  });
  const clock = { ms: NOW_MS };
  const handler = makeHandler(client, clock);

  const first = await handler(sessionRequest());
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.creditUsd, null);
  assert.equal(firstBody.creditReceivedAt, null);
  assert.equal(client.calls.length, 2);

  for (const offset of [1000, 5000, 10000, 20000, 29000]) {
    clock.ms = NOW_MS + offset;
    const res = await handler(sessionRequest());
    assert.equal(res.status, 200, `offset ${offset}`);
    assert.deepEqual(await res.json(), firstBody, `offset ${offset} serves the cached attempt`);
    assert.equal(client.calls.length, 2, `offset ${offset} made no billing calls`);
  }

  clock.ms = NOW_MS + 31000;
  const expired = await handler(sessionRequest());
  assert.equal(expired.status, 200);
  assert.equal(client.calls.length, 4, 'cooldown expired re-bills');
});

test('responses never leak credentials or raw upstream text', async () => {
  const client = fakeClient({
    '/v1/usage': async () =>
      ok({
        period: 'ccsk-leak',
        totals: { total_cost: 1 },
        auth_token: 'auth_token-raw',
        note: 'Bearer ccsk-secret',
      }),
    '/v1/me': async () => new Response('raw-upstream-body', { status: 500 }),
  });
  const handler = makeHandler(client, { ms: NOW_MS });

  const res = await handler(sessionRequest());
  const text = await res.text();
  const headerText = [...res.headers.entries()].flat().join(' ');
  for (const forbidden of ['ccsk-', 'auth_token', 'Bearer', 'raw-upstream-body']) {
    assert.equal(text.includes(forbidden), false, `body leaked ${forbidden}`);
    assert.equal(headerText.includes(forbidden), false, `header leaked ${forbidden}`);
  }
});
