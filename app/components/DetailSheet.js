'use client';

import { useEffect, useRef } from 'react';
import StatusPill from './StatusPill.js';
import { formatPercent, formatUnits, formatExactDate, maskEmail } from '../../lib/client/selectors.js';

export default function DetailSheet({ account, onClose }) {
  const previousFocusRef = useRef(null);

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

  if (!account) return null;

  const { id, provider, active, quota, effectiveStatus } = account;
  const alias = account.displayAlias || account.label || id;
  const maskedIdentity = account.maskedIdentity || maskEmail(id);
  const shortId = account.shortId || (id.length > 12 ? `${id.slice(0, 8)}...` : id);
  const windows = Array.isArray(quota?.windows) ? quota.windows : [];

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
              {!active && <span className="pp-tag-disabled">Disabled</span>}
            </span>
          </div>

          {quota?.plan && (
            <div className="modal-detail-row">
              <span className="label">Plan</span>
              <span className="val">{quota.plan}</span>
            </div>
          )}

          {windows.map((w, idx) => (
            <div key={w.key || idx} className="modal-detail-row">
              <span className="label">{w.label || w.key}</span>
              <div style={{ textAlign: 'right' }}>
                <div className="val tabular-nums">
                  {formatPercent(w.remainingPercent, w.unlimited)} remaining
                </div>
                <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }}>
                  {formatUnits(w.used, w.total, w.unit)}
                  {w.resetAt ? ` · Reset: ${formatExactDate(w.resetAt)}` : ''}
                </div>
              </div>
            </div>
          ))}

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
