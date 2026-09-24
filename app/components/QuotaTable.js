'use client';

import StatusPill from './StatusPill.js';
import QuotaWindowCell from './QuotaWindowCell.js';
import { getProviderQuotaAverages } from '../../lib/client/selectors.js';

function getAverageLabel(avg) {
  if (avg.key === 'gemini') return 'Flash / Pro';
  if (avg.key === 'gemini_weekly') return 'Weekly';
  if (avg.key === 'session') return '5-Hour';
  if (avg.key === 'weekly') return 'Weekly';
  return avg.label || avg.key;
}

function formatAverageValue(avg) {
  if (avg?.average === null || avg?.average === undefined || avg?.count === 0) {
    return '—';
  }
  return `${avg.average}%`;
}

export default function QuotaTable({ groups, onSelectAccount, onToggleExpandProvider }) {
  if (!groups || groups.length === 0) {
    return (
      <div className="pp-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: 'var(--theme-text-muted)' }}>
          No accounts found matching the current filters.
        </p>
      </div>
    );
  }

  const renderGroupCard = (group, isRightCol = false) => {
    const { provider, providerTitle, accounts, windows, extraWindowsCount, isExpanded } = group;
    const averages = getProviderQuotaAverages(group);

    return (
      <section
        key={provider}
        className={`pp-card ${isRightCol ? 'codex-panel-wrap' : ''}`}
        aria-labelledby={`group-${provider}`}
      >
        <div className="pp-card-header">
          <div className="pp-card-title-group">
            <h2 id={`group-${provider}`} className="pp-card-title">
              {providerTitle} Pool
            </h2>
            <span className="pp-pill-counter">{accounts.length} ACCOUNTS</span>
            {(extraWindowsCount > 0 || isExpanded) && (
              <button
                type="button"
                className="more-quotas-btn"
                aria-expanded={isExpanded}
                onClick={() => onToggleExpandProvider?.(provider)}
                aria-label={isExpanded ? `Show core quotas for ${providerTitle}` : `Show ${extraWindowsCount} more quotas for ${providerTitle}`}
              >
                {isExpanded ? (
                  'Core quotas'
                ) : (
                  <>
                    <span>More quotas</span>
                    <span>({extraWindowsCount})</span>
                  </>
                )}
              </button>
            )}
          </div>

          {windows.length > 0 && (
            <div className="pp-columns-legend">
              {windows.map((w) => {
                const labelText = w.shortLabel ||
                  (w.key === 'session' ? '5-Hour' :
                   w.key === 'weekly' ? 'Weekly' :
                   w.label?.replace(/\s+Window$/i, '') || w.key);
                return (
                  <span
                    key={w.key}
                    className="pp-col-hint"
                    title={w.label || w.key}
                  >
                    {labelText}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="pp-account-list" role="list">
          {accounts.map((acc) => {
            const quotaWindows = Array.isArray(acc.quota?.windows) ? acc.quota.windows : [];

            return (
              <div
                key={acc.id}
                role="button"
                tabIndex={0}
                className={`pp-account-row ${acc.effectiveStatus?.status === 'stale' ? 'stale' : ''}`}
                onClick={() => onSelectAccount(acc)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectAccount(acc);
                  }
                }}
                aria-label={`View details for ${acc.displayAlias || acc.label || acc.id}`}
                data-alias={acc.displayAlias || acc.label || acc.id}
                data-active={acc.effectiveStatus?.status === 'active' || acc.active === true}
              >
                <div className="pp-identity">
                  <div className="pp-identity-header">
                    <span className="pp-alias" title={acc.displayAlias || acc.label || acc.id}>
                      {acc.displayAlias || acc.label || acc.id}
                    </span>
                    <StatusPill statusObj={acc.effectiveStatus} />
                  </div>
                  <div className="pp-email" title={acc.maskedIdentity}>
                    {acc.maskedIdentity}
                  </div>
                </div>

                <div className="pp-quota-columns">
                  {windows.length > 0 ? (
                    windows.map((w) => {
                      const matchedWin = quotaWindows.find((qw) => qw.key === w.key);
                      return (
                        <QuotaWindowCell key={w.key} windowData={matchedWin} />
                      );
                    })
                  ) : (
                    <QuotaWindowCell windowData={quotaWindows[0]} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="pp-card-footer pp-pool-averages"
          aria-label={`Pool averages for ${providerTitle}`}
        >
          <div className="pp-pool-averages-label">
            <span className="pp-pool-averages-title">Average remaining</span>
          </div>
          <div className="pp-pool-averages-list">
            {averages.map((avg) => {
              const label = getAverageLabel(avg);
              const formattedVal = formatAverageValue(avg);
              const hasAvg = typeof avg?.average === 'number' && avg.count > 0;
              const fillWidth = hasAvg ? Math.min(Math.max(avg.average, 0), 100) : 0;
              const barColorClass = !hasAvg
                ? ''
                : avg.average === 0
                  ? 'red'
                  : avg.average < 20
                    ? 'amber'
                    : 'green';

              return (
                <div
                  key={avg.key}
                  className="pp-pool-avg-cell"
                  title={`${label}: ${formattedVal} (${avg.count} accounts)`}
                  data-window={avg.key}
                >
                  <div className="pp-pool-avg-header">
                    <span className="pp-pool-avg-label">{label}</span>
                    <span className="pp-pool-avg-value tabular-nums">{formattedVal}</span>
                  </div>
                  <div className="pp-bar-track" aria-hidden="true">
                    <div
                      className={`pp-bar-fill ${barColorClass}`}
                      style={{ width: `${fillWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  const leftGroup = groups[0];
  const rightGroups = groups.slice(1);

  return (
    <div className="dashboard-main-grid">
      {/* Left Column Card */}
      {leftGroup && renderGroupCard(leftGroup, false)}

      {/* Right Column Stack */}
      <div className="right-col-stack">
        {rightGroups.map((g) => renderGroupCard(g, true))}
      </div>
    </div>
  );
}
