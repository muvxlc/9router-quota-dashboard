import test from 'node:test';
import assert from 'node:assert/strict';
import { computeResetCountdown, formatResetRelative } from '../lib/client/formatters.js';

test('computeResetCountdown formats future countdowns accurately without negative values', () => {
  const now = 1774864800000;

  const in45s = new Date(now + 45 * 1000).toISOString();
  const res45s = computeResetCountdown(in45s, now);
  assert.equal(res45s.text, 'in 45s');
  assert.equal(res45s.status, 'active');
  assert.equal(res45s.diffMs, 45000);

  const in12m = new Date(now + 12 * 60 * 1000).toISOString();
  const res12m = computeResetCountdown(in12m, now);
  assert.equal(res12m.text, 'in 12m');
  assert.equal(res12m.status, 'active');

  const in2h15m = new Date(now + (2 * 60 + 15) * 60 * 1000).toISOString();
  const res2h15m = computeResetCountdown(in2h15m, now);
  assert.equal(res2h15m.text, 'in 2h 15m');
  assert.equal(res2h15m.status, 'active');

  const in3d4h = new Date(now + (3 * 24 + 4) * 3600 * 1000).toISOString();
  const res3d4h = computeResetCountdown(in3d4h, now);
  assert.equal(res3d4h.text, 'in 3d 4h');
  assert.equal(res3d4h.status, 'active');
});

test('computeResetCountdown transitions to due to reset when target epoch arrives or passes', () => {
  const now = 1774864800000;

  const exact = new Date(now).toISOString();
  const resExact = computeResetCountdown(exact, now);
  assert.equal(resExact.text, 'due to reset');
  assert.equal(resExact.status, 'due');
  assert.equal(resExact.diffMs, 0);

  const past = new Date(now - 10000).toISOString();
  const resPast = computeResetCountdown(past, now);
  assert.equal(resPast.text, 'due to reset');
  assert.equal(resPast.status, 'due');
  assert.equal(resPast.diffMs, 0);
});

test('computeResetCountdown handles unlimited, null, and invalid dates gracefully', () => {
  const now = 1774864800000;

  assert.deepEqual(computeResetCountdown(null, now), { text: '—', diffMs: 0, status: 'unlimited' });
  assert.deepEqual(computeResetCountdown(undefined, now), { text: '—', diffMs: 0, status: 'unlimited' });
  assert.deepEqual(computeResetCountdown(new Date(now + 60000).toISOString(), now, { unlimited: true }), { text: '—', diffMs: 0, status: 'unlimited' });
  assert.deepEqual(computeResetCountdown('invalid-date', now), { text: '—', diffMs: 0, status: 'invalid' });
});

test('formatResetRelative maintains backward compatibility with live countdown text', () => {
  const now = 1774864800000;
  const in45s = new Date(now + 45 * 1000).toISOString();
  const past = new Date(now - 5000).toISOString();

  assert.equal(formatResetRelative(in45s, now), 'in 45s');
  assert.equal(formatResetRelative(past, now), 'due to reset');
  assert.equal(formatResetRelative(null, now), '—');
});
