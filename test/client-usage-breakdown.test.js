import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateUsageByProvider } from '../lib/client/selectors.js';

test('aggregateUsageByProvider correctly computes provider distribution and conserves total tokens', () => {
  const stats = {
    totals: {
      totalTokens: 100000,
      requests: 200,
      estimatedCost: 15.5,
    },
    accounts: [
      {
        connectionId: 'c1',
        totalTokens: 60000,
        requests: 120,
        estimatedCost: 9.3,
      },
      {
        connectionId: 'c2',
        totalTokens: 30000,
        requests: 60,
        estimatedCost: 4.65,
      },
      {
        connectionId: 'c3',
        totalTokens: 10000,
        requests: 20,
        estimatedCost: 1.55,
      },
    ],
  };

  const connections = [
    { id: 'c1', provider: 'antigravity', label: 'user-antigravity@test.com' },
    { id: 'c2', provider: 'codex', label: 'user-codex@test.com' },
    { id: 'c3', provider: null, label: 'user-unassigned@test.com' },
  ];

  const result = aggregateUsageByProvider(stats, connections);

  assert.equal(result.status, 'ok');
  assert.equal(result.available, true);
  assert.equal(result.providers.length, 3);

  const antigravity = result.providers.find((p) => p.provider === 'antigravity');
  const codex = result.providers.find((p) => p.provider === 'codex');
  const unassigned = result.providers.find((p) => p.provider === 'unassigned');

  assert.ok(antigravity);
  assert.ok(codex);
  assert.ok(unassigned);

  assert.equal(antigravity.tokens, 60000);
  assert.equal(antigravity.tokenPct, 60);

  assert.equal(codex.tokens, 30000);
  assert.equal(codex.tokenPct, 30);

  assert.equal(unassigned.tokens, 10000);
  assert.equal(unassigned.tokenPct, 10);

  const sumTokens = result.providers.reduce((sum, p) => sum + p.tokens, 0);
  assert.equal(sumTokens, stats.totals.totalTokens);

  assert.equal(result.accounts.length, 3);
  assert.equal(result.accounts[0].tokenPct, 60);
});

test('aggregateUsageByProvider handles empty accounts gracefully with unavailable status', () => {
  const stats = {
    totals: {
      totalTokens: 50000,
      requests: 50,
      estimatedCost: 5.0,
    },
    accounts: [],
  };

  const result = aggregateUsageByProvider(stats, []);

  assert.equal(result.status, 'unavailable');
  assert.equal(result.available, false);
  assert.match(result.notice, /unavailable/i);
  assert.deepEqual(result.providers, []);
  assert.deepEqual(result.accounts, []);
  assert.equal(result.totals.totalTokens, 50000);
});
