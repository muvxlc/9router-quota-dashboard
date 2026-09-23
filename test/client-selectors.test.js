import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveAccountStatus,
  getProviderCommonWindows,
  groupAccountsByProvider,
  filterAndSortAccounts,
} from '../lib/client/selectors.js';

test('deriveAccountStatus identifies inactive, unavailable, no-data, exhausted, low, and healthy', () => {
  // Inactive connection
  assert.deepEqual(deriveAccountStatus({ active: false }, null), {
    status: 'inactive', label: 'Inactive', reason: null,
  });

  // No quota data received yet
  assert.deepEqual(deriveAccountStatus({ active: true }, null), {
    status: 'no-data', label: 'No Data', reason: 'NO_QUOTA_DATA',
  });

  // Quota explicit reason NO_QUOTA_DATA
  assert.deepEqual(deriveAccountStatus({ active: true }, { status: 'unavailable', reason: 'NO_QUOTA_DATA' }), {
    status: 'no-data', label: 'No Data', reason: 'NO_QUOTA_DATA',
  });

  // Quota auth required
  assert.deepEqual(deriveAccountStatus({ active: true }, { status: 'unavailable', reason: 'PROVIDER_AUTH_REQUIRED' }), {
    status: 'unavailable', label: 'Auth Required', reason: 'PROVIDER_AUTH_REQUIRED',
  });

  // Partial quota
  assert.deepEqual(deriveAccountStatus({ active: true }, { status: 'partial', windows: [{ remainingPercent: 50, unlimited: false }] }), {
    status: 'partial', label: 'Partial', reason: null,
  });

  // Exhausted: short window 0% even if weekly has 90% remaining (never treat weekly as available when short window 0)
  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    windows: [
      { key: '5h', remainingPercent: 0, unlimited: false },
      { key: 'weekly', remainingPercent: 90, unlimited: false },
    ],
  }), { status: 'exhausted', label: 'Exhausted', reason: null });

  // Low quota: any non-unlimited window < 15%
  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    windows: [
      { key: '5h', remainingPercent: 12, unlimited: false },
      { key: 'weekly', remainingPercent: 80, unlimited: false },
    ],
  }), { status: 'low', label: 'Low Quota', reason: null });

  // Healthy quota
  assert.deepEqual(deriveAccountStatus({ active: true }, {
    status: 'ok',
    windows: [
      { key: '5h', remainingPercent: 75, unlimited: false },
      { key: 'weekly', remainingPercent: 88, unlimited: false },
    ],
  }), { status: 'healthy', label: 'Available', reason: null });
});

test('getProviderCommonWindows aligns columns for accounts with dynamic windows', () => {
  const accounts = [
    {
      id: 'acc1',
      quota: {
        windows: [
          { key: '5h', label: '5-Hour Window' },
          { key: 'weekly', label: 'Weekly Window' },
        ],
      },
    },
    {
      id: 'acc2',
      quota: {
        windows: [
          { key: 'weekly', label: 'Weekly Window' },
          { key: 'monthly', label: 'Monthly' },
        ],
      },
    },
  ];

  const windows = getProviderCommonWindows(accounts);
  assert.deepEqual(windows, [
    { key: '5h', label: '5-Hour Window' },
    { key: 'weekly', label: 'Weekly Window' },
    { key: 'monthly', label: 'Monthly' },
  ]);
});

test('groupAccountsByProvider groups accounts and attaches quota and aligned windows', () => {
  const connections = [
    { id: 'c1', provider: 'codex', label: 'work@example.com', active: true },
    { id: 'c2', provider: 'codex', label: 'personal@example.com', active: true },
    { id: 'c3', provider: 'antigravity', label: 'team@example.com', active: true },
  ];
  const quotas = {
    c1: { connectionId: 'c1', status: 'ok', windows: [{ key: '5h', label: '5h', remainingPercent: 80, unlimited: false }] },
    c2: { connectionId: 'c2', status: 'ok', windows: [{ key: '5h', label: '5h', remainingPercent: 0, unlimited: false }] },
    c3: { connectionId: 'c3', status: 'ok', windows: [{ key: 'monthly', label: 'Monthly', remainingPercent: 100, unlimited: false }] },
  };

  const groups = groupAccountsByProvider(connections, quotas);
  assert.equal(groups.length, 2);

  const codexGroup = groups.find((g) => g.provider === 'codex');
  assert.ok(codexGroup);
  assert.equal(codexGroup.accounts.length, 2);
  assert.equal(codexGroup.windows.length, 1);
  assert.equal(codexGroup.accounts[0].effectiveStatus.status, 'healthy');
  assert.equal(codexGroup.accounts[1].effectiveStatus.status, 'exhausted');
});

