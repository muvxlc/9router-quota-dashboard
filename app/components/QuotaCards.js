'use client';

import StatusPill from './StatusPill.js';
import QuotaWindowCell from './QuotaWindowCell.js';
import { calculateDepletionVelocity, getAccountsQuotaAverages } from '../../lib/client/selectors.js';

function windowLabel(win) {
  if (win.key === 'session' || win.key === '5h') return '5-Hour';
  if (win.key === 'weekly') return 'Weekly';
  return win.shortLabel || win.label || win.key;
}

function formatAverage(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '—';
}

export default function QuotaCards({ accounts = [], onSelectAccount = () => {} }) {
  if (!Array.isArray(accounts) || accounts.length === 0) return null;

  const averages = getAccountsQuotaAverages(accounts);

  return (
    <section className="pp-card quota-cards" aria-label="Account quota cards">
      <div className="live-models-card-header">
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', margin: 0, letterSpacing: '0.02em' }}>
          Quota Cards ({accounts.length})
        </h3>
        <span className="pp-pill-counter">Click a card for details</span>
      </div>

      <div className="quota-cards-grid">
        <div className="quota-card quota-card-summary" aria-label="Average remaining quota across listed accounts">
          <div className="quota-card-head">
            <span className="quota-card-alias">Average Remaining</span>
            <span className="quota-card-summary-overall tabular-nums" aria-label={`Overall average ${formatAverage(averages.overall.average)}`}>
              AVG <span>{formatAverage(averages.overall.average)}</span>
            </span>
            <span className="pp-pill-counter">
              ({averages.overall.count}/{averages.overall.total} acc)
            </span>
          </div>
          <div className="quota-card-windows">
            {averages.windows.map((avg) => {
              const hasAvg = typeof avg.average === 'number' && avg.count > 0;
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
                  className="pp-pool-avg-cell"
                  key={avg.key}
                  data-window={avg.key}
                  title={`${windowLabel(avg)}: ${formatAverage(avg.average)} (${avg.count}/${avg.total} accounts)`}
                >
                  <div className="pp-pool-avg-header">
                    <span className="pp-pool-avg-label">{windowLabel(avg)}</span>
                    <span className="pp-pool-avg-value tabular-nums">{formatAverage(avg.average)}</span>
                  </div>
                  <div className="pp-bar-track" aria-hidden="true">
                    <div className={`pp-bar-fill ${barColorClass}`} style={{ width: `${fillWidth}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {accounts.map((acc) => {
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
      </div>
    </section>
  );
}
