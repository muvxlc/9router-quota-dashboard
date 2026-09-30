import test from 'node:test';
import assert from 'node:assert/strict';
import { isQuotaFresher, applyMonotonicQuota } from '../lib/client/useQuotaData.js';

test('isQuotaFresher correctly compares monotonic timestamps', () => {
  const current = { connectionId: 'c1', receivedAt: '2026-03-30T10:00:00.000Z' };
  const newer = { connectionId: 'c1', receivedAt: '2026-03-30T10:00:05.000Z' };
  const older = { connectionId: 'c1', receivedAt: '2026-03-30T09:59:59.000Z' };
  const same = { connectionId: 'c1', receivedAt: '2026-03-30T10:00:00.000Z' };

  assert.equal(isQuotaFresher(newer, current), true);
  assert.equal(isQuotaFresher(same, current), true);
  assert.equal(isQuotaFresher(older, current), false);
  assert.equal(isQuotaFresher(null, current), false);
  assert.equal(isQuotaFresher(newer, null), true);
  assert.equal(isQuotaFresher({ connectionId: 'c1' }, current), true);
});

test('applyMonotonicQuota drops older quota updates and preserves fresh ones', () => {
  const t1 = '2026-03-30T10:00:00.000Z';
  const t2 = '2026-03-30T10:00:10.000Z';
  const initialQuotas = {
    c1: { connectionId: 'c1', receivedAt: t2, status: 'available', windows: [{ remainingPercent: 80 }] },
  };

  const staleBatchQuota = {
    connectionId: 'c1',
    receivedAt: t1,
    status: 'available',
    windows: [{ remainingPercent: 40 }],
  };

  const result1 = applyMonotonicQuota(initialQuotas, staleBatchQuota);
  assert.equal(result1.c1.receivedAt, t2);
  assert.equal(result1.c1.windows[0].remainingPercent, 80);

  const freshManualQuota = {
    connectionId: 'c1',
    receivedAt: '2026-03-30T10:00:15.000Z',
    status: 'available',
    windows: [{ remainingPercent: 95 }],
  };

  const result2 = applyMonotonicQuota(initialQuotas, freshManualQuota);
  assert.equal(result2.c1.receivedAt, '2026-03-30T10:00:15.000Z');
  assert.equal(result2.c1.windows[0].remainingPercent, 95);
});

test('applyMonotonicQuota handles new accounts without existing state', () => {
  const initialQuotas = {};
  const newQuota = {
    connectionId: 'c2',
    receivedAt: '2026-03-30T10:00:00.000Z',
    status: 'available',
    windows: [],
  };

  const result = applyMonotonicQuota(initialQuotas, newQuota);
  assert.equal(result.c2.connectionId, 'c2');
});
