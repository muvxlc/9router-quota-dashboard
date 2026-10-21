import test from 'node:test';
import assert from 'node:assert/strict';

import { getAccountsQuotaAverages } from '../lib/client/selectors.js';

const account = (windows, status = 'ok') => ({ quota: { status, windows } });

const windowByKey = (result, key) => result.windows.find((w) => w.key === key);

test('(a) averages each account worst window and per-window values', () => {
  const result = getAccountsQuotaAverages([
    account([{ key: 'session', label: '5-Hour', remainingPercent: 50 }, { key: 'weekly', label: 'Weekly', remainingPercent: 10 }]),
    account([{ key: 'session', label: '5-Hour', remainingPercent: 30 }, { key: 'weekly', label: 'Weekly', remainingPercent: null }]),
  ]);

  assert.equal(result.overall.average, 20);
  assert.equal(result.overall.count, 2);
  assert.equal(result.overall.total, 2);

  const session = windowByKey(result, 'session');
  assert.equal(session.label, '5-Hour');
  assert.equal(session.average, 40);
  assert.equal(session.count, 2);
  assert.equal(session.total, 2);
  assert.equal(session.unlimitedCount, 0);

  const weekly = windowByKey(result, 'weekly');
  assert.equal(weekly.label, 'Weekly');
  assert.equal(weekly.average, 10);
  assert.equal(weekly.count, 1);
  assert.equal(weekly.total, 2);
});

test('(b) unlimited windows are excluded from the mean and counted separately', () => {
  const result = getAccountsQuotaAverages([
    account([{ key: 'session', remainingPercent: 30 }, { key: 'weekly', unlimited: true }]),
    account([{ key: 'session', remainingPercent: 30 }, { key: 'weekly', unlimited: true }]),
  ]);

  assert.equal(result.overall.average, 30);
  assert.equal(result.overall.count, 2);
  const weekly = windowByKey(result, 'weekly');
  assert.equal(weekly.average, null);
  assert.notEqual(weekly.average, 100);
  assert.equal(weekly.count, 0);
  assert.equal(weekly.unlimitedCount, 2);
});

test('(c) null, NaN, Infinity and numeric strings contribute nothing', () => {
  const result = getAccountsQuotaAverages([
    account([
      { key: 'session', remainingPercent: null },
      { key: 'weekly', remainingPercent: NaN },
      { key: 'daily', remainingPercent: Infinity },
      { key: 'monthly', remainingPercent: '55' },
    ]),
  ]);

  assert.deepEqual(result.overall, { average: null, count: 0, total: 1 });
  for (const win of result.windows) {
    assert.equal(win.average, null);
    assert.equal(win.count, 0);
  }
  assert.equal(JSON.stringify(result).includes('NaN'), false);
});

test('(d) empty input yields the documented empty shape', () => {
  assert.deepEqual(getAccountsQuotaAverages([]), {
    overall: { average: null, count: 0, total: 0 },
    windows: [],
  });
});

test('(e) 5h merges into the session bucket', () => {
  const result = getAccountsQuotaAverages([
    account([{ key: '5h', remainingPercent: 40 }, { key: 'session', remainingPercent: 20 }]),
  ]);

  assert.equal(result.windows.filter((w) => w.key === 'session').length, 1);
  assert.equal(windowByKey(result, 'session').average, 20);
  assert.equal(windowByKey(result, 'session').label, '5-Hour');
  assert.equal(windowByKey(result, '5h'), undefined);
});

test('(f) overall average is window-order independent', () => {
  const reversed = getAccountsQuotaAverages([account([{ key: 'session', remainingPercent: NaN }, { key: 'weekly', remainingPercent: 50 }])]);
  const forward = getAccountsQuotaAverages([account([{ key: 'session', remainingPercent: 50 }, { key: 'weekly', remainingPercent: NaN }])]);

  assert.equal(reversed.overall.average, 50);
  assert.equal(forward.overall.average, 50);
  assert.deepEqual(reversed.overall, forward.overall);
  assert.deepEqual(reversed.windows.map((w) => w.key).sort(), forward.windows.map((w) => w.key).sort());
});

test('(g) unavailable accounts are excluded from overall and windows', () => {
  const result = getAccountsQuotaAverages([
    account([{ key: 'session', remainingPercent: 50 }]),
    account([{ key: 'session', remainingPercent: 10 }], 'unavailable'),
    { quota: null },
    { id: 'no-quota' },
  ]);

  assert.equal(result.overall.total, 4);
  assert.equal(result.overall.count, 1);
  assert.equal(result.overall.average, 50);
  assert.equal(windowByKey(result, 'session').total, 1);
});

test('(h) all-unlimited accounts yield null average with unlimitedCount equal to account count', () => {
  const result = getAccountsQuotaAverages([
    account([{ key: 'session', unlimited: true }]),
    account([{ key: 'session', unlimited: true }]),
    account([{ key: 'session', unlimited: true }]),
  ]);

  assert.deepEqual(result.overall, { average: null, count: 0, total: 3 });
  const session = windowByKey(result, 'session');
  assert.equal(session.average, null);
  assert.equal(session.count, 0);
  assert.equal(session.unlimitedCount, 3);
  assert.equal(session.total, 3);
});

test('(i) duplicate windows under one key collapse to the worst value', () => {
  const result = getAccountsQuotaAverages([
    account([
      { key: 'session', remainingPercent: 80 },
      { key: 'session', remainingPercent: 25 },
      { key: 'session', remainingPercent: 60 },
      { key: 'weekly', remainingPercent: 90 },
    ]),
  ]);

  assert.equal(windowByKey(result, 'session').average, 25, 'duplicate key must keep the minimum');
  assert.equal(windowByKey(result, 'session').count, 1);
  assert.equal(result.overall.average, 25);
});

test('(j) averages round to one decimal place', () => {
  const result = getAccountsQuotaAverages([
    account([{ key: 'session', remainingPercent: 10 }]),
    account([{ key: 'session', remainingPercent: 11 }]),
    account([{ key: 'session', remainingPercent: 11 }]),
  ]);

  assert.equal(windowByKey(result, 'session').average, 10.7);
  assert.equal(result.overall.average, 10.7);
});
