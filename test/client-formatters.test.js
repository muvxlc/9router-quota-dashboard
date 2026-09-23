import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPercent,
  formatUnits,
  formatResetRelative,
  formatTokens,
  formatCost,
  formatUsage,
  getLiveStatusMeta,
} from '../lib/client/formatters.js';

test('formatPercent distinguishes 0 from unknown and unlimited', () => {
  assert.equal(formatPercent(null, false), '—');
  assert.equal(formatPercent(undefined, false), '—');
  assert.equal(formatPercent(null, true), 'Unlimited');
  assert.equal(formatPercent(100, true), 'Unlimited');
  assert.equal(formatPercent(0, false), '0%');
  assert.equal(formatPercent(42.6, false), '43%');
  assert.equal(formatPercent(100, false), '100%');
});

test('formatUnits formats used, total, and honest units without fabrication', () => {
  assert.equal(formatUnits(null, null, null), '—');
  assert.equal(formatUnits(120, 500, 'requests'), '120 / 500 requests');
  assert.equal(formatUnits(0, 100, 'credits'), '0 / 100 credits');
  assert.equal(formatUnits(null, 1000, 'tokens'), '1,000 tokens limit');
  assert.equal(formatUnits(50, null, 'queries'), '50 queries used');
});

test('formatResetRelative formats relative reset time honestly', () => {
  assert.equal(formatResetRelative(null), '—');
  const now = Date.now();
  const in30Min = new Date(now + 30 * 60 * 1000).toISOString();
  const past = new Date(now - 60 * 1000).toISOString();
  assert.match(formatResetRelative(in30Min, now), /in\s+\d+m/);
  assert.equal(formatResetRelative(past, now), 'due to reset');
});

test('formatTokens and formatCost format pure numbers faithfully', () => {
  assert.equal(formatTokens(0), '0');
  assert.equal(formatTokens(null), '—');
  assert.equal(formatTokens(950), '950');
  assert.equal(formatTokens(15000), '15.0K');
  assert.equal(formatTokens(2400000), '2.40M');
  assert.equal(formatTokens(3100000000), '3.10B');

  assert.equal(formatCost(0), '$0.00');
  assert.equal(formatCost(null), '—');
  assert.equal(formatCost(14.852), '$14.85');
});

test('formatUsage formats honest compact percentages and preserves custom units', () => {
  assert.equal(formatUsage(32, 100, '%'), 'Used 32%');
  assert.equal(formatUsage(0, 100, '%'), 'Used 0%');
  assert.equal(formatUsage(null, 100, '%'), 'Limit 100%');
  assert.equal(formatUsage(null, null, '%'), '');
  assert.equal(formatUsage(120, 500, 'requests'), '120 / 500 requests');
  assert.equal(formatUsage(null, null, null), '');
});

test('getLiveStatusMeta maps status to exact text, pillClass, and pulse behavior', () => {
  const connecting = getLiveStatusMeta('connecting');
  assert.equal(connecting.text, 'CONNECTING');
  assert.equal(connecting.pillClass, 'connecting');
  assert.equal(connecting.pulse, false);

  const liveActive = getLiveStatusMeta('live', 2);
  assert.equal(liveActive.text, 'CONNECTED');
  assert.equal(liveActive.pillClass, 'connected');
  assert.equal(liveActive.pulse, true);

  const liveZero = getLiveStatusMeta('live', 0);
  assert.equal(liveZero.text, 'CONNECTED');
  assert.equal(liveZero.pillClass, 'connected');
  assert.equal(liveZero.pulse, false);

  const idle = getLiveStatusMeta('idle');
  assert.equal(idle.text, 'IDLE');
  assert.equal(idle.pillClass, 'idle');
  assert.equal(idle.pulse, false);

  const disconnected = getLiveStatusMeta('disconnected');
  assert.equal(disconnected.text, 'DISCONNECTED');
  assert.equal(disconnected.pillClass, 'disconnected');
  assert.equal(disconnected.pulse, false);

  const error = getLiveStatusMeta('error');
  assert.equal(error.text, 'UNAVAILABLE');
  assert.equal(error.pillClass, 'unavailable');
  assert.equal(error.pulse, false);

  const unknown = getLiveStatusMeta('unknown');
  assert.equal(unknown.text, 'UNAVAILABLE');
  assert.equal(unknown.pillClass, 'unavailable');
  assert.equal(unknown.pulse, false);
});
