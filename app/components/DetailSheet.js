'use client';

import { useState, useEffect, useRef } from 'react';
import StatusPill from './StatusPill.js';
import {
  formatPercent,
  formatUnits,
  formatExactDate,
  maskEmail,
  computeResetCountdown,
  useCentralClock,
} from '../../lib/client/selectors.js';

export default function DetailSheet({
  account,
  onClose,
  onRefreshQuota,
  isRefreshingQuota = false,
  onToggleGovernor,
  isTogglingGovernor = false,
}) {
  const previousFocusRef = useRef(null);
  const nowMs = useCentralClock();
  const [cooldownSec, setCooldownSec] = useState(0);
  const [governorState, setGovernorState] = useState(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [onClose]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setInterval(() => {
      setCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    if (typeof timer?.unref === 'function') {
      timer.unref();
    }
    return () => clearInterval(timer);
  }, [cooldownSec]);

  if (!account) return null;

  const { id, provider, active, quota, effectiveStatus } = account;
  const alias = account.displayAlias || account.label || id;
  const maskedIdentity = account.maskedIdentity || maskEmail(id);
  const shortId = account.shortId || (id.length > 12 ? `${id.slice(0, 8)}...` : id);
  const windows = Array.isArray(quota?.windows) ? quota.windows : [];

  const currentActive = governorState !== null ? governorState.active : (account.overrideActive ?? active);
  const mode = governorState?.mode || (account.isOverride ? 'simulated' : null);
  const notice = governorState?.notice || null;

  const handleRefresh = async () => {
    if (!onRefreshQuota || isRefreshingQuota || cooldownSec > 0) return;
    const res = await onRefreshQuota(id);
    if (res?.rateLimited || res?.error?.status === 429) {
      setCooldownSec(5);
    }
  };

  const handleGovernorToggle = async (e) => {
    const nextActive = e.target.checked;
    if (!onToggleGovernor) {
      setGovernorState({ active: nextActive, mode: 'simulated', notice: 'Dashboard Override (Router Read-Only)' });
      return;
    }
    const res = await onToggleGovernor(id, nextActive);
    if (res && res.success) {
      setGovernorState({ active: res.active, mode: res.mode, notice: res.notice });
    }
  };

  return (
    <div
      className="quota-modal-backdrop is-open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-title"
      onClick={onClose}
    >
      <div className="quota-modal" onClick={(e) => e.stopPropagation()}>
        <div className="quota-modal-header">
          <div id="sheet-title" className="quota-modal-title">
            {alias} · Full Details
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        <div className="quota-modal-body">
          <div className="modal-detail-row">
            <span className="label">Pool Identity</span>
            <span className="val">{maskedIdentity}</span>
          </div>

          <div className="modal-detail-row">
            <span className="label">Connection ID</span>
            <span className="val">{shortId}</span>
          </div>

          <div className="modal-detail-row">
            <span className="label">Provider</span>
            <span className="val" style={{ textTransform: 'capitalize' }}>{provider}</span>
          </div>

          <div className="modal-detail-row">
            <span className="label">Status</span>
            <span className="val" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <StatusPill statusObj={effectiveStatus} suppressAvailable={false} />
              {!currentActive && <span className="pp-tag-disabled">Disabled</span>}
            </span>
          </div>

          <div className="modal-detail-row" style={{ alignItems: 'center' }}>
            <span className="label">Quota Refresh</span>
            <div className="val" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn-orange-cta"
                style={{ padding: '4px 10px', fontSize: 12 }}
                disabled={isRefreshingQuota || cooldownSec > 0}
                onClick={handleRefresh}
                data-testid="refresh-account-quota-btn"
              >
                {isRefreshingQuota ? 'Refreshing…' : cooldownSec > 0 ? `Wait ${cooldownSec}s` : 'Refresh Quota'}
              </button>
              {cooldownSec > 0 && (
                <span style={{ fontSize: 11, color: 'var(--theme-amber)' }}>
                  Rate limited (5s cooldown)
                </span>
              )}
            </div>
          </div>

          <div className="modal-detail-row" style={{ alignItems: 'center' }}>
            <span className="label">Governor Active</span>
            <div className="val" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={currentActive}
                  disabled={isTogglingGovernor}
                  onChange={handleGovernorToggle}
                  data-testid="governor-active-toggle"
                />
                <span style={{ fontSize: 13, fontWeight: 500 }}>
                  {currentActive ? 'Active' : 'Disabled'}
                </span>
              </label>
              {mode && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: mode === 'simulated' ? 'var(--theme-amber-tint, #fef3c7)' : 'var(--theme-green-tint, #dcfce7)',
                    color: mode === 'simulated' ? 'var(--theme-amber, #b45309)' : 'var(--theme-green, #15803d)',
                    border: `1px solid ${mode === 'simulated' ? 'var(--theme-amber, #b45309)' : 'var(--theme-green, #15803d)'}`,
                  }}
                  data-testid="governor-mode-badge"
                >
                  {mode === 'simulated' ? 'Dashboard Override (Router Read-Only)' : 'Upstream Managed'}
                </span>
              )}
            </div>
          </div>
          {notice && (
            <div className="modal-detail-row" style={{ marginTop: -4 }}>
              <span className="label"></span>
              <span style={{ fontSize: 11, color: 'var(--theme-amber)' }}>{notice}</span>
            </div>
          )}

          {quota?.plan && (
            <div className="modal-detail-row">
              <span className="label">Plan</span>
              <span className="val">{quota.plan}</span>
            </div>
          )}

          {windows.map((w, idx) => {
            const cd = computeResetCountdown(w.resetAt, nowMs, { unlimited: w.unlimited });
            return (
              <div key={w.key || idx} className="modal-detail-row">
                <span className="label">{w.label || w.key}</span>
                <div style={{ textAlign: 'right' }}>
                  <div className="val tabular-nums" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <span>{formatPercent(w.remainingPercent, w.unlimited)} remaining</span>
                    {w.resetAt && cd.text !== '—' && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '1px 6px',
                          borderRadius: 4,
                          backgroundColor: cd.status === 'due' ? 'var(--theme-red-tint, #fee2e2)' : 'var(--theme-canvas-subtle)',
                          color: cd.status === 'due' ? 'var(--theme-red)' : 'var(--theme-text-muted)',
                        }}
                      >
                        {cd.text}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
                    {formatUnits(w.used, w.total, w.unit)}
                    {w.resetAt ? ` · Reset: ${formatExactDate(w.resetAt)}` : ''}
                  </div>
                </div>
              </div>
            );
          })}

          {windows.length === 0 && quota?.reason && (
            <div className="modal-detail-row">
              <span className="label">Notice</span>
              <span className="val">{quota.reason}</span>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn-orange-cta"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={onClose}
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
