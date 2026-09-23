import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeQuotaData,
  normalizeConnection,
  normalizeStats,
} from '../lib/server/normalize.js';
import {
  createUpstreamClient,
} from '../lib/server/upstream.js';

// --- QUOTA NORMALIZATION TESTS ---
test('normalizeQuotaData handles Codex quotas correctly', () => {
  const rawCodex = {
    plan: 'plus',
    quotas: {
      session: { used: 20, total: 100, remaining: 80, resetAt: '2026-10-01T12:00:00Z' },
      weekly: { used: 50, total: 100, remaining: 50, resetAt: '2026-10-07T00:00:00Z' },
      review_session: { used: 0, total: 100, remaining: 100, resetAt: null },
      spark_session: { used: 10, total: 100, remaining: 90, resetAt: '2026-10-01T15:00:00Z' },
    },
  };

  const normalized = normalizeQuotaData('c-codex', 'codex', rawCodex);
  assert.equal(normalized.connectionId, 'c-codex');
  assert.equal(normalized.provider, 'codex');
  assert.equal(normalized.plan, 'plus');
  assert.equal(normalized.status, 'ok');
  assert.equal(normalized.reason, null);
  assert.ok(normalized.receivedAt);
  assert.ok(normalized.nextRefreshAt);

  // Check 5h window
  const sessionWin = normalized.windows.find((w) => w.key === 'session');
  assert.ok(sessionWin);
  assert.equal(sessionWin.label, '5h');
  assert.equal(sessionWin.remainingPercent, 80);
  assert.equal(sessionWin.used, 20);
  assert.equal(sessionWin.total, 100);
  assert.equal(sessionWin.unit, '%');
  assert.equal(sessionWin.resetAt, new Date('2026-10-01T12:00:00Z').toISOString());

  // Check Spark
  const sparkWin = normalized.windows.find((w) => w.key === 'spark_session');
  assert.ok(sparkWin);
  assert.equal(sparkWin.label, 'Spark (5h)');
  assert.equal(sparkWin.remainingPercent, 90);
});

test('normalizeQuotaData handles Antigravity grouping, min %, and 1000 synthetic scale', () => {
  const rawAntigravity = {
    quotas: {
      'gemini-2.5-flash': { remainingPercentage: 90, resetAt: '2026-10-01T10:00:00Z', used: 100, total: 1000 },
      'gemini-2.5-pro': { remainingPercentage: 65, resetAt: '2026-10-01T14:00:00Z', used: 350, total: 1000 },
      'claude-3-7-sonnet': { remainingPercentage: 40, resetAt: '2026-10-01T18:00:00Z', used: 600, total: 1000 },
      'gemini_weekly': { remainingPercentage: 80, resetAt: '2026-10-07T00:00:00Z', used: 200, total: 1000 },
      'image-generation': { remainingPercentage: 100, resetAt: null, used: 0, total: 100 },
    },
  };

  const normalized = normalizeQuotaData('c-anti', 'antigravity', rawAntigravity);
  assert.equal(normalized.status, 'ok');

  // Gemini grouped: min % is 65 from gemini-2.5-pro, resetAt from same record
  const geminiWin = normalized.windows.find((w) => w.key === 'gemini');
  assert.ok(geminiWin);
  assert.equal(geminiWin.label, 'Gemini (Flash / Pro)');
  assert.equal(geminiWin.remainingPercent, 65);
  assert.equal(geminiWin.resetAt, new Date('2026-10-01T14:00:00Z').toISOString());
  // Synthetic 1000 scale converted to percent
  assert.equal(geminiWin.total, 100);
  assert.equal(geminiWin.used, 35);
  assert.equal(geminiWin.unit, '%');

  // Claude grouped: 40%
  const claudeWin = normalized.windows.find((w) => w.key === 'claude');
  assert.ok(claudeWin);
  assert.equal(claudeWin.label, 'Claude (Sonnet / Opus)');
  assert.equal(claudeWin.remainingPercent, 40);

  // Weekly preserved
  const weeklyWin = normalized.windows.find((w) => w.key === 'gemini_weekly');
  assert.ok(weeklyWin);
  assert.equal(weeklyWin.remainingPercent, 80);

  // Cadence: Antigravity default 60s
  const nextRefresh = new Date(normalized.nextRefreshAt).getTime();
  const received = new Date(normalized.receivedAt).getTime();
  assert.ok(nextRefresh - received >= 59000 && nextRefresh - received <= 61000);
});

test('normalizeQuotaData respects Claude cadence 600s', () => {
  const rawClaude = {
    quotas: {
      session: { used: 10, total: 100, remainingPercentage: 90, resetAt: null },
    },
  };
  const normalized = normalizeQuotaData('c-claude', 'claude', rawClaude);
  const nextRefresh = new Date(normalized.nextRefreshAt).getTime();
  const received = new Date(normalized.receivedAt).getTime();
  assert.ok(nextRefresh - received >= 599000 && nextRefresh - received <= 601000);
});

