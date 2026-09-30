import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAccountAlertable,
  buildIncidentKey,
  checkAccountsForAlerts,
} from '../lib/client/alerts.js';

test('isAccountAlertable identifies exhausted quotas and auth failures only', () => {
  const normalAccount = {
    id: 'c1',
    effectiveStatus: { status: 'available', reason: null },
  };
  const exhaustedAccount = {
    id: 'c2',
    effectiveStatus: { status: 'exhausted', reason: null },
  };
  const authRequiredAccount = {
    id: 'c3',
    effectiveStatus: { status: 'unavailable', reason: 'PROVIDER_AUTH_REQUIRED' },
  };
  const staleAccount = {
    id: 'c4',
    effectiveStatus: { status: 'stale', reason: 'STALE_DATA' },
  };

  assert.equal(isAccountAlertable(normalAccount), false);
  assert.equal(isAccountAlertable(exhaustedAccount), true);
  assert.equal(isAccountAlertable(authRequiredAccount), true);
  assert.equal(isAccountAlertable(staleAccount), false);
});

test('checkAccountsForAlerts triggers notification once and deduplicates on subsequent polls', () => {
  const alertedIncidents = new Map();
  const notifications = [];
  const notifyFn = (title, opts) => {
    notifications.push({ title, ...opts });
  };

  const accounts = [
    {
      id: 'conn-1',
      provider: 'codex',
      displayAlias: 'developer@example.com',
      effectiveStatus: { status: 'exhausted', reason: null },
      quota: { windows: [{ resetAt: '2026-03-30T12:00:00Z' }] },
    },
    {
      id: 'conn-2',
      provider: 'antigravity',
      displayAlias: 'agent-bot',
      effectiveStatus: { status: 'unavailable', reason: 'PROVIDER_AUTH_REQUIRED' },
      quota: { windows: [] },
    },
  ];

  const firstPass = checkAccountsForAlerts(accounts, alertedIncidents, notifyFn);
  assert.equal(firstPass.length, 2);
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].title, '9Router Quota Exhausted');
  assert.match(notifications[0].body, /developer@example\.com/);
  assert.equal(notifications[1].title, '9Router Auth Required');
  assert.match(notifications[1].body, /agent-bot/);

  const secondPass = checkAccountsForAlerts(accounts, alertedIncidents, notifyFn);
  assert.equal(secondPass.length, 0);
  assert.equal(notifications.length, 2);
});

test('checkAccountsForAlerts re-arms when account recovers and fails again', () => {
  const alertedIncidents = new Map();
  const notifications = [];
  const notifyFn = (title, opts) => {
    notifications.push({ title, ...opts });
  };

  const failingAccount = {
    id: 'conn-1',
    provider: 'codex',
    displayAlias: 'dev@test.com',
    effectiveStatus: { status: 'exhausted', reason: null },
    quota: { windows: [{ resetAt: '2026-03-30T12:00:00Z' }] },
  };

  checkAccountsForAlerts([failingAccount], alertedIncidents, notifyFn);
  assert.equal(notifications.length, 1);

  const recoveredAccount = {
    id: 'conn-1',
    provider: 'codex',
    displayAlias: 'dev@test.com',
    effectiveStatus: { status: 'available', reason: null },
    quota: { windows: [{ resetAt: '2026-03-30T12:00:00Z' }] },
  };
  checkAccountsForAlerts([recoveredAccount], alertedIncidents, notifyFn);
  assert.equal(alertedIncidents.size, 0);

  checkAccountsForAlerts([failingAccount], alertedIncidents, notifyFn);
  assert.equal(notifications.length, 2);
});