test('filterAndSortAccounts filters by search, provider, status and sorts correctly', () => {
  const accounts = [
    {
      id: 'c1',
      provider: 'codex',
      label: 'beta-dev@corp.test',
      active: true,
      quota: { status: 'ok', windows: [{ key: '5h', remainingPercent: 80, unlimited: false }] },
      effectiveStatus: { status: 'healthy', label: 'Available' },
    },
    {
      id: 'c2',
      provider: 'codex',
      label: 'alpha-lead@corp.test',
      active: true,
      quota: { status: 'ok', windows: [{ key: '5h', remainingPercent: 10, unlimited: false }] },
      effectiveStatus: { status: 'low', label: 'Low Quota' },
    },
    {
      id: 'c3',
      provider: 'antigravity',
      label: 'solo@corp.test',
      active: false,
      quota: null,
      effectiveStatus: { status: 'inactive', label: 'Inactive' },
    },
  ];

  // Search filter
  const searched = filterAndSortAccounts(accounts, { search: 'alpha' });
  assert.equal(searched.length, 1);
  assert.equal(searched[0].id, 'c2');

  // Provider filter
  const providerFiltered = filterAndSortAccounts(accounts, { provider: 'antigravity' });
  assert.equal(providerFiltered.length, 1);
  assert.equal(providerFiltered[0].id, 'c3');

  // Status filter
  const statusFiltered = filterAndSortAccounts(accounts, { status: 'low' });
  assert.equal(statusFiltered.length, 1);
  assert.equal(statusFiltered[0].id, 'c2');

  // Sort by remainingPct ascending (least remaining first)
  const sortedAsc = filterAndSortAccounts(accounts, { sortBy: 'remainingPct', sortOrder: 'asc' });
  assert.equal(sortedAsc[0].id, 'c2'); // 10%
  assert.equal(sortedAsc[1].id, 'c1'); // 80%
  assert.equal(sortedAsc[2].id, 'c3'); // null -> last
});

test('filterAndSortAccounts distinguishes active connection state from quota health', () => {
  const accounts = [
    { id: 'acc-active-healthy', active: true, effectiveStatus: { status: 'healthy', label: 'Available' }, effectiveRemainingPct: 85 },
    { id: 'acc-active-exhausted', active: true, effectiveStatus: { status: 'exhausted', label: 'Exhausted' }, effectiveRemainingPct: 0 },
    { id: 'acc-active-low', active: true, effectiveStatus: { status: 'low', label: 'Low Quota' }, effectiveRemainingPct: 10 },
    { id: 'acc-inactive', active: false, effectiveStatus: { status: 'inactive', label: 'Inactive' }, effectiveRemainingPct: null },
  ];

  const activeOnly = filterAndSortAccounts(accounts, { activeFilter: 'active' });
  assert.equal(activeOnly.length, 3);
  assert.deepEqual(
    activeOnly.map((a) => a.id).sort(),
    ['acc-active-exhausted', 'acc-active-healthy', 'acc-active-low']
  );

  const inactiveOnly = filterAndSortAccounts(accounts, { activeFilter: 'inactive' });
  assert.equal(inactiveOnly.length, 1);
  assert.equal(inactiveOnly[0].id, 'acc-inactive');

  const allConns = filterAndSortAccounts(accounts, { activeFilter: 'all' });
  assert.equal(allConns.length, 4);

  const activeExhausted = filterAndSortAccounts(accounts, {
    activeFilter: 'active',
    status: 'exhausted',
  });
  assert.equal(activeExhausted.length, 1);
  assert.equal(activeExhausted[0].id, 'acc-active-exhausted');
});

