'use client';

import { formatPercent, formatResetRelative, formatExactDate } from '../../lib/client/selectors.js';

function formatCompactNumber(num) {
  if (num === null || num === undefined) return '';
  if (num >= 1000000) {
    const v = (num / 1000000).toFixed(1).replace(/\.0$/, '');
    return `${v}M`;
  }
  if (num >= 1000) {
    const v = (num / 1000).toFixed(1).replace(/\.0$/, '');
    return `${v}k`;
  }
  return String(num);
}

function formatCompactUsageText(used, total) {
  if (used === null || used === undefined) return '';
  if (total === null || total === undefined) return `${formatCompactNumber(used)} used`;
  return `${formatCompactNumber(used)}/${formatCompactNumber(total)} used`;
}

export default function QuotaWindowCell({ windowData }) {
  if (!windowData) {
    return (
      <div className="pp-quota-cell">
        <div className="pp-quota-value-row">
          <span className="pp-quota-pct" style={{ color: 'var(--theme-text-muted)' }}>—</span>
          <span className="pp-quota-pct-label">rem</span>
        </div>
        <div className="pp-bar-track"><div className="pp-bar-fill" style={{ width: '0%' }}></div></div>
        <div className="pp-quota-meta"><span className="reset">—</span><span className="used">—</span></div>
      </div>
    );
  }

  const { remainingPercent, used, total, resetAt, unlimited } = windowData;
  const pctStr = formatPercent(remainingPercent, unlimited);
  const rawResetRel = formatResetRelative(resetAt);
  const resetStr = rawResetRel ? rawResetRel.replace(/^in\s+/, '') : '—';
  const usageStr = formatCompactUsageText(used, total);
  const exactDateStr = formatExactDate(resetAt);

  let pctColorClass = '';
  let barColorClass = 'green';
  let resetStyle = {};

  if (unlimited) {
    barColorClass = 'green';
  } else if (remainingPercent === 0) {
    pctColorClass = 'red';
    barColorClass = 'red';
    resetStyle = { color: 'var(--theme-red)' };
  } else if (typeof remainingPercent === 'number' && remainingPercent < 20) {
    pctColorClass = 'amber';
    barColorClass = 'amber';
    resetStyle = { color: 'var(--theme-amber)' };
  } else if (typeof remainingPercent === 'number') {
    barColorClass = 'green';
  }

  const fillWidth = unlimited
    ? 100
    : typeof remainingPercent === 'number'
      ? Math.min(Math.max(remainingPercent, 0), 100)
      : 0;

  return (
    <div className="pp-quota-cell" title={resetAt ? `Resets: ${exactDateStr}` : undefined}>
      <div className="pp-quota-value-row">
        <span className={`pp-quota-pct ${pctColorClass}`}>{pctStr}</span>
        <span className="pp-quota-pct-label">{unlimited ? 'unlimited' : 'rem'}</span>
      </div>

      <div className="pp-bar-track" aria-hidden="true">
        <div
          className={`pp-bar-fill ${barColorClass}`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>

      <div className="pp-quota-meta">
        <span className="reset" style={resetStyle}>{resetStr}</span>
        <span className="used">{usageStr || '—'}</span>
      </div>
    </div>
  );
}
