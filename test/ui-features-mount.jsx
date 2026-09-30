import { GlobalWindow } from 'happy-dom';

const window = new GlobalWindow({ url: 'http://127.0.0.1:20130' });
globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.HTMLInputElement = window.HTMLInputElement;
globalThis.HTMLSelectElement = window.HTMLSelectElement;
globalThis.HTMLButtonElement = window.HTMLButtonElement;
globalThis.Event = window.Event;
globalThis.CustomEvent = window.CustomEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.Blob = window.Blob;
globalThis.URL = window.URL;
globalThis.Notification = {
  permission: 'default',
  requestPermission: async () => 'granted',
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import Header from '../app/components/Header.js';
import DetailSheet from '../app/components/DetailSheet.js';
import QuotaWindowCell from '../app/components/QuotaWindowCell.js';
import UsageView from '../app/components/UsageView.js';

test('Header mounts, handles cadence selection, alert permissions, and export dropdown', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  let selectedCadence = 'off';
  let csvExportTriggered = false;
  let jsonExportTriggered = false;
  let permRequested = false;

  await act(async () => {
    root.render(
      <Header
        activeTab="quotas"
        onTabChange={() => {}}
        theme="light"
        onToggleTheme={() => {}}
        onRefresh={() => {}}
        onLogout={() => {}}
        refreshing={false}
        lastSyncAt={new Date().toISOString()}
        accountsCount={10}
        cadence={selectedCadence}
        onCadenceChange={(val) => {
          selectedCadence = val;
        }}
        notificationPermission="default"
        onRequestNotificationPermission={() => {
          permRequested = true;
        }}
        activeAlertsCount={2}
        onExportCsv={() => {
          csvExportTriggered = true;
        }}
        onExportJson={() => {
          jsonExportTriggered = true;
        }}
      />
    );
  });

  const cadenceSelect = container.querySelector('[data-testid="cadence-selector"]');
  assert.ok(cadenceSelect);
  assert.equal(cadenceSelect.value, 'off');

  await act(async () => {
    cadenceSelect.value = '30s';
    cadenceSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.equal(selectedCadence, '30s');

  const notifBtn = container.querySelector('[data-testid="notification-permission-btn"]');
  assert.ok(notifBtn);
  await act(async () => {
    notifBtn.click();
  });
  assert.equal(permRequested, true);

  const alertsBadge = container.querySelector('[data-testid="alerts-count-badge"]');
  assert.ok(alertsBadge);
  assert.equal(alertsBadge.textContent.trim(), '2');

  const exportDropdownBtn = container.querySelector('[data-testid="export-dropdown-btn"]');
  assert.ok(exportDropdownBtn);
  await act(async () => {
    exportDropdownBtn.click();
  });

  const csvBtn = container.querySelector('[data-testid="export-csv-btn"]');
  const jsonBtn = container.querySelector('[data-testid="export-json-btn"]');
  assert.ok(csvBtn);
  assert.ok(jsonBtn);

  await act(async () => {
    csvBtn.click();
  });
  assert.equal(csvExportTriggered, true);

  await act(async () => {
    exportDropdownBtn.click();
  });
  const jsonBtnAfterReopen = container.querySelector('[data-testid="export-json-btn"]');
  assert.ok(jsonBtnAfterReopen);
  await act(async () => {
    jsonBtnAfterReopen.click();
  });
  assert.equal(jsonExportTriggered, true);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test('DetailSheet mounts, handles quota force-refresh, and toggles governor mode', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  let refreshedId = null;
  let governorToggledArgs = null;

  const mockAccount = {
    id: 'conn-alpha',
    displayAlias: 'developer@example.com',
    provider: 'codex',
    active: true,
    effectiveStatus: { status: 'available', label: 'Available' },
    quota: {
      plan: 'Team',
      windows: [
        {
          label: '5-Hour',
          remainingPercent: 75,
          used: 250,
          total: 1000,
          unit: 'tokens',
          resetAt: new Date(Date.now() + 45000).toISOString(),
        },
      ],
    },
  };

  await act(async () => {
    root.render(
      <DetailSheet
        account={mockAccount}
        onClose={() => {}}
        onRefreshQuota={async (id) => {
          refreshedId = id;
          return { success: true };
        }}
        isRefreshingQuota={false}
        onToggleGovernor={async (id, active) => {
          governorToggledArgs = { id, active };
          return {
            success: true,
            id,
            active,
            mode: 'simulated',
            notice: 'Upstream 9router read-only. Effective in dashboard display only.',
          };
        }}
        isTogglingGovernor={false}
      />
    );
  });

  const refreshBtn = container.querySelector('[data-testid="refresh-account-quota-btn"]');
  assert.ok(refreshBtn);
  assert.equal(refreshBtn.textContent.trim(), 'Refresh Quota');

  await act(async () => {
    refreshBtn.click();
  });
  assert.equal(refreshedId, 'conn-alpha');

  const governorToggle = container.querySelector('[data-testid="governor-active-toggle"]');
  assert.ok(governorToggle);
  assert.equal(governorToggle.checked, true);

  await act(async () => {
    governorToggle.click();
  });
  assert.deepEqual(governorToggledArgs, { id: 'conn-alpha', active: false });

  const badge = container.querySelector('[data-testid="governor-mode-badge"]');
  assert.ok(badge);
  assert.equal(badge.textContent.trim(), 'Dashboard Override (Router Read-Only)');

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test('QuotaWindowCell mounts and renders live ticking countdown', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const windowData = {
    remainingPercent: 60,
    used: 400,
    total: 1000,
    resetAt: new Date(Date.now() + 45000).toISOString(),
    unlimited: false,
  };

  await act(async () => {
    root.render(<QuotaWindowCell windowData={windowData} />);
  });

  const pct = container.querySelector('.pp-quota-pct');
  assert.ok(pct);
  assert.equal(pct.textContent.trim(), '60%');

  const meta = container.querySelector('.pp-quota-meta');
  assert.ok(meta);
  assert.match(meta.textContent, /(?:44s|45s)/);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});

test('UsageView mounts and renders provider distribution and account breakdown table', async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const stats = {
    totals: {
      totalTokens: 100000,
      requests: 100,
      estimatedCost: 12.0,
    },
    accounts: [
      {
        connectionId: 'conn-1',
        totalTokens: 60000,
        requests: 60,
        estimatedCost: 7.2,
      },
      {
        connectionId: 'conn-2',
        totalTokens: 40000,
        requests: 40,
        estimatedCost: 4.8,
      },
    ],
  };

  const connections = [
    { id: 'conn-1', provider: 'antigravity', label: 'worker-1@test.com' },
    { id: 'conn-2', provider: 'codex', label: 'worker-2@test.com' },
  ];

  await act(async () => {
    root.render(
      <UsageView
        stats={stats}
        connections={connections}
        loading={false}
        error={null}
        period="24h"
        onPeriodChange={() => {}}
      />
    );
  });

  const providerSection = container.querySelector('[data-testid="provider-distribution-section"]');
  assert.ok(providerSection);

  const antigravityCard = container.querySelector('[data-testid="provider-card-antigravity"]');
  assert.ok(antigravityCard);
  assert.match(antigravityCard.textContent, /60%/);

  const codexCard = container.querySelector('[data-testid="provider-card-codex"]');
  assert.ok(codexCard);
  assert.match(codexCard.textContent, /40%/);

  const accountSection = container.querySelector('[data-testid="account-breakdown-section"]');
  assert.ok(accountSection);
  assert.match(accountSection.textContent, /worker-1@test\.com/);
  assert.match(accountSection.textContent, /worker-2@test\.com/);

  await act(async () => {
    root.unmount();
  });
  container.remove();
});
