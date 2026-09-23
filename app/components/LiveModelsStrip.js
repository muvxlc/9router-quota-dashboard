'use client';

import { useState, useEffect } from 'react';
import {
  createLiveModelsSubscription,
  formatLiveStatusLabel,
  formatLiveTimestamp,
  getLiveStatusMeta,
} from '../../lib/client/liveModels.js';
import { maskEmail } from '../../lib/client/selectors.js';
import LiveModelsModal from './LiveModelsModal.js';

export default function LiveModelsStrip({
  url = '/api/live-models',
  onSessionLoss = () => {},
  customSubscription = null,
}) {
  const [state, setState] = useState({
    status: 'connecting',
    activeModels: [],
    totalCount: 0,
    receivedAt: null,
    connectedAt: null,
  });
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (customSubscription) {
      return customSubscription(setState);
    }
    const sub = createLiveModelsSubscription({
      url,
      onSessionLoss,
      onUpdate: (next) => setState(next),
    });
    return () => sub.unsubscribe();
  }, [url, onSessionLoss, customSubscription]);

  const { status, activeModels, totalCount, receivedAt, connectedAt } = state;
  const visibleModels = activeModels.slice(0, 3);
  const remainingCount = activeModels.length - visibleModels.length;

  const statusMeta = getLiveStatusMeta(status, totalCount);

  return (
    <>
      <div
        className="live-activity-bar"
        aria-label="Live models activity"
        aria-live="polite"
      >
        <div className="live-activity-left">
          <div className="live-beacon">
            <span
              className="live-beacon-dot"
              aria-hidden="true"
            />
            <span>Live Models</span>
          </div>

          <div className="live-model-chips" role="list">
            {status === 'live' && visibleModels.length > 0 ? (
              visibleModels.map((item, idx) => (
                <div
                  key={`${item.model}-${item.provider}-${idx}`}
                  className="model-chip"
                  role="listitem"
                  title={`${item.model} (${item.provider}): ${item.count} in flight`}
                >
                  <span>{item.model}</span>
                  {(item.account || item.provider) && (
                    <span className="acc-tag">
                      {item.account ? maskEmail(item.account).split('@')[0] : item.provider}
                    </span>
                  )}
                  {item.count > 1 && (
                    <span className="live-model-count tabular-nums">{item.count}</span>
                  )}
                </div>
              ))
            ) : (
              <span style={{ fontSize: 12, color: 'var(--theme-text-muted)' }}>
                {status === 'live' ? 'No active models in flight' : formatLiveStatusLabel(status)}
              </span>
            )}

            {remainingCount > 0 && (
              <button
                type="button"
                className="live-more-btn"
                onClick={() => setShowModal(true)}
                aria-label={`View ${remainingCount} more active models`}
              >
                +{remainingCount} more
              </button>
            )}
          </div>
        </div>

        <div className="live-activity-center">
          <span className={`status-pill ${statusMeta.pillClass}`}>{statusMeta.text}</span>
          <span>Live Stream Monitor</span>
        </div>

        <div className="live-activity-right">
          <span>{totalCount} active request{totalCount === 1 ? '' : 's'}</span>
          <span
            className="live-strip-time tabular-nums"
            aria-label={
              status === 'disconnected' || status === 'error'
                ? `Connection ${status}. ${receivedAt ? `Last data received ${formatLiveTimestamp(receivedAt, { status, connectedAt })}` : 'No data received.'}`
                : `Live stream ${formatLiveTimestamp(receivedAt, { status, connectedAt })}`
            }
          >
            {formatLiveTimestamp(receivedAt, { status, connectedAt })}
          </span>
          {activeModels.length > 0 && (
            <button
              type="button"
              className="live-view-all-btn"
              onClick={() => setShowModal(true)}
              aria-label="View all active model requests"
            >
              View all ↗
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <LiveModelsModal
          activeModels={activeModels}
          totalCount={totalCount}
          status={status}
          receivedAt={receivedAt}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
