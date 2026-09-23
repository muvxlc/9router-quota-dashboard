export { getLiveStatusMeta, formatLiveTimestamp } from './formatters.js';

export function aggregateLiveModels(models) {
  if (!Array.isArray(models) || models.length === 0) {
    return { totalCount: 0, models: [] };
  }

  let totalCount = 0;
  const list = [];
  for (const m of models) {
    if (!m) continue;
    const count = typeof m.count === 'number' && m.count > 0 ? m.count : 0;
    totalCount += count;
    list.push({
      model: m.model || 'Unknown',
      provider: m.provider || 'Other',
      account: m.account || '',
      count,
    });
  }

  list.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.model.localeCompare(b.model);
  });

  return { totalCount, models: list };
}

export function formatLiveStatusLabel(status) {
  switch (status) {
    case 'connecting':
      return 'Connecting…';
    case 'connected':
      return 'Connected';
    case 'live':
      return 'Live';
    case 'idle':
      return 'No active requests';
    case 'disconnected':
      return 'Connection paused';
    case 'unauthenticated':
      return 'Session expired';
    case 'error':
    default:
      return 'Live updates unavailable';
  }
}

export function createLiveModelsSubscription(options = {}) {
  const {
    url = '/api/live-models',
    authProbeUrl = '/api/auth/status',
    EventSourceClass = typeof window !== 'undefined' ? window.EventSource : undefined,
    fetchFn = typeof fetch !== 'undefined' ? fetch : undefined,
    documentRef = typeof document !== 'undefined' ? document : undefined,
    windowRef = typeof window !== 'undefined' ? window : undefined,
    initialBackoffMs = 1000,
    maxBackoffMs = 30000,
    onSessionLoss = () => {},
    onUpdate = () => {},
  } = options;

  let es = null;
  let retryTimer = null;
  let probeController = null;
  let currentBackoff = initialBackoffMs;
  let unsubscribed = false;
  let state = {
    status: 'connecting',
    activeModels: [],
    totalCount: 0,
    receivedAt: null,
    connectedAt: null,
  };

  const emit = (partial) => {
    state = { ...state, ...partial };
    onUpdate(state);
  };

  const isVisibleAndOnline = () => {
    const visible = documentRef ? documentRef.visibilityState !== 'hidden' : true;
    const online = windowRef?.navigator ? windowRef.navigator.onLine !== false : true;
    return visible && online;
  };

  const cleanupConnection = () => {
    if (retryTimer) {
      if (windowRef?.clearTimeout) windowRef.clearTimeout(retryTimer);
      else clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (probeController) {
      probeController.abort();
      probeController = null;
    }
    if (es) {
      es.close();
      es = null;
    }
  };

  const handleDataPayload = (data) => {
    if (!data) return;
    if (data.status === 'unauthenticated') {
      unsubscribed = true;
      cleanupConnection();
      emit({
        status: 'unauthenticated',
        activeModels: [],
        totalCount: 0,
        connectedAt: null,
        receivedAt: data.receivedAt || new Date().toISOString(),
      });
      onSessionLoss();
      return;
    }

    if (typeof data.status === 'string') {
      const isLive = data.status === 'live';
      const status = data.status === 'idle' || data.status === 'disconnected' || data.status === 'error'
        ? data.status
        : (isLive ? 'live' : 'idle');
      const isDown = status === 'disconnected' || status === 'error';
      emit({
        status,
        receivedAt: data.receivedAt || new Date().toISOString(),
        activeModels: status === 'live' ? state.activeModels : [],
        totalCount: status === 'live' ? state.totalCount : 0,
        connectedAt: isDown ? null : (state.connectedAt || new Date().toISOString()),
      });
      return;
    }

    const { totalCount, models } = aggregateLiveModels(data.activeModels);
    emit({
      status: totalCount > 0 ? 'live' : 'idle',
      activeModels: models,
      totalCount,
      receivedAt: data.receivedAt || new Date().toISOString(),
      connectedAt: state.connectedAt || new Date().toISOString(),
    });
  };

  const probeAuthAndRecover = async () => {
    if (unsubscribed) return;
    if (!fetchFn) {
      scheduleRetry();
      return;
    }
    try {
      if (probeController) probeController.abort();
      probeController = new AbortController();
      const res = await fetchFn(authProbeUrl, {
        signal: probeController.signal,
        credentials: 'same-origin',
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body && body.authenticated === false) {
          unsubscribed = true;
          cleanupConnection();
          emit({ status: 'unauthenticated', activeModels: [], totalCount: 0, connectedAt: null });
          onSessionLoss();
          return;
        }
      }
    } catch {
      // network timeout or abort
    }
    if (!unsubscribed) {
      scheduleRetry();
    }
  };

  const connect = () => {
    if (unsubscribed) return;
    cleanupConnection();

    if (!isVisibleAndOnline()) {
      emit({ status: 'disconnected', activeModels: [], totalCount: 0, connectedAt: null });
      return;
    }

    if (!EventSourceClass) {
      emit({ status: 'error', activeModels: [], totalCount: 0, connectedAt: null });
      return;
    }

    try {
      es = new EventSourceClass(url);
    } catch {
      emit({ status: 'error', activeModels: [], totalCount: 0, connectedAt: null });
      scheduleRetry();
      return;
    }

    es.onopen = () => {
      currentBackoff = initialBackoffMs;
      const nextStatus = state.totalCount > 0 ? 'live' : 'idle';
      emit({
        status: nextStatus,
        connectedAt: state.connectedAt || new Date().toISOString(),
      });
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        handleDataPayload(parsed);
      } catch {
        // ignore parse error
      }
    };

    es.addEventListener('status', (event) => {
      try {
        const parsed = JSON.parse(event.data);
        handleDataPayload(parsed);
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      cleanupConnection();
      emit({ status: 'error', activeModels: [], totalCount: 0, connectedAt: null });
      probeAuthAndRecover();
    };
  };

  const scheduleRetry = () => {
    if (unsubscribed || retryTimer) return;
    const delay = Math.min(currentBackoff, maxBackoffMs);
    currentBackoff = Math.min(currentBackoff * 2, maxBackoffMs);
    const setT = windowRef?.setTimeout || setTimeout;
    retryTimer = setT(() => {
      retryTimer = null;
      if (!unsubscribed && isVisibleAndOnline()) {
        emit({ status: 'connecting', connectedAt: null });
        connect();
      }
    }, delay);
  };

  const handleVisibility = () => {
    if (unsubscribed) return;
    if (isVisibleAndOnline()) {
      emit({ status: 'connecting', connectedAt: null });
      connect();
    } else {
      cleanupConnection();
      emit({ status: 'disconnected', activeModels: [], totalCount: 0, connectedAt: null });
    }
  };

  if (documentRef?.addEventListener) {
    documentRef.addEventListener('visibilitychange', handleVisibility);
  }
  if (windowRef?.addEventListener) {
    windowRef.addEventListener('online', handleVisibility);
    windowRef.addEventListener('offline', handleVisibility);
  }

  emit({ status: 'connecting', connectedAt: null });
  connect();

  return {
    unsubscribe: () => {
      unsubscribed = true;
      cleanupConnection();
      if (documentRef?.removeEventListener) {
        documentRef.removeEventListener('visibilitychange', handleVisibility);
      }
      if (windowRef?.removeEventListener) {
        windowRef.removeEventListener('online', handleVisibility);
        windowRef.removeEventListener('offline', handleVisibility);
      }
    },
    getState: () => state,
  };
}
