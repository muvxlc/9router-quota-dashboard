'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  fetchAllConnections,
  fetchQuotaWithCadence,
  runWithConcurrency,
  SessionExpiredError,
} from './api.js';

export function isQuotaFresher(incoming, current) {
  if (!incoming || !incoming.connectionId) return false;
  if (!current || !current.receivedAt) return true;
  if (!incoming.receivedAt) return true;
  const currentTime = new Date(current.receivedAt).getTime();
  const incomingTime = new Date(incoming.receivedAt).getTime();
  if (Number.isNaN(incomingTime) || Number.isNaN(currentTime)) return true;
  return incomingTime >= currentTime;
}

export function applyMonotonicQuota(prevQuotas, incomingQuota) {
  if (!incomingQuota || !incomingQuota.connectionId) return prevQuotas;
  const current = prevQuotas[incomingQuota.connectionId];
  if (current && !isQuotaFresher(incomingQuota, current)) {
    return prevQuotas;
  }
  return {
    ...prevQuotas,
    [incomingQuota.connectionId]: incomingQuota,
  };
}

export function useQuotaData() {
  const [connections, setConnections] = useState([]);
  const [quotas, setQuotas] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [accountRefreshing, setAccountRefreshing] = useState({});

  const abortRef = useRef(null);
  const quotasRef = useRef(quotas);

  useEffect(() => {
    quotasRef.current = quotas;
  }, [quotas]);

  const resetData = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setConnections([]);
    setQuotas({});
    setLastSyncAt(null);
  }, []);

  const loadData = useCallback(async (forceRefresh = false, onSessionLoss = null) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setRefreshing(true);
    try {
      const conns = await fetchAllConnections({
        signal,
        onPageBatch: (batch) => {
          if (signal.aborted) return;
          setConnections((prev) => {
            const seen = new Set(prev.map((c) => c.id));
            const added = batch.filter((b) => !seen.has(b.id));
            return [...prev, ...added];
          });
        },
      });
      if (signal.aborted) return;
      setConnections(conns);
      setLastSyncAt(new Date().toISOString());

      const quotaTasks = conns.map((conn) => async () => {
        if (signal.aborted) return null;
        try {
          return await fetchQuotaWithCadence({
            connectionId: conn.id,
            cachedQuota: quotasRef.current[conn.id] || null,
            force: forceRefresh,
            signal,
          });
        } catch (err) {
          if (err instanceof SessionExpiredError) throw err;
          return null;
        }
      });

      // ponytail: stream quota results progressively with monotonic timestamp guard
      await runWithConcurrency(quotaTasks, 4, (q) => {
        if (signal.aborted || !q || !q.connectionId) return;
        setQuotas((prev) => applyMonotonicQuota(prev, q));
      });
    } catch (err) {
      if (err instanceof SessionExpiredError && onSessionLoss) {
        onSessionLoss();
      }
    } finally {
      if (!signal.aborted) {
        setRefreshing(false);
      }
    }
  }, []);

  const refreshAccountQuota = useCallback(async (connectionId, onSessionLoss = null) => {
    if (!connectionId) return { success: false, error: new Error('connectionId required') };
    setAccountRefreshing((prev) => ({ ...prev, [connectionId]: true }));
    try {
      const cached = quotasRef.current[connectionId] || null;
      const res = await fetchQuotaWithCadence({
        connectionId,
        cachedQuota: cached,
        force: true,
      });
      if (res && res.connectionId) {
        setQuotas((prev) => applyMonotonicQuota(prev, res));
        return { success: true, quota: res, rateLimited: Boolean(res.rateLimited) };
      }
      return { success: false, quota: null };
    } catch (err) {
      if (err instanceof SessionExpiredError && onSessionLoss) {
        onSessionLoss();
      }
      return { success: false, error: err };
    } finally {
      setAccountRefreshing((prev) => {
        const next = { ...prev };
        delete next[connectionId];
        return next;
      });
    }
  }, []);

  return {
    connections,
    setConnections,
    quotas,
    setQuotas,
    refreshing,
    lastSyncAt,
    setLastSyncAt,
    accountRefreshing,
    refreshAccountQuota,
    loadData,
    resetData,
  };
}
