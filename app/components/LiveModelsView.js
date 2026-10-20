'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  createLiveModelsSubscription,
  formatLiveStatusLabel,
  formatLiveTimestamp,
  getLiveStatusMeta,
} from '../../lib/client/liveModels.js';
import { maskEmail } from '../../lib/client/selectors.js';
import QuotaCards from './QuotaCards.js';

export default function LiveModelsView({
  url = '/api/live-models',
  onSessionLoss = () => {},
  customSubscription = null,
  accounts = [],
  onSelectAccount = () => {},
}) {
  const [streamState, setStreamState] = useState({
    status: 'connecting',
    activeModels: [],
    recentRequests: [],
    totalCount: 0,
    receivedAt: null,
    connectedAt: null,
  });

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [accumulatedRecent, setAccumulatedRecent] = useState([]);

  useEffect(() => {
    const handleUpdate = (next) => {
      if (isPausedRef.current) return;
      setStreamState(next);

      if (Array.isArray(next.recentRequests) && next.recentRequests.length > 0) {
        setAccumulatedRecent((prev) => {
          const map = new Map();
          for (const item of prev) {
            const key = `${item.timestamp || ''}-${item.model}-${item.provider}-${item.account || ''}`;
            map.set(key, item);
          }
          for (const item of next.recentRequests) {
            const key = `${item.timestamp || ''}-${item.model}-${item.provider}-${item.account || ''}`;
            map.set(key, item);
          }
          const combined = Array.from(map.values()).sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA;
          });
          return combined.slice(0, 30);
        });
      }
    };

    if (customSubscription) {
      return customSubscription(handleUpdate);
    }

    const sub = createLiveModelsSubscription({
      url,
      onSessionLoss,
      onUpdate: handleUpdate,
    });

    return () => sub.unsubscribe();
  }, [url, onSessionLoss, customSubscription]);

  const { status, activeModels, totalCount, receivedAt, connectedAt } = streamState;
  const statusMeta = getLiveStatusMeta(status, totalCount);

  const uniqueProviders = useMemo(() => {
    const set = new Set();
    for (const item of activeModels) {
      if (item.provider) set.add(item.provider.toLowerCase());
    }
    for (const item of accumulatedRecent) {
      if (item.provider) set.add(item.provider.toLowerCase());
    }
    return Array.from(set).sort();
  }, [activeModels, accumulatedRecent]);

  const filteredActive = useMemo(() => {
    return activeModels.filter((item) => {
      if (providerFilter !== 'all' && (item.provider || '').toLowerCase() !== providerFilter) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const target = `${item.model || ''} ${item.provider || ''} ${item.account || ''}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [activeModels, providerFilter, search]);

  const filteredRecent = useMemo(() => {
    const source = accumulatedRecent.length > 0 ? accumulatedRecent : (streamState.recentRequests || []);
    return source.filter((item) => {
      if (providerFilter !== 'all' && (item.provider || '').toLowerCase() !== providerFilter) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const target = `${item.model || ''} ${item.provider || ''} ${item.account || ''}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [accumulatedRecent, streamState.recentRequests, providerFilter, search]);

  const activeProvidersCount = useMemo(() => {
    const set = new Set();
    for (const item of activeModels) {
      if (item.provider) set.add(item.provider.toLowerCase());
    }
    return set.size;
  }, [activeModels]);

  const getRelativeTime = useCallback((timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    return date.toLocaleTimeString();
  }, []);

  return (
    <div className="live-models-container">
      <div
        className="pp-card live-models-banner"
        style={{
          padding: '10px 16px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              className="live-beacon-dot"
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: status === 'live' ? 'var(--theme-green)' : 'var(--theme-orange)',
              }}
              aria-hidden="true"
            />
            <h2 style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', letterSpacing: -0.01, margin: 0 }}>
              9Router Live Models
            </h2>
          </div>
          <p style={{ fontSize: 11, color: 'var(--theme-text-muted)', margin: '2px 0 0 0' }}>
            Scope: <strong>Real-Time Stream Telemetry</strong> (active concurrent requests & completed model events)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-pill ${statusMeta.pillClass}`}>
            {isPaused ? 'PAUSED' : statusMeta.text}
          </span>
          <span className="live-strip-time tabular-nums" style={{ fontSize: 11, color: 'var(--theme-text-muted)' }}>
            {formatLiveTimestamp(receivedAt, { status, connectedAt })}
          </span>
          <button
            type="button"
            className="nav-link-btn"
            onClick={() => setIsPaused((prev) => !prev)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              border: '1px solid var(--theme-border)',
              background: isPaused ? 'var(--theme-orange)' : 'var(--theme-canvas-subtle)',
              color: isPaused ? '#fff' : 'var(--theme-text)',
              cursor: 'pointer',
              borderRadius: 'var(--radius-sm, 4px)',
            }}
            title={isPaused ? 'Resume live stream updates' : 'Pause live stream updates to freeze view'}
          >
            {isPaused ? '▶ Resume' : '⏸ Freeze'}
          </button>
        </div>
      </div>

      <div className="live-models-kpi-grid">
        <div className="pp-card" style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            In-Flight Requests
          </span>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: totalCount > 0 ? 'var(--theme-orange)' : 'var(--theme-text)' }} className="tabular-nums">
            {totalCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
            Across {activeModels.length} active model{activeModels.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="pp-card" style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Active Models
          </span>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }} className="tabular-nums">
            {activeModels.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
            Currently receiving requests
          </div>
        </div>

        <div className="pp-card" style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Active Providers
          </span>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }} className="tabular-nums">
            {activeProvidersCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
            {activeProvidersCount > 0 ? uniqueProviders.slice(0, 3).join(', ') : 'None'}
          </div>
        </div>

        <div className="pp-card" style={{ padding: '10px 14px' }}>
          <span style={{ fontSize: 11, color: 'var(--theme-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Recent Completions
          </span>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }} className="tabular-nums">
            {accumulatedRecent.length > 0 ? accumulatedRecent.length : (streamState.recentRequests || []).length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
            History buffer (max 30)
          </div>
        </div>
      </div>

      <QuotaCards accounts={accounts} onSelectAccount={onSelectAccount} />

      <div
        className="pp-card live-models-filter-bar"
        style={{
          padding: '8px 14px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 220px', maxWidth: 340, position: 'relative' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="FILTER MODEL OR ACCOUNT..."
            autoComplete="off"
            aria-label="Filter active models and recent requests"
            style={{
              width: '100%',
              padding: '6px 26px 6px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              background: 'var(--theme-canvas-subtle)',
              border: '1px solid var(--theme-border)',
              borderRadius: 'var(--radius-sm, 4px)',
              color: 'var(--theme-text)',
              outline: 'none',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 8,
                background: 'transparent',
                border: 'none',
                color: 'var(--theme-text-muted)',
                cursor: 'pointer',
                fontSize: 12,
              }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--theme-text-muted)' }}>
            Provider:
          </span>
          <button
            type="button"
            onClick={() => setProviderFilter('all')}
            style={{
              padding: '3px 8px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              textTransform: 'uppercase',
              borderRadius: 'var(--radius-sm, 4px)',
              border: providerFilter === 'all' ? '1px solid var(--theme-orange)' : '1px solid var(--theme-border)',
              background: providerFilter === 'all' ? 'var(--theme-orange-tint, rgba(255, 107, 0, 0.12))' : 'transparent',
              color: providerFilter === 'all' ? 'var(--theme-orange)' : 'var(--theme-text-muted)',
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {uniqueProviders.map((p) => (
            <button
              key={`provider-filter-${p}`}
              type="button"
              onClick={() => setProviderFilter(p)}
              style={{
                padding: '3px 8px',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                textTransform: 'uppercase',
                borderRadius: 'var(--radius-sm, 4px)',
                border: providerFilter === p ? '1px solid var(--theme-orange)' : '1px solid var(--theme-border)',
                background: providerFilter === p ? 'var(--theme-orange-tint, rgba(255, 107, 0, 0.12))' : 'transparent',
                color: providerFilter === p ? 'var(--theme-orange)' : 'var(--theme-text-muted)',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="live-models-main-grid">
        <div className="pp-card live-models-card">
          <div className="live-models-card-header">
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', margin: 0, letterSpacing: '0.02em' }}>
              Active Models In Flight ({filteredActive.length})
            </h3>
            {totalCount > 0 && (
              <span className="live-model-count tabular-nums" style={{ fontSize: 11 }}>
                {totalCount} total request{totalCount === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="live-models-card-body">
            {filteredActive.length === 0 ? (
              <div className="live-models-empty-state">
                <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>⚡</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--theme-text-main)', marginBottom: 4 }}>
                  {activeModels.length === 0
                    ? 'No active model requests in flight at this moment.'
                    : 'No active models match the selected filter.'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--theme-text-muted)' }}>
                  {activeModels.length === 0
                    ? 'Incoming requests from 9Router will appear here in real time.'
                    : 'Try resetting the search or provider filter.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredActive.map((item, idx) => {
                  const pct = totalCount > 0 ? Math.round((item.count / totalCount) * 100) : 0;
                  return (
                    <div
                      key={`active-view-${item.model}-${item.provider}-${idx}`}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: 'var(--theme-canvas-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--theme-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--theme-text-main)' }}>
                              {item.model}
                            </span>
                            <span
                              className="acc-tag"
                              style={{
                                background: 'var(--theme-dark)',
                                color: '#fff',
                                padding: '2px 6px',
                                borderRadius: 3,
                                fontSize: 11,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                              }}
                            >
                              {item.provider}
                            </span>
                          </div>
                          {item.account && (
                            <div style={{ fontSize: 12, color: 'var(--theme-text-muted)', marginTop: 4 }}>
                              Account: {maskEmail(item.account)}
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span className="live-model-count tabular-nums" style={{ fontSize: 14, fontWeight: 700 }}>
                            {item.count} req{item.count === 1 ? '' : 's'}
                          </span>
                          <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
                            {pct}% share
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          height: 4,
                          width: '100%',
                          backgroundColor: 'var(--theme-border)',
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            backgroundColor: 'var(--theme-orange)',
                            borderRadius: 2,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="pp-card live-models-card">
          <div className="live-models-card-header">
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', margin: 0, letterSpacing: '0.02em' }}>
              Recently Completed Stream ({filteredRecent.length})
            </h3>
            {accumulatedRecent.length > 0 && (
              <button
                type="button"
                onClick={() => setAccumulatedRecent([])}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 11,
                  color: 'var(--theme-text-muted)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear log
              </button>
            )}
          </div>

          <div className="live-models-card-body">
            {filteredRecent.length === 0 ? (
              <div className="live-models-empty-state">
                <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>📋</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--theme-text-main)', marginBottom: 4 }}>
                  No recently completed requests recorded yet.
                </div>
                <div style={{ fontSize: 12, color: 'var(--theme-text-muted)' }}>
                  Completed stream frames will be logged here with status and timestamps.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredRecent.map((item, idx) => (
                  <div
                    key={`recent-view-${item.model}-${item.provider}-${idx}-${item.timestamp || ''}`}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--theme-canvas-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--theme-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: 'var(--theme-text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.model}
                      </div>
                      {/* ponytail: fixed two-line row - line 2 always holds provider + account */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, minWidth: 0 }}>
                        <span
                          className="acc-tag"
                          style={{
                            background: 'var(--theme-dark)',
                            color: '#fff',
                            padding: '1px 5px',
                            borderRadius: 3,
                            fontSize: 10,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            flexShrink: 1,
                            minWidth: 0,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.provider}
                        </span>
                        {item.account && (
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--theme-text-muted)',
                              flexShrink: 2,
                              minWidth: 0,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {maskEmail(item.account)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          backgroundColor: item.status === 'error' ? 'var(--theme-red-tint)' : 'var(--theme-green-tint)',
                          color: item.status === 'error' ? 'var(--theme-red)' : 'var(--theme-green)',
                        }}
                      >
                        {item.status || 'done'}
                      </span>
                      {item.timestamp && (
                        <div
                          style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}
                          className="tabular-nums"
                          title={new Date(item.timestamp).toLocaleString()}
                        >
                          {getRelativeTime(item.timestamp)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="pp-card live-models-footer"
        style={{
          padding: '8px 14px',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: 12,
          color: 'var(--theme-text-muted)',
        }}
      >
        <span>
          SSE Stream: <strong>{status}</strong>
          {connectedAt ? ` (connected ${new Date(connectedAt).toLocaleTimeString()})` : ''}
        </span>
        <span>
          {receivedAt ? `Last Event: ${new Date(receivedAt).toLocaleTimeString()}` : 'Awaiting stream frames…'}
        </span>
      </div>
    </div>
  );
}
