'use client';

import { useEffect, useState } from 'react';
import QuotaTable from '../components/QuotaTable.js';

const HOUR = 3600_000;

const WINDOW_DEFS = {
  session: { key: 'session', label: '5-Hour Window', shortLabel: '5-Hour' },
  weekly: { key: 'weekly', label: 'Weekly Window', shortLabel: 'Weekly' },
  gemini: { key: 'gemini', label: 'Flash / Pro Window', shortLabel: 'Flash / Pro' },
  gemini_weekly: { key: 'gemini_weekly', label: 'Weekly Window', shortLabel: 'Weekly' },
};

const STATUS_CYCLE = [
  { status: 'healthy', label: 'Available' },
  { status: 'healthy', label: 'Available' },
  { status: 'stale', label: 'Stale' },
  { status: 'exhausted', label: 'Exhausted' },
  { status: 'healthy', label: 'Available' },
];

function makeAccount(provider, alias, i, keys) {
  const statusObj = STATUS_CYCLE[i % STATUS_CYCLE.length];
  return {
    id: `${provider}-${i}`,
    label: alias,
    displayAlias: alias,
    maskedIdentity: `user${String(i).padStart(2, '0')}***@example.com`,
    active: true,
    effectiveStatus: statusObj,
    quota: {
      windows: keys.map((k, ki) => ({
        key: k,
        remainingPercent: ((i * 37 + ki * 29 + provider.length * 13) % 95) + 3,
        used: 100 - (((i * 37 + ki * 29 + provider.length * 13) % 95) + 3),
        total: 100,
        resetAt: new Date(Date.now() + HOUR * (1 + ((i + ki) % 6))).toISOString(),
        unlimited: false,
      })),
    },
  };
}

function makePool(provider, title, keys, count, aliasPrefix, extraWindowsCount = 0) {
  return {
    provider,
    providerTitle: title,
    accounts: Array.from({ length: count }, (_, i) =>
      makeAccount(provider, `${aliasPrefix} ${String(i + 1).padStart(2, '0')}`, i, keys)
    ),
    windows: keys.map((k) => WINDOW_DEFS[k]),
    extraWindowsCount,
    isExpanded: false,
  };
}

const SCENARIOS = {
  current: {
    label: 'Current pools (4 / 14 / 1)',
    groups: [
      makePool('codex', 'Codex', ['session', 'weekly'], 4, 'Codex'),
      makePool('antigravity', 'Antigravity', ['gemini', 'gemini_weekly'], 14, 'Account', 4),
      makePool('glm', 'Glm', ['session'], 1, 'Glm'),
    ],
  },
  fourPools: {
    label: 'New pool added (+ Claude x8)',
    groups: [
      makePool('codex', 'Codex', ['session', 'weekly'], 4, 'Codex'),
      makePool('antigravity', 'Antigravity', ['gemini', 'gemini_weekly'], 14, 'Account', 4),
      makePool('glm', 'Glm', ['session'], 1, 'Glm'),
      makePool('claude', 'Claude', ['session', 'weekly'], 8, 'Claude'),
    ],
  },
  single: {
    label: 'Single pool (Codex x6)',
    groups: [makePool('codex', 'Codex', ['session', 'weekly'], 6, 'Codex')],
  },
};

export default function LayoutPreviewPage() {
  const [scenario, setScenario] = useState(null);

  useEffect(() => {
    setScenario('current');
  }, []);

  if (!scenario) {
    return <main />;
  }

  const { groups } = SCENARIOS[scenario];

  return (
    <>
      <div className="preview-toolbar">
        <span className="preview-title">Layout Preview</span>
        <span className="preview-note">Synthetic data — resize the window to watch columns rebalance</span>
        <div className="preview-switch">
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <button
              key={key}
              type="button"
              className={`preview-btn ${key === scenario ? 'active' : ''}`}
              onClick={() => setScenario(key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <main>
        <QuotaTable groups={groups} onSelectAccount={() => {}} onToggleExpandProvider={() => {}} />
      </main>
    </>
  );
}
