'use client';

import StatusPill from './StatusPill.js';
import QuotaWindowCell from './QuotaWindowCell.js';
import { calculateDepletionVelocity } from '../../lib/client/selectors.js';

function windowLabel(win) {
  if (win.key === 'session' || win.key === '5h') return '5-Hour';
  if (win.key === 'weekly') return 'Weekly';
  return win.shortLabel || win.label || win.key;
}

export default function QuotaCards({ accounts = [], onSelectAccount = () => {} }) {
  if (!Array.isArray(accounts) || accounts.length === 0) return null;

  return (
    <section className="pp-card quota-cards" aria-label="Account quota cards">
      <div className="live-models-card-header">
        <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', margin: 0, letterSpacing: '0.02em' }}>
          Quota Cards ({accounts.length})
        </h3>
        <span className="pp-pill-counter">Click a card for details</span>
      </div>

      <div className="quota-cards-grid">
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
