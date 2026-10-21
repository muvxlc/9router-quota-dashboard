import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_SUMMARY,
  mergeSummary,
  deriveSummaryFailures,
  deriveSummaryCards,
  isSummaryStale,
} from '../lib/client/maxplusSummary.js';

const NOW = Date.parse('2026-10-20T12:00:00.000Z');
const T1 = new Date(NOW).toISOString();
const T2 = new Date(NOW + 60000).toISOString();

const byKey = (cards) => Object.fromEntries(cards.map((c) => [c.key, c]));

test('EMPTY_SUMMARY derives three neutral dash cards', () => {
  const cards = deriveSummaryCards(EMPTY_SUMMARY, { nowMs: NOW });
  assert.deepEqual(cards.map((c) => c.key), ['period', 'totalCost', 'creditUsd']);
  for (const card of cards) {
    assert.equal(card.value, '—');
    assert.equal(card.tone, 'neutral');
  }
});

test('totalCost formats through formatCost and keeps a real zero', () => {
  const twelve = byKey(deriveSummaryCards({ totalCost: 12.5 }, { nowMs: NOW }));
  assert.equal(twelve.totalCost.value, '$12.50');
  const zero = byKey(deriveSummaryCards({ totalCost: 0 }, { nowMs: NOW }));
  assert.equal(zero.totalCost.value, '$0.00');
  const missing = byKey(deriveSummaryCards({ totalCost: null }, { nowMs: NOW }));
  assert.equal(missing.totalCost.value, '—');
});

test('period is echoed verbatim, never mapped to a date range', () => {
  const cards = byKey(deriveSummaryCards({ period: '30d' }, { nowMs: NOW }));
  assert.equal(cards.period.value, '30d');
  assert.equal(cards.period.tone, 'neutral');
});

test('credit tone thresholds: critical <= 0, warn <= 5, ok above', () => {
  const tone = (creditUsd) => byKey(deriveSummaryCards({ creditUsd }, { nowMs: NOW })).creditUsd.tone;
  assert.equal(tone(-1), 'critical');
  assert.equal(tone(0), 'critical');
  assert.equal(tone(3), 'warn');
  assert.equal(tone(50), 'ok');
});

test('mergeSummary keeps a failed group untouched, including its timestamp', () => {
  const prev = { creditUsd: 5, creditReceivedAt: T1 };
  const merged = mergeSummary(prev, { creditUsd: null, creditReceivedAt: null });
  assert.equal(merged.creditUsd, 5);
  assert.equal(merged.creditReceivedAt, T1);
});

test('mergeSummary replaces a successful unit wholesale, no cross-window leak', () => {
  const merged = mergeSummary(
    { period: '7d', totalCost: 12.34, usageReceivedAt: T1 },
    { period: '30d', totalCost: null, usageReceivedAt: T2 },
  );
  assert.equal(merged.period, '30d');
  assert.equal(merged.totalCost, null);
  assert.equal(merged.usageReceivedAt, T2);
});

test('window change regression: old cost never survives a new window', () => {
  let summary = mergeSummary(EMPTY_SUMMARY, { period: '7d', totalCost: 12.34, usageReceivedAt: T1 });
  summary = mergeSummary(summary, { period: '30d', totalCost: null, usageReceivedAt: T2 });
  assert.equal(summary.period, '30d');
  assert.equal(summary.totalCost, null);
  assert.equal(summary.usageReceivedAt, T2);
  const cards = byKey(deriveSummaryCards(summary, { nowMs: NOW }));
  assert.equal(cards.totalCost.value, '—');
});

test('failed card shows retained value with failed hint immediately, stale after 150s', () => {
  const summary = { creditUsd: 5, creditReceivedAt: T1 };
  const fresh = byKey(deriveSummaryCards(summary, { nowMs: NOW, failedKeys: ['creditUsd'] }));
  assert.equal(fresh.creditUsd.value, '$5.00');
  assert.equal(fresh.creditUsd.hint, 'Last known - refresh failed');
  assert.equal(fresh.creditUsd.tone, 'warn');

  const late = byKey(deriveSummaryCards(summary, { nowMs: NOW + 150001, failedKeys: ['creditUsd'] }));
  assert.equal(late.creditUsd.hint, 'Stale');
  assert.equal(late.creditUsd.tone, 'warn');
});