test('normalizeQuotaData handles null v zero, unknown as null, and provider errors', () => {
  // Empty data -> NO_QUOTA_DATA
  const empty = normalizeQuotaData('c-empty', 'custom', null);
  assert.equal(empty.status, 'unavailable');
  assert.equal(empty.reason, 'NO_QUOTA_DATA');
  assert.deepEqual(empty.windows, []);

  // Auth expired message -> PROVIDER_AUTH_REQUIRED
  const authErr = normalizeQuotaData('c-err', 'codex', { message: 'authentication token expired' });
  assert.equal(authErr.status, 'unavailable');
  assert.equal(authErr.reason, 'PROVIDER_AUTH_REQUIRED');

  // Generic provider with unknown remaining stays null (not fabricated)
  const generic = normalizeQuotaData('c-gen', 'unknown_provider', {
    quotas: {
      pool: { used: 0, total: 0, unlimited: true, recurring: false },
    },
  });
  assert.equal(generic.status, 'ok');
  assert.equal(generic.windows[0].remainingPercent, null);
  assert.equal(generic.windows[0].unlimited, true);
  assert.equal(generic.windows[0].recurring, false);
});

// --- STATS NORMALIZATION TESTS ---
test('normalizeStats aggregates byAccount correctly without double counting cached tokens', () => {
  const rawStats = {
    period: '7d',
    totalRequests: 10,
    totalPromptTokens: 1000,
    totalCompletionTokens: 500,
    totalCachedTokens: 200,
    totalCost: 0.05,
    byAccount: {
      'acc-1-key': {
        requests: 6,
        promptTokens: 600,
        completionTokens: 300,
        cachedTokens: 100,
        cost: 0.03,
        connectionId: 'conn-1',
      },
      'acc-2-key': {
        requests: 4,
        promptTokens: 400,
        completionTokens: 200,
        cachedTokens: 100,
        cost: 0.02,
        connectionId: 'conn-2',
      },
    },
  };

  const rawChart = [
    { label: 'Day 1', tokens: 800, cost: 0.02 },
    { label: 'Day 2', tokens: 700, cost: 0.03 },
  ];

  const stats = normalizeStats('7d', rawStats, rawChart);
  assert.equal(stats.period, '7d');
  assert.equal(stats.scope, 'all-router-traffic');
  assert.equal(stats.totals.requests, 10);
  assert.equal(stats.totals.inputTokens, 1000);
  assert.equal(stats.totals.outputTokens, 500);
  assert.equal(stats.totals.cachedTokens, 200);
  // totalTokens = input + output (not input + output + cached)
  assert.equal(stats.totals.totalTokens, 1500);
  assert.equal(stats.totals.estimatedCost, 0.05);

  // Accounts aggregation
  assert.equal(stats.accounts.length, 2);
  const acc1 = stats.accounts.find((a) => a.connectionId === 'conn-1');
  assert.ok(acc1);
  assert.equal(acc1.requests, 6);
  assert.equal(acc1.totalTokens, 900); // 600 + 300
  assert.equal(acc1.cachedTokens, 100);

  // Chart
  assert.equal(stats.chartStatus, 'ok');
  assert.equal(stats.chart.length, 2);
  assert.equal(stats.chart[0].estimatedCost, 0.02);
});

// --- UPSTREAM CLIENT ALLOWLISTING & REDIRECT TESTS ---
test('createUpstreamClient enforces allowlist, blocks arbitrary URLs, and disallows redirects', async () => {
  const allowedPaths = new Set([
    '/api/auth/status',
    '/api/auth/login',
    '/api/providers/client',
    '/api/usage',
    '/api/usage/stats',
    '/api/usage/chart',
  ]);

  const client = createUpstreamClient({
    baseUrl: 'http://127.0.0.1:20128',
    allowedPrefixes: ['/api/auth/', '/api/providers/client', '/api/usage'],
    fetchFn: async (url, opts) => {
      if (opts.redirect === 'manual') {
        // Mock standard response
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true }),
        };
      }
      throw new Error('Redirect option must be manual');
    },
  });

  // Allowed path
  const okRes = await client.request('/api/auth/status', { method: 'GET' });
  assert.equal(okRes.ok, true);

  // Disallowed path
  await assert.rejects(
    async () => client.request('/api/keys', { method: 'GET' }),
    (err) => err.code === 'INVALID_REQUEST'
  );

  // Attempt SSRF / external host
  await assert.rejects(
    async () => client.request('http://evil.com/api/auth/status', { method: 'GET' }),
    (err) => err.code === 'INVALID_REQUEST'
  );
});
