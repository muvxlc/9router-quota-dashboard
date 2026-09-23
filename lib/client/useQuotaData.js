'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  fetchAllConnections,
  fetchQuotaWithCadence,
  runWithConcurrency,
  SessionExpiredError,
} from './api.js';

export function useQuotaData() {
  const [connections, setConnections] = useState([]);
  const [quotas, setQuotas] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);

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

      const quotaResults = await runWithConcurrency(quotaTasks, 4);
      if (signal.aborted) return;

      setQuotas((prev) => {
        const next = { ...prev };
        for (const q of quotaResults) {
          if (q && q.connectionId) {
            next[q.connectionId] = q;
          }
        }
        return next;
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

  return {
    connections,
    setConnections,
    quotas,
    setQuotas,
    refreshing,
    lastSyncAt,
    setLastSyncAt,
    loadData,
    resetData,
  };
}
