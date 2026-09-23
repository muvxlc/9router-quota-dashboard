'use client';

import StatusPill from './StatusPill.js';
import QuotaWindowCell from './QuotaWindowCell.js';

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
                {isExpanded ? 'Core quotas' : `More quotas (${extraWindowsCount})`}
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

        {/* Status Indicators / Legend Card */}
        <div className="pp-spec-card">
          <div className="pp-spec-header">
            <div className="pp-spec-title">
              <span>{'//'}</span> QUOTA PROTOCOL SPECIFICATION
            </div>
            <span className="pp-spec-tag">TELEMETRY</span>
          </div>

          <div className="pp-spec-grid">
            <div className="pp-spec-item">
              <span className="spec-dot green"></span>
              <span><strong>Healthy (&gt;20%)</strong>: Standard Route</span>
            </div>
            <div className="pp-spec-item">
              <span className="spec-dot amber"></span>
              <span><strong>Low (&lt;20%)</strong>: Depletion Risk</span>
            </div>
            <div className="pp-spec-item">
              <span className="spec-dot red"></span>
              <span><strong>Depleted (0%)</strong>: Paused</span>
            </div>
            <div className="pp-spec-item">
              <span className="spec-dot orange"></span>
              <span><strong>Streaming</strong>: Active Lock</span>
            </div>
          </div>

          <div className="pp-spec-footer">
            <span>Quota windows reset independently</span>
          </div>
        </div>
      </div>
    </div>
  );
}