test('critical wins over the failed hint when retained credit is <= 0', () => {
  const cards = byKey(deriveSummaryCards({ creditUsd: 0, creditReceivedAt: T1 }, { nowMs: NOW, failedKeys: ['creditUsd'] }));
  assert.equal(cards.creditUsd.tone, 'critical');
  assert.equal(cards.creditUsd.value, '$0.00');
});

test('partial failure regression: only the credit card is labelled failed', () => {
  const first = { period: '7d', totalCost: 12.34, creditUsd: 5.5, usageReceivedAt: T1, creditReceivedAt: T1 };
  const second = { period: '7d', totalCost: 12.34, creditUsd: null, usageReceivedAt: T2, creditReceivedAt: null };

  const failures = deriveSummaryFailures(second);
  assert.deepEqual(failures, { usageFailed: false, creditFailed: true, partial: true });

  const merged = mergeSummary(first, second);
  assert.equal(merged.creditUsd, 5.5);
  assert.equal(merged.creditReceivedAt, T1);
  assert.equal(merged.totalCost, 12.34);

  const cards = byKey(deriveSummaryCards(merged, { nowMs: NOW, failedKeys: ['creditUsd'] }));
  assert.equal(cards.creditUsd.value, '$5.50');
  assert.equal(cards.creditUsd.hint, 'Last known - refresh failed');
  assert.equal(cards.totalCost.hint, 'Cost in window');
  assert.equal(cards.totalCost.tone, 'neutral');
});

test('deriveSummaryFailures reports full failure and full success', () => {
  assert.deepEqual(deriveSummaryFailures({ usageReceivedAt: null, creditReceivedAt: null }), {
    usageFailed: true,
    creditFailed: true,
    partial: false,
  });
  assert.deepEqual(deriveSummaryFailures({ usageReceivedAt: T1, creditReceivedAt: T1 }), {
    usageFailed: false,
    creditFailed: false,
    partial: false,
  });
});

test('isSummaryStale flips only past 150s', () => {
  const summary = { usageReceivedAt: T1, creditReceivedAt: T1 };
  assert.equal(isSummaryStale(summary, NOW + 149999), false);
  assert.equal(isSummaryStale(summary, NOW + 150001), true);
  assert.equal(isSummaryStale(EMPTY_SUMMARY, NOW + 999999), false);
});

test('unconfigured forces neutral dash with Not configured hint', () => {
  const cards = deriveSummaryCards({ period: '7d', totalCost: 12.34, creditUsd: 50 }, { nowMs: NOW, unconfigured: true });
  for (const card of cards) {
    assert.equal(card.value, '—');
    assert.equal(card.hint, 'Not configured');
    assert.equal(card.tone, 'neutral');
  }
});

test('a failed fetch with nothing retained is labelled Refresh failed, not Not configured', () => {
  const failedKeys = ['period', 'totalCost', 'creditUsd'];
  const cards = byKey(deriveSummaryCards(EMPTY_SUMMARY, { nowMs: NOW, failedKeys }));
  for (const key of failedKeys) {
    assert.equal(cards[key].value, '—', key);
    assert.equal(cards[key].hint, 'Refresh failed', key);
    assert.equal(cards[key].tone, 'warn', key);
  }
  // An empty summary with no failure is still an honest "no data" card.
  const idle = byKey(deriveSummaryCards(EMPTY_SUMMARY, { nowMs: NOW }));
  for (const key of failedKeys) {
    assert.equal(idle[key].hint, 'Not configured', key);
    assert.equal(idle[key].tone, 'neutral', key);
  }
});
