import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeMaxplusSummary } from '../lib/server/maxplusSummary.js';

const NOW = '2026-10-20T00:00:00.000Z';

function keys(result) {
  return Object.keys(result).sort();
}

test('full payloads produce the five documented keys', () => {
  const result = sanitizeMaxplusSummary({
    usage: { period: '7d', totals: { total_cost: 12.34 } },
    me: { credit_usd: 5.5 },
    now: NOW,
  });
  assert.deepEqual(result, {
    period: '7d',
    totalCost: 12.34,
    creditUsd: 5.5,
    usageReceivedAt: NOW,
    creditReceivedAt: NOW,
  });
  assert.deepEqual(keys(result), [
    'creditReceivedAt',
    'creditUsd',
    'period',
    'totalCost',
    'usageReceivedAt',
  ]);
  assert.equal(Object.keys(result).length, 5);
});

test('period accepts only the closed grammar and echoes it verbatim', () => {
  for (const period of ['7d', 'all', '30d', '1d', '2h', '3w', '4m', '5y', '9999d']) {
    const result = sanitizeMaxplusSummary({ usage: { period }, now: NOW });
    assert.equal(result.period, period);
    assert.equal(Object.keys(result).length, 5);
  }
});

test('period rejects junk, credentials, and non-strings', () => {
  const bad = [
    'x'.repeat(33),
    'ccsk-1234567890',
    'Bearer ccsk-secret',
    'sk-live-abc',
    '<script>',
    ' ',
    '',
    7,
    null,
    undefined,
    {},
    ['7d'],
  ];
  for (const period of bad) {
    const result = sanitizeMaxplusSummary({ usage: { period }, now: NOW });
    assert.equal(result.period, null, `period=${JSON.stringify(period)}`);
    assert.equal(Object.keys(result).length, 5);
  }
});

test('totalCost keeps a real zero and returns null when missing', () => {
  assert.equal(
    sanitizeMaxplusSummary({ usage: { totals: { total_cost: 0 } }, now: NOW }).totalCost,
    0,
  );
  assert.equal(sanitizeMaxplusSummary({ usage: { period: '7d' }, now: NOW }).totalCost, null);
  assert.equal(sanitizeMaxplusSummary({ usage: {}, now: NOW }).totalCost, null);
});

test('creditUsd preserves negatives and parses numeric strings', () => {
  assert.equal(sanitizeMaxplusSummary({ me: { credit_usd: -3 }, now: NOW }).creditUsd, -3);
  assert.equal(sanitizeMaxplusSummary({ me: { credit_usd: '12.34' }, now: NOW }).creditUsd, 12.34);
});

test('non-numeric values never coerce', () => {
  const bad = ['', NaN, {}, null, undefined, [], true, 'abc'];
  for (const value of bad) {
    const result = sanitizeMaxplusSummary({
      usage: { totals: { total_cost: value } },
      me: { credit_usd: value },
      now: NOW,
    });
    assert.equal(result.totalCost, null, `total_cost=${String(value)}`);
    assert.equal(result.creditUsd, null, `credit_usd=${String(value)}`);
    assert.equal(Object.keys(result).length, 5);
  }
});

test('unknown payload fields never leak through', () => {
  const result = sanitizeMaxplusSummary({
    usage: {
      period: '7d',
      range: { start: '2026-10-13' },
      request_count: 42,
      total_tokens: 999,
      totals: { total_cost: 1, total_tokens: 999 },
    },
    me: {
      credit_usd: 5.5,
      user: { email: 'secret@example.com' },
      key: { key_preview: 'sk-live-abc' },
    },
    now: NOW,
  });
  const serialized = JSON.stringify(result);
  for (const secret of ['secret@example.com', 'sk-live-abc', 'request_count', 'total_tokens', '2026-10-13']) {
    assert.equal(serialized.includes(secret), false, secret);
  }
  assert.deepEqual(keys(result), [
    'creditReceivedAt',
    'creditUsd',
    'period',
    'totalCost',
    'usageReceivedAt',
  ]);
});

test('null usage clears usage fields but keeps credit fields', () => {
  const result = sanitizeMaxplusSummary({ usage: null, me: { credit_usd: 5.5 }, now: NOW });
  assert.equal(result.period, null);
  assert.equal(result.totalCost, null);
  assert.equal(result.usageReceivedAt, null);
  assert.equal(result.creditUsd, 5.5);
  assert.equal(result.creditReceivedAt, NOW);
  assert.equal(Object.keys(result).length, 5);
});

test('empty input still returns exactly five keys', () => {
  for (const input of [undefined, {}, { now: NOW }]) {
    const result = sanitizeMaxplusSummary(input);
    assert.equal(Object.keys(result).length, 5);
    assert.equal(result.period, null);
    assert.equal(result.totalCost, null);
    assert.equal(result.creditUsd, null);
    assert.equal(result.usageReceivedAt, null);
    assert.equal(result.creditReceivedAt, null);
  }
});
