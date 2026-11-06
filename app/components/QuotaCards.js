'use client';

import StatusPill from './StatusPill.js';
import QuotaWindowCell from './QuotaWindowCell.js';
import { calculateDepletionVelocity, getAccountsQuotaAverages } from '../../lib/client/selectors.js';

function isAllowedWindow(key) {
  if (!key) return false;
  const k = String(key).toLowerCase();
  return k === 'gemini' || k === 'gemini_weekly' || k === 'session' || k === '5h' || k === 'weekly';
}

function windowLabel(win) {
  if (win.key === 'gemini') return 'Flash / Pro';
  if (win.key === 'gemini_weekly') return 'Weekly';
  if (win.key === 'session' || win.key === '5h') return '5-Hour';
  if (win.key === 'weekly') return 'Weekly';
  return win.shortLabel || win.label || win.key;
}

function formatAverage(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '—';
}

function getProviderSummaryLine(providerKey, label, providerAccounts) {
  if (providerAccounts.length === 0) return null;
  const avg = getAccountsQuotaAverages(providerAccounts);
  // find 5h (or gemini flash/pro) and weekly windows
  const win5h = avg.windows.find((w) => w.key === 'session' || w.key === '5h' || w.key === 'gemini');
  const winWeekly = avg.windows.find((w) => w.key === 'weekly' || w.key === 'gemini_weekly');

  const val5h = formatAverage(win5h?.average);
  const valWeekly = formatAverage(winWeekly?.average);
  const count = avg.overall.count;
  const total = providerAccounts.length;

  return {
    providerKey,
    label,
    val5h,
    valWeekly,
    count,
    total,
  };
}

export default function QuotaCards({ accounts: allAccounts = [], onSelectAccount = () => {} }) {
  // Inactive accounts are hidden from cards, count, and averages.
  // Match both the raw flag and the derived pill status so a shape drift in
  // either one cannot leak an Inactive card back in.
  const accounts = Array.isArray(allAccounts)
    ? allAccounts.filter((acc) => acc?.active !== false && acc?.effectiveStatus?.status !== 'inactive')
    : [];
  if (accounts.length === 0) return null;

  // Filter account windows and averages to core windows: flash/pro(5h) / weekly
  const filteredAccounts = accounts.map((acc) => {
    if (!acc.quota || !Array.isArray(acc.quota.windows)) return acc;
    return {
      ...acc,
      quota: {
        ...acc.quota,
        windows: acc.quota.windows.filter((w) => isAllowedWindow(w?.key)),
      },
    };
  });

  // Group accounts by provider for 2-line AVG summary
  const agyAccounts = filteredAccounts.filter((a) => (a.provider || '').toLowerCase() === 'antigravity');
  const codexAccounts = filteredAccounts.filter((a) => (a.provider || '').toLowerCase() === 'codex');
  const otherAccounts = filteredAccounts.filter((a) => {
    const p = (a.provider || '').toLowerCase();
    return p !== 'antigravity' && p !== 'codex';
  });

  const providerSummaries = [
    getProviderSummaryLine('antigravity', 'agy', agyAccounts),
    getProviderSummaryLine('codex', 'codex', codexAccounts),
    getProviderSummaryLine('other', 'other', otherAccounts),
  ].filter(Boolean);

  return (
    <section className="pp-card quota-cards" aria-label="Account quota cards">
      <div className="live-models-card-header">
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', margin: 0, letterSpacing: '0.02em' }}>
          Quota Cards ({accounts.length})
        </h3>
        <span className="pp-pill-counter">Click a card for details</span>
      </div>

      <div className="quota-cards-grid">
        {filteredAccounts.map((acc) => {
          const windows = Array.isArray(acc.quota?.windows) ? acc.quota.windows : [];
          const velocity = calculateDepletionVelocity(acc.quota);
          const alias = acc.displayAlias || acc.label || acc.id;

          return (
            <div
              key={acc.id}
              role="button"
              tabIndex={0}
              className={`quota-card ${acc.effectiveStatus?.status === 'stale' ? 'stale' : ''}`}
              onClick={() => onSelectAccount(acc)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectAccount(acc);
                }
              }}
              aria-label={`View details for ${alias}`}
              data-alias={alias}
            >
              <div className="quota-card-head">
                <span className="quota-card-alias" title={alias}>{alias}</span>
                <StatusPill statusObj={acc.effectiveStatus} suppressAvailable={false} />
                {velocity && (
                  <span className={velocity.badgeClass} title={velocity.detail} data-testid="card-burn-rate-badge">
                    {velocity.label}
                  </span>
                )}
              </div>

              <div className="quota-card-email" title={acc.maskedIdentity}>
                {acc.maskedIdentity}
              </div>

              <div className="quota-card-windows">
                {windows.length === 0 ? (
                  <QuotaWindowCell windowData={null} />
                ) : (
                  windows.map((win) => (
                    <div className="quota-card-window" key={win.key}>
                      <span className="quota-card-window-label">{windowLabel(win)}</span>
                      <QuotaWindowCell windowData={win} />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}

        <div className="quota-card quota-card-summary" aria-label="Average remaining quota across listed accounts">
          <div className="quota-card-summary-header">
            <span className="summary-col-tag" aria-hidden="true" />
            <div className="summary-col-headers">
              <span className="summary-header-col-5h">5-HOUR</span>
              <span className="summary-header-sep">/</span>
              <span className="summary-header-col-w">WEEKLY</span>
            </div>
            <span className="summary-col-meta" aria-hidden="true" />
          </div>
          <div className="quota-card-summary-lines">
            {providerSummaries.map((ps) => (
              <div
                key={ps.providerKey}
                className="quota-card-summary-line tabular-nums"
                data-window={ps.providerKey}
                title={`${ps.label.toUpperCase()}: 5h ${ps.val5h} / Weekly ${ps.valWeekly} (${ps.count}/${ps.total})`}
              >
                <span className="summary-line-prefix">AVG</span>
                <div className="summary-line-values">
                  <span className="summary-val-5h">{ps.val5h}</span>
                  <span className="summary-line-sep">/</span>
                  <span className="summary-val-w">{ps.valWeekly}</span>
                </div>
                <span className="summary-line-provider">
                  {ps.label} {ps.count}/{ps.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
