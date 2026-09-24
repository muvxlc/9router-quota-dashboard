'use client';

import { useEffect, useRef } from 'react';
import { maskEmail } from '../../lib/client/selectors.js';

export default function LiveModelsModal({
  activeModels = [],
  recentRequests = [],
  totalCount = 0,
  status,
  receivedAt,
  onClose,
}) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [onClose]);

  if (!activeModels) return null;

  return (
    <div
      className="quota-modal-backdrop is-open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-models-title"
      onClick={onClose}
    >
      <div className="quota-modal" onClick={(e) => e.stopPropagation()}>
        <div className="quota-modal-header">
          <div>
            <h2 id="live-models-title" className="quota-modal-title">
              Live Models
            </h2>
            <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)' }}>
              {totalCount} active request{totalCount === 1 ? '' : 's'} across {activeModels.length} model{activeModels.length === 1 ? '' : 's'}
            </span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close live models detail"
          >
            ✕
          </button>
        </div>

        <div className="quota-modal-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--theme-text-muted)' }}>
              Active ({activeModels.length})
            </span>
          </div>

          {activeModels.length === 0 ? (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--theme-canvas-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--theme-text-muted)',
                fontSize: 13,
                textAlign: 'center',
                marginBottom: 14,
              }}
            >
              No active model requests at this moment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {activeModels.map((item, idx) => (
                <div
                  key={`active-modal-${item.model}-${item.provider}-${idx}`}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--theme-text-main)' }}>
                        {item.model}
                      </span>
                      <span
                        className="acc-tag"
                        style={{
                          background: 'var(--theme-dark)',
                          color: '#fff',
                          padding: '1px 5px',
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
                      <div style={{ fontSize: 12, color: 'var(--theme-text-muted)', marginTop: 2 }}>
                        Account: {maskEmail(item.account)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="live-model-count tabular-nums">
                      {item.count} req{item.count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--theme-text-muted)' }}>
              Recently completed ({recentRequests.length})
            </span>
          </div>

          {recentRequests.length === 0 ? (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--theme-canvas-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--theme-text-muted)',
                fontSize: 13,
                textAlign: 'center',
                marginBottom: 14,
              }}
            >
              No recently completed requests.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {recentRequests.slice(0, 3).map((item, idx) => (
                <div
                  key={`recent-modal-${item.model}-${item.provider}-${idx}`}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--theme-text-main)' }}>
                        {item.model}
                      </span>
                      <span
                        className="acc-tag"
                        style={{
                          background: 'var(--theme-dark)',
                          color: '#fff',
                          padding: '1px 5px',
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
                      <div style={{ fontSize: 12, color: 'var(--theme-text-muted)', marginTop: 2 }}>
                        Account: {maskEmail(item.account)}
                      </div>
                    )}
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
                      <div style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 2 }} className="tabular-nums">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--theme-border)',
              paddingTop: 12,
              fontSize: 12,
              color: 'var(--theme-text-muted)',
            }}
          >
            <span>Status: {status}</span>
            <span>{receivedAt ? `Received: ${new Date(receivedAt).toLocaleTimeString()}` : ''}</span>
          </div>

          <button
            type="button"
            className="btn-orange-cta"
            style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
