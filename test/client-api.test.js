import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchAllConnections,
  fetchQuotaWithCadence,
  runWithConcurrency,
  fetchAuthStatus,
  loginWithPassword,
  logout,
  fetchStats,
} from '../lib/client/api.js';

test('fetchAllConnections fetches sequentially, dedupes, and handles clamped pagination', async () => {
  const pages = {
    1: {
      connections: [
        { id: 'c1', provider: 'codex', label: 'user1@test.com', active: true },
        { id: 'c2', provider: 'codex', label: 'user2@test.com', active: true },
      ],
      pagination: { page: 1, pageSize: 2, total: 4, totalPages: 2 },
    },
    2: {
      connections: [
        { id: 'c3', provider: 'antigravity', label: 'user3@test.com', active: true },
        { id: 'c1', provider: 'codex', label: 'user1@test.com', active: true }, // duplicate
      ],
      pagination: { page: 2, pageSize: 2, total: 4, totalPages: 2 },
    },
  };

  const fetchedPages = [];
  const mockFetch = async (url) => {
    const pageMatch = url.match(/page=(\d+)/);
    const p = pageMatch ? Number(pageMatch[1]) : 1;
    fetchedPages.push(p);
    return {
      ok: true,
      status: 200,
      json: async () => pages[p] || { connections: [], pagination: { page: p, pageSize: 2, total: 0, totalPages: 0 } },
    };
  };

  const batches = [];
  const result = await fetchAllConnections({
    fetchFn: mockFetch,
    pageSize: 2,
    onPageBatch: (batch) => batches.push(batch),
  });

  assert.equal(result.length, 3); // c1, c2, c3 (deduped)
  assert.deepEqual(fetchedPages, [1, 2]);
  assert.equal(batches.length, 2);
});

test('fetchAllConnections stops when repeated page detected (clamped/infinite loop protection)', async () => {
  // Mock server that keeps returning page 1 data even when requesting page 2
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      connections: [{ id: 'repeat-1', provider: 'codex', label: 'rep@test.com', active: true }],
      pagination: { page: 1, pageSize: 1, total: 10, totalPages: 10 },
    }),
  });

  const result = await fetchAllConnections({
    fetchFn: mockFetch,
    pageSize: 1,
  });

  assert.equal(result.length, 1);
});

test('fetchQuotaWithCadence respects nextRefreshAt unless expired or forced', async () => {
  const now = Date.now();
  const futureIso = new Date(now + 60000).toISOString();
  const pastIso = new Date(now - 1000).toISOString();

  let networkCalls = 0;
  const mockFetch = async () => {
    networkCalls++;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        connectionId: 'c1',
        provider: 'codex',
        status: 'ok',
        windows: [{ key: '5h', remainingPercent: 80, unlimited: false }],
        nextRefreshAt: futureIso,
        receivedAt: new Date().toISOString(),
      }),
    };
  };

  // 1. Existing valid quota with future nextRefreshAt -> returns cached, 0 network calls
  const existingValid = {
    connectionId: 'c1',
    status: 'ok',
    nextRefreshAt: futureIso,
    receivedAt: new Date(now - 5000).toISOString(),
    windows: [{ key: '5h', remainingPercent: 85, unlimited: false }],
  };

  const res1 = await fetchQuotaWithCadence({
    fetchFn: mockFetch,
    connectionId: 'c1',
    cachedQuota: existingValid,
    force: false,
    nowMs: now,
  });
  assert.equal(networkCalls, 0);
  assert.equal(res1.windows[0].remainingPercent, 85);

  // 2. Existing expired quota -> fetches network
  const existingExpired = {
    ...existingValid,
    nextRefreshAt: pastIso,
  };
  const res2 = await fetchQuotaWithCadence({
    fetchFn: mockFetch,
    connectionId: 'c1',
    cachedQuota: existingExpired,
    force: false,
    nowMs: now,
  });
  assert.equal(networkCalls, 1);
  assert.equal(res2.windows[0].remainingPercent, 80);

  // 3. Force refresh -> fetches network even if future
  await fetchQuotaWithCadence({
    fetchFn: mockFetch,
    connectionId: 'c1',
    cachedQuota: existingValid,
    force: true,
    nowMs: now,
  });
  assert.equal(networkCalls, 2);
});

test('runWithConcurrency limits concurrent executions to maximum limit', async () => {
  let inFlight = 0;
  let maxInFlight = 0;

  const tasks = Array.from({ length: 10 }, (_, i) => async () => {
    inFlight++;
    if (inFlight > maxInFlight) maxInFlight = inFlight;
    await new Promise((resolve) => setTimeout(resolve, 15));
    inFlight--;
    return i * 2;
  });

  const results = await runWithConcurrency(tasks, 4);
  assert.equal(results.length, 10);
  assert.ok(maxInFlight <= 4, `Expected max in-flight <= 4, got ${maxInFlight}`);
  assert.equal(results[5], 10);
});

test('fetchAuthStatus, loginWithPassword, logout communicate with exact contract', async () => {
  let authStatusCalled = false;
  let loginBody = null;
  let logoutCalled = false;

  const mockFetch = async (url, opts = {}) => {
    if (url === '/api/auth/status') {
      authStatusCalled = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({ authenticated: true, loginMode: 'password', expiresAt: '2026-10-01T00:00:00Z' }),
      };
    }
    if (url === '/api/auth/login') {
      loginBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ authenticated: true, expiresAt: '2026-10-01T00:00:00Z' }),
      };
    }
    if (url === '/api/auth/logout') {
      logoutCalled = true;
      return {
        ok: true,
        status: 200,
        json: async () => ({ authenticated: false }),
      };
    }
    throw new Error(`Unexpected url: ${url}`);
  };

  const status = await fetchAuthStatus(mockFetch);
  assert.equal(status.authenticated, true);
  assert.equal(authStatusCalled, true);

  const loginRes = await loginWithPassword(mockFetch, 'secret123');
  assert.equal(loginRes.authenticated, true);
  assert.deepEqual(loginBody, { password: 'secret123' });

  const logoutRes = await logout(mockFetch);
  assert.equal(logoutRes.authenticated, false);
  assert.equal(logoutCalled, true);
});

test('fetchStats requests period and preserves scope and accounts stats', async () => {
  let requestedUrl = '';
  const mockFetch = async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        period: '7d',
        scope: 'all-router-traffic',
        totals: { requests: 100, inputTokens: 5000, outputTokens: 2000, cachedTokens: 1000, totalTokens: 7000, estimatedCost: 1.25 },
        accounts: [],
        chart: [{ label: 'Day 1', tokens: 1000, estimatedCost: 0.2 }],
        chartStatus: 'ok',
        receivedAt: new Date().toISOString(),
      }),
    };
  };

  const stats = await fetchStats(mockFetch, '7d');
  assert.equal(requestedUrl, '/api/stats?period=7d');
  assert.equal(stats.scope, 'all-router-traffic');
  assert.equal(stats.totals.requests, 100);
});
