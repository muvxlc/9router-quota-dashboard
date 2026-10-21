import test from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODES, createErrorResponse } from '../lib/server/errors.js';
import {
  MAXPLUS_ALLOWED_PATHS,
  isAllowedMaxplusPath,
  mapMaxplusStatus,
  createMaxplusClient,
  defaultMaxplusClient,
} from '../lib/server/maxplus.js';

// Error code assertions (owned by task 3; keep below section intact)

test('ERROR_CODES includes the MaxPlus billing error codes', () => {
  assert.deepEqual(ERROR_CODES.UPSTREAM_FORBIDDEN, {
    status: 403,
    defaultMessage: 'Upstream rejected the configured credential',
  });
  assert.deepEqual(ERROR_CODES.UPSTREAM_NOT_FOUND, {
    status: 404,
    defaultMessage: 'Upstream endpoint not found',
  });
  assert.deepEqual(ERROR_CODES.MAXPLUS_UNCONFIGURED, {
    status: 503,
    defaultMessage: 'Billing service is not configured',
  });
});

test('createErrorResponse(503, MAXPLUS_UNCONFIGURED) returns 503 with the code in the body', async () => {
  const res = createErrorResponse(503, 'MAXPLUS_UNCONFIGURED');
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error.code, 'MAXPLUS_UNCONFIGURED');
  assert.equal(body.error.message, 'Billing service is not configured');
});

// Billing client tests (appended by the billing-client todo)

const BASE_URL = 'https://maxplus.example';

function jsonResponse(status, body = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientWith(fetchFn, overrides = {}) {
  return createMaxplusClient({ fetchFn, baseUrl: BASE_URL, apiKey: 'ccsk-test', ...overrides });
}

async function expectReject(promise, code, status) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code);
    if (typeof status === 'number') assert.equal(err.status, status);
    return true;
  });
}

test('MAXPLUS_ALLOWED_PATHS lists exactly the two billing endpoints', () => {
  assert.deepEqual(MAXPLUS_ALLOWED_PATHS, ['/v1/usage', '/v1/me']);
});

test('isAllowedMaxplusPath accepts both endpoints with and without a query string', () => {
  for (const path of [
    '/v1/usage',
    '/v1/me',
    '/v1/usage?period=7d',
    '/v1/me?x=1',
  ]) {
    assert.equal(isAllowedMaxplusPath(path), true, path);
  }
});

test('isAllowedMaxplusPath rejects non-exact, traversal, and absolute paths', () => {
  for (const path of [
    '/v1/usage/',
    '/v1/keys',
    '/v1/usage/../me',
    '/api/usage',
    'https://evil.example/v1/me',
    '/v1/usage\\..\\me',
    '/v1/usage\u0000',
    null,
  ]) {
    assert.equal(isAllowedMaxplusPath(path), false, String(path));
  }
});

test('mapMaxplusStatus maps every documented status', () => {
  assert.equal(mapMaxplusStatus(200), null);
  assert.equal(mapMaxplusStatus(204), null);
  assert.equal(mapMaxplusStatus(401), 'UPSTREAM_FORBIDDEN');
  assert.equal(mapMaxplusStatus(403), 'UPSTREAM_FORBIDDEN');
  assert.equal(mapMaxplusStatus(404), 'UPSTREAM_NOT_FOUND');
  assert.equal(mapMaxplusStatus(429), 'RATE_LIMITED');
  assert.equal(mapMaxplusStatus(500), 'UPSTREAM_UNAVAILABLE');
  assert.equal(mapMaxplusStatus(302), 'UPSTREAM_UNAVAILABLE');
});

test('request sends Bearer auth, no Cookie, and targets the configured base URL', async () => {
  let seenUrl = null;
  let seenInit = null;
  const client = clientWith(async (url, init) => {
    seenUrl = url;
    seenInit = init;
    return jsonResponse(200, { period: '7d' });
  });

  const res = await client.request('/v1/usage');
  assert.equal(res.status, 200);
  assert.equal(seenUrl, 'https://maxplus.example/v1/usage');
  assert.equal(seenInit.method, 'GET');
  assert.equal(seenInit.redirect, 'manual');
  assert.equal(seenInit.headers.Authorization, 'Bearer ccsk-test');
  assert.equal(seenInit.headers.Accept, 'application/json');
  assert.equal('Cookie' in seenInit.headers, false);
  assert.equal('cookie' in seenInit.headers, false);
});

