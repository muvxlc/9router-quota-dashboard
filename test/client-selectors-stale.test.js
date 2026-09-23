import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveAccountStatus } from '../lib/client/selectors.js';

test('deriveAccountStatus handles stale markers from useQuotaData API', () => {
  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'stale',
    windows: [{ remainingPercent: 80, unlimited: false }],
  }), { status: 'stale', label: 'Stale', reason: 'STALE_DATA' });

  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    stale: true,
    windows: [{ remainingPercent: 80, unlimited: false }],
  }), { status: 'stale', label: 'Stale', reason: 'STALE_DATA' });

  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    isStale: true,
    windows: [{ remainingPercent: 80, unlimited: false }],
  }), { status: 'stale', label: 'Stale', reason: 'STALE_DATA' });

  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    cached: true,
    nextRefreshAt: new Date(Date.now() - 5000).toISOString(),
    windows: [{ remainingPercent: 80, unlimited: false }],
  }), { status: 'stale', label: 'Stale', reason: 'STALE_DATA' });
});

test('deriveAccountStatus classifies all-null, mixed unknown, and unlimited correctly', () => {
  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    windows: [
      { key: '5h', remainingPercent: null, unlimited: false },
      { key: 'weekly', remainingPercent: null, unlimited: false },
    ],
  }), { status: 'no-data', label: 'No Data', reason: 'NO_QUOTA_DATA' });

  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    windows: [
      { key: '5h', remainingPercent: 80, unlimited: false },
      { key: 'weekly', remainingPercent: null, unlimited: false },
    ],
  }), { status: 'partial', label: 'Partial', reason: 'PARTIAL_DATA' });

  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    windows: [
      { key: '5h', remainingPercent: 0, unlimited: false },
      { key: 'weekly', remainingPercent: null, unlimited: false },
    ],
  }), { status: 'exhausted', label: 'Exhausted', reason: null });

  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    windows: [
      { key: 'unlimited_model', unlimited: true },
    ],
  }), { status: 'healthy', label: 'Available', reason: null });

  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    windows: [
      { key: 'unlimited_model', unlimited: true },
      { key: '5h', remainingPercent: 85, unlimited: false },
    ],
  }), { status: 'healthy', label: 'Available', reason: null });
});