test('getProviderCommonWindows and groupAccountsByProvider default Antigravity to Gemini core windows and preserve all backend windows', () => {
  const agAccounts = [
    {
      id: 'ag-1',
      provider: 'antigravity',
      quota: {
        status: 'ok',
        windows: [
          { key: 'gemini', label: 'Gemini (Flash / Pro)', remainingPercent: 75, used: 25, total: 100 },
          { key: 'gemini_weekly', label: 'Gemini Weekly', remainingPercent: 80, used: 20, total: 100 },
          { key: 'claude', label: 'Claude (Sonnet / Opus)', remainingPercent: 0, used: 100, total: 100 },
          { key: 'gpt', label: 'GPT-OSS (120B)', remainingPercent: 50, used: 50, total: 100 },
          { key: 'claude_gpt_weekly', label: 'Claude & GPT Weekly', remainingPercent: 90, used: 10, total: 100 },
          { key: 'image', label: 'Image Generation', remainingPercent: 100, used: 0, total: 100 },
        ],
      },
    },
    {
      id: 'ag-2',
      provider: 'antigravity',
      quota: {
        status: 'ok',
        windows: [
          { key: 'gemini', label: 'Gemini (Flash / Pro)', remainingPercent: 40, used: 60, total: 100 },
        ],
      },
    },
  ];

  const collapsedWindows = getProviderCommonWindows(agAccounts, { provider: 'antigravity', expanded: false });
  assert.deepEqual(collapsedWindows.map((w) => w.key), ['gemini', 'gemini_weekly']);

  const expandedWindows = getProviderCommonWindows(agAccounts, { provider: 'antigravity', expanded: true });
  assert.deepEqual(
    expandedWindows.map((w) => w.key),
    ['gemini', 'gemini_weekly', 'claude', 'gpt', 'claude_gpt_weekly', 'image']
  );

  const connections = [
    { id: 'ag-1', provider: 'antigravity', label: 'team1@example.com', active: true },
    { id: 'ag-2', provider: 'antigravity', label: 'team2@example.com', active: true },
  ];
  const quotas = {
    'ag-1': agAccounts[0].quota,
    'ag-2': agAccounts[1].quota,
  };

  const groupsCollapsed = groupAccountsByProvider(connections, quotas);
  assert.equal(groupsCollapsed.length, 1);
  const agGroup = groupsCollapsed[0];
  assert.equal(agGroup.provider, 'antigravity');
  assert.deepEqual(agGroup.windows.map((w) => w.key), ['gemini', 'gemini_weekly']);
  assert.equal(agGroup.extraWindowsCount, 4);
  assert.equal(agGroup.allWindows.length, 6);
  assert.equal(agGroup.isExpanded, false);

  assert.equal(agGroup.accounts[0].effectiveStatus.status, 'exhausted');

  const groupsExpanded = groupAccountsByProvider(connections, quotas, {
    expandedProviders: { antigravity: true },
  });
  assert.equal(groupsExpanded[0].windows.length, 6);
  assert.equal(groupsExpanded[0].isExpanded, true);
  assert.equal(groupsExpanded[0].extraWindowsCount, 0);
});

test('getProviderCommonWindows assigns short visual labels and preserves accessible full labels', () => {
  const agAccounts = [
    {
      id: 'ag-1',
      provider: 'antigravity',
      quota: {
        status: 'ok',
        windows: [
          { key: 'gemini', label: 'Gemini (Flash / Pro)' },
          { key: 'gemini_weekly', label: 'Gemini Weekly' },
          { key: 'claude', label: 'Claude (Sonnet / Opus)' },
        ],
      },
    },
  ];

  const windows = getProviderCommonWindows(agAccounts, { provider: 'antigravity', expanded: false });
  assert.equal(windows[0].shortLabel, 'Flash / Pro');
  assert.equal(windows[0].label, 'Gemini (Flash / Pro)');
  assert.equal(windows[1].shortLabel, 'Weekly');
  assert.equal(windows[1].label, 'Gemini Weekly');
});

test('regression: activeFilter default active excludes inactive accounts, all includes both', () => {
  const accounts = [
    { id: 'acc-active-1', active: true, label: 'Active 1' },
    { id: 'acc-inactive-1', active: false, label: 'Inactive 1' },
    { id: 'acc-active-2', active: true, label: 'Active 2' },
    { id: 'acc-inactive-2', active: false, label: 'Inactive 2' },
  ];

  const activeOnly = filterAndSortAccounts(accounts, { activeFilter: 'active' });
  assert.equal(activeOnly.length, 2);
  assert.deepEqual(activeOnly.map((a) => a.id), ['acc-active-1', 'acc-active-2']);
  assert.ok(activeOnly.every((a) => a.active === true));

  const allAccounts = filterAndSortAccounts(accounts, { activeFilter: 'all' });
  assert.equal(allAccounts.length, 4);
  assert.equal(allAccounts.filter((a) => a.active === false).length, 2);
});

