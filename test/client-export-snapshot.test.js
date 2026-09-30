import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeCsvCell,
  buildCsvSnapshot,
  buildJsonSnapshot,
} from '../lib/client/exportSnapshot.js';

test('sanitizeCsvCell neutralizes CWE-1236 formula injection and escapes RFC 4180 quotes', () => {
  const maliciousFormula = "=cmd|' /C calc'!A0";
  assert.equal(sanitizeCsvCell(maliciousFormula), `"'=cmd|' /C calc'!A0"`);

  assert.equal(sanitizeCsvCell('+123'), `"'+123"`);
  assert.equal(sanitizeCsvCell('-50'), `"'-50"`);
  assert.equal(sanitizeCsvCell('@admin'), `"'@admin"`);
  assert.equal(sanitizeCsvCell('\tcmd'), `"'\tcmd"`);
  assert.equal(sanitizeCsvCell('\rcmd'), `"'\rcmd"`);
  assert.equal(sanitizeCsvCell('|pipe'), `"'|pipe"`);

  assert.equal(sanitizeCsvCell('normal text'), 'normal text');
  assert.equal(sanitizeCsvCell('with,comma'), '"with,comma"');
  assert.equal(sanitizeCsvCell('with"quotes"'), '"with""quotes"""');
  assert.equal(sanitizeCsvCell(''), '');
  assert.equal(sanitizeCsvCell(null), '');
});

test('buildCsvSnapshot creates RFC 4180 compliant CSV lines with correct headers', () => {
  const accounts = [
    {
      id: 'conn-1',
      displayAlias: 'dev@test.com',
      provider: 'codex',
      active: true,
      effectiveStatus: { label: 'Available', status: 'available' },
      effectiveRemainingPct: 85,
      quota: { windows: [{ resetAt: '2026-03-30T12:00:00Z' }] },
    },
    {
      id: 'conn-2',
      displayAlias: '=malicious@test.com',
      provider: 'antigravity',
      active: false,
      effectiveStatus: { label: 'Disabled', status: 'inactive' },
      effectiveRemainingPct: null,
      quota: { windows: [] },
    },
  ];

  const csv = buildCsvSnapshot(accounts);
  const lines = csv.split('\r\n');

  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'Connection ID,Alias,Provider,Status,Active,Remaining %,Reset At');
  assert.equal(lines[1], 'conn-1,dev@test.com,codex,Available,true,85%,2026-03-30T12:00:00Z');
  assert.equal(lines[2], `conn-2,"'=malicious@test.com",antigravity,Disabled,false,—,`);
});

test('buildJsonSnapshot exports clean structure without sensitive credentials', () => {
  const accounts = [
    {
      id: 'conn-1',
      displayAlias: 'dev@test.com',
      provider: 'codex',
      active: true,
      secretToken: 'sensitive-token-12345',
      effectiveStatus: { label: 'Available', status: 'available' },
      effectiveRemainingPct: 75,
      quota: { receivedAt: '2026-03-30T10:00:00Z', windows: [{ resetAt: '2026-03-30T12:00:00Z' }] },
    },
  ];

  const jsonStr = buildJsonSnapshot(accounts);
  const parsed = JSON.parse(jsonStr);

  assert.equal(Array.isArray(parsed), true);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, 'conn-1');
  assert.equal(parsed[0].alias, 'dev@test.com');
  assert.equal(parsed[0].remainingPercent, 75);
  assert.equal(parsed[0].secretToken, undefined);
});
