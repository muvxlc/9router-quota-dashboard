import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDepletionVelocity,
  aggregateUsageByProvider,
} from '../lib/client/selectors.js';

test('calculateDepletionVelocity flags RUNOUT RISK when quota is low and reset is distant', () => {
  const now = 1774864800000;
  const criticalQuota = {
    windows: [
      {
        remainingPercent: 10,
        resetAt: new Date(now + 2 * 3600 * 1000).toISOString(),
      },
    ],
  };

  const velCritical = calculateDepletionVelocity(criticalQuota, now);
  assert.ok(velCritical);
  assert.equal(velCritical.level, 'critical');
  assert.equal(velCritical.label, 'RUNOUT RISK');
  assert.equal(velCritical.badgeClass, 'pp-tag-depleted');

  const warningQuota = {
    windows: [
      {
        remainingPercent: 25,
        resetAt: new Date(now + 4 * 3600 * 1000).toISOString(),
      },
    ],
  };

  const velWarning = calculateDepletionVelocity(warningQuota, now);
  assert.ok(velWarning);
  assert.equal(velWarning.level, 'warning');
  assert.equal(velWarning.label, 'HIGH VELOCITY');
  assert.equal(velWarning.badgeClass, 'pp-tag-low');

  const safeQuota = {
    windows: [
      {
        remainingPercent: 80,
        resetAt: new Date(now + 3600 * 1000).toISOString(),
      },
    ],
  };
  assert.equal(calculateDepletionVelocity(safeQuota, now), null);
});

test('aggregateUsageByProvider detects usage spikes for outlier accounts', () => {
  const stats = {
    totals: { totalTokens: 100000, requests: 100, estimatedCost: 10 },
    accounts: [
      { connectionId: 'c1', totalTokens: 80000, requests: 80, estimatedCost: 8 },
      { connectionId: 'c2', totalTokens: 10000, requests: 10, estimatedCost: 1 },
      { connectionId: 'c3', totalTokens: 10000, requests: 10, estimatedCost: 1 },
    ],
  };

  const connections = [
    { id: 'c1', provider: 'codex', label: 'power-user@test.com' },
    { id: 'c2', provider: 'codex', label: 'normal-user1@test.com' },
    { id: 'c3', provider: 'codex', label: 'normal-user2@test.com' },
  ];

  const result = aggregateUsageByProvider(stats, connections);
  assert.equal(result.status, 'ok');
  assert.equal(result.accounts.length, 3);

  const spikeAccount = result.accounts.find((a) => a.connectionId === 'c1');
  const normalAccount = result.accounts.find((a) => a.connectionId === 'c2');

  assert.ok(spikeAccount);
  assert.equal(spikeAccount.isSpike, true);
  assert.match(spikeAccount.spikeLabel, /avg/);

  assert.ok(normalAccount);
  assert.equal(normalAccount.isSpike, false);
});
