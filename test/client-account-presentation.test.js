import test from 'node:test';
import assert from 'node:assert/strict';
import { maskEmail, buildAccountPresentation } from '../lib/client/accountPresentation.js';

test('maskEmail handles typical and edge-case identities properly', () => {
  // exact user example: ag-03***@example.test
  assert.equal(maskEmail('ag-03@example.test'), 'ag-03***@example.test');
  // real email concept: coppycloud1@gmail.com -> coppy***@gmail.com (first 5 chars)
  assert.equal(maskEmail('coppycloud1@gmail.com'), 'coppy***@gmail.com');
  // already masked email
  assert.equal(maskEmail('ag-01***@example.test'), 'ag-01***@example.test');
  // short local part <= 5 chars
  assert.equal(maskEmail('user@test.org'), 'user***@test.org');
  // non-email connection id
  assert.equal(maskEmail('ag-connection-12345678'), 'ag-conne***');
  assert.equal(maskEmail('short'), 'short***');
  // empty or null
  assert.equal(maskEmail(''), '');
  assert.equal(maskEmail(null), '');
});

test('buildAccountPresentation assigns deterministic provider-scoped aliases independent of filter/order', () => {
  const allConnections = [
    { id: 'ag-10', provider: 'antigravity', label: 'ag-10@example.test', active: true },
    { id: 'ag-2', provider: 'antigravity', label: 'ag-02@example.test', active: true },
    { id: 'ag-1', provider: 'antigravity', label: 'ag-01@example.test', active: false },
    { id: 'codex-2', provider: 'codex', label: 'cdx-02@example.test', active: true },
    { id: 'codex-1', provider: 'codex', label: 'cdx-01@example.test', active: false },
  ];

  const presMap = buildAccountPresentation(allConnections);

  // Antigravity accounts must sort naturally by ID (ag-1, ag-2, ag-10)
  assert.equal(presMap.get('ag-1').alias, 'Account 01');
  assert.equal(presMap.get('ag-1').maskedIdentity, 'ag-01***@example.test');

  assert.equal(presMap.get('ag-2').alias, 'Account 02');
  assert.equal(presMap.get('ag-2').maskedIdentity, 'ag-02***@example.test');

  assert.equal(presMap.get('ag-10').alias, 'Account 03');
  assert.equal(presMap.get('ag-10').maskedIdentity, 'ag-10***@example.test');

  // Codex accounts must have Codex 01, Codex 02
  assert.equal(presMap.get('codex-1').alias, 'Codex 01');
  assert.equal(presMap.get('codex-1').maskedIdentity, 'cdx-0***@example.test');

  assert.equal(presMap.get('codex-2').alias, 'Codex 02');
  assert.equal(presMap.get('codex-2').maskedIdentity, 'cdx-0***@example.test');

  // Verify filtering a subset does NOT alter the assigned alias from the map
  const activeOnlySubset = allConnections.filter(c => c.active);
  const activeAg2 = activeOnlySubset.find(c => c.id === 'ag-2');
  assert.equal(presMap.get(activeAg2.id).alias, 'Account 02');
});
