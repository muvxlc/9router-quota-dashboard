'use client';

import { formatNumber, formatTokens, formatCost } from '../../lib/client/selectors.js';

export default function UsageView({
  stats,
  loading,
  error,
  period,
  onPeriodChange,
}) {
  const totals = stats?.totals || {};
  const chartPoints = Array.isArray(stats?.chart) ? stats.chart : [];

  const maxTokens = Math.max(...chartPoints.map((p) => p.tokens || 0), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Banner & Scope Notice */}
      <div
        className="pp-card"
        style={{
          padding: '12px 18px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: -0.01 }}>
            9Router Usage & Traffic
          </h2>
          <p style={{ fontSize: 12, color: 'var(--theme-text-muted)', marginTop: 2 }}>
            Scope: <strong>All Router Traffic</strong> (system-wide global metrics, unaffected by account filters)
          </p>
        </div>

        {/* Period Selector */}
        <div className="nav-links">
          {['24h', '7d', '30d'].map((p) => (
            <button
              key={p}
              type="button"
              className={`nav-link-btn ${period === p ? 'active' : ''}`}
              onClick={() => onPeriodChange(p)}
              disabled={loading}
              style={{
                color: period === p ? 'var(--theme-dark)' : 'var(--theme-text-muted)',
                background: period === p ? 'var(--theme-canvas-subtle)' : 'transparent',
                border: period === p ? '1px solid var(--theme-border-strong)' : 'none',
              }}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: 'var(--theme-red-tint)', color: 'var(--theme-red)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Metrics Summary Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10,
        }}
      >
        <div className="pp-card" style={{ padding: '14px 18px' }}>
          <span style={{ fontSize: 12, color: 'var(--theme-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Requests
          </span>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }} className="tabular-nums">
            {loading ? '…' : formatNumber(totals.requests)}
          </div>
        </div>

        <div className="pp-card" style={{ padding: '14px 18px' }}>
          <span style={{ fontSize: 12, color: 'var(--theme-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Tokens
          </span>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }} className="tabular-nums">
            {loading ? '…' : formatTokens(totals.totalTokens)}
          </div>
        </div>

        <div className="pp-card" style={{ padding: '14px 18px' }}>
          <span style={{ fontSize: 12, color: 'var(--theme-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Input / Output
          </span>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }} className="tabular-nums">
            {loading ? '…' : `${formatTokens(totals.inputTokens)} in • ${formatTokens(totals.outputTokens)} out`}
          </div>
          <div style={{ fontSize: 12, color: 'var(--theme-text-muted)', marginTop: 2 }}>
            Cached: {loading ? '…' : formatTokens(totals.cachedTokens)}
          </div>
        </div>

        <div className="pp-card" style={{ padding: '14px 18px' }}>
          <span style={{ fontSize: 12, color: 'var(--theme-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Estimated Cost
          </span>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: 'var(--theme-orange)' }} className="tabular-nums">
            {loading ? '…' : formatCost(totals.estimatedCost)}
          </div>
        </div>
      </div>

      {/* Traffic Trend Chart */}
      <div className="pp-card" style={{ padding: '16px 20px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>
          Token Volume Over Time ({period.toUpperCase()})
        </h3>

        {chartPoints.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--theme-text-muted)' }}>
            {stats?.chartStatus === 'unavailable' ? 'Chart data unavailable for this period.' : 'No chart activity recorded.'}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              height: 180,
              paddingTop: 24,
              borderBottom: '1px solid var(--theme-border)',
              paddingBottom: 8,
            }}
          >
            {chartPoints.map((pt, idx) => {
              const heightPct = Math.max(4, Math.round(((pt.tokens || 0) / maxTokens) * 100));
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                  title={`${pt.label}: ${formatTokens(pt.tokens)} tokens (${formatCost(pt.estimatedCost)})`}
                >
                  <div
                    style={{
                      width: '100%',
                      maxHeight: '100%',
                      height: `${heightPct}%`,
                      backgroundColor: 'var(--theme-orange)',
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--theme-text-muted)',
                      marginTop: 6,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 60,
                    }}
                  >
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