test('request rejects 401/403 as UPSTREAM_FORBIDDEN 403', async () => {
  for (const status of [401, 403]) {
    const client = clientWith(async () => jsonResponse(status, { error: 'nope' }));
    await expectReject(client.request('/v1/me'), 'UPSTREAM_FORBIDDEN', 403);
  }
});

test('request rejects 404 as UPSTREAM_NOT_FOUND 404', async () => {
  const client = clientWith(async () => jsonResponse(404));
  await expectReject(client.request('/v1/usage'), 'UPSTREAM_NOT_FOUND', 404);
});

test('request rejects 429 as RATE_LIMITED 429', async () => {
  const client = clientWith(async () => jsonResponse(429));
  await expectReject(client.request('/v1/usage'), 'RATE_LIMITED', 429);
});

test('request rejects 500 as UPSTREAM_UNAVAILABLE 503', async () => {
  const client = clientWith(async () => jsonResponse(500));
  await expectReject(client.request('/v1/usage'), 'UPSTREAM_UNAVAILABLE', 503);
});

test('request rejects a 302 redirect as INVALID_UPSTREAM_RESPONSE 502', async () => {
  const client = clientWith(async () => new Response(null, { status: 302, headers: { Location: '/v1/me' } }));
  await expectReject(client.request('/v1/usage'), 'INVALID_UPSTREAM_RESPONSE', 502);
});

test('request rejects a network failure as UPSTREAM_UNAVAILABLE 503', async () => {
  const client = clientWith(async () => {
    throw new TypeError('fetch failed');
  });
  await expectReject(client.request('/v1/usage'), 'UPSTREAM_UNAVAILABLE', 503);
});

test('an empty apiKey throws MAXPLUS_UNCONFIGURED 503', async () => {
  const client = clientWith(async () => jsonResponse(200), { apiKey: '' });
  await expectReject(client.request('/v1/usage'), 'MAXPLUS_UNCONFIGURED', 503);
});

test('a null baseUrl throws MAXPLUS_UNCONFIGURED 503, not INVALID_REQUEST', async () => {
  const client = clientWith(async () => jsonResponse(200), { baseUrl: null });
  await expectReject(client.request('/v1/usage'), 'MAXPLUS_UNCONFIGURED', 503);
});

test('a non-allowlisted path throws INVALID_REQUEST 400 without calling fetch', async () => {
  let calls = 0;
  const client = clientWith(async () => {
    calls += 1;
    return jsonResponse(200);
  });
  await expectReject(client.request('/v1/keys'), 'INVALID_REQUEST', 400);
  await expectReject(client.request('/v1/usage/'), 'INVALID_REQUEST', 400);
  await expectReject(client.request('https://evil.example/v1/me'), 'INVALID_REQUEST', 400);
  assert.equal(calls, 0);
});

test('a hanging fetch aborts under a 20ms timeoutMs as UPSTREAM_TIMEOUT 504', async () => {
  const hangingFetch = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      reject(err);
    });
  });
  const client = clientWith(hangingFetch);
  await expectReject(client.request('/v1/usage', { timeoutMs: 20 }), 'UPSTREAM_TIMEOUT', 504);
});

test('no thrown error message contains the API key', async () => {
  const key = 'ccsk-supersecret-value';
  const failures = [
    async () => {
      throw new TypeError('fetch failed');
    },
    async () => jsonResponse(500),
    async () => jsonResponse(302),
  ];

  for (const fetchFn of failures) {
    const client = clientWith(fetchFn, { apiKey: key });
    try {
      await client.request('/v1/usage');
      assert.fail('expected rejection');
    } catch (err) {
      assert.equal(err.message.includes(key), false, err.message);
    }
  }

  const unconfigured = clientWith(async () => jsonResponse(200), { apiKey: '' });
  try {
    await unconfigured.request('/v1/usage');
    assert.fail('expected rejection');
  } catch (err) {
    assert.equal(err.message.includes(key), false);
  }
});

test('defaultMaxplusClient is a client with a request method', () => {
  assert.equal(typeof defaultMaxplusClient.request, 'function');
});
