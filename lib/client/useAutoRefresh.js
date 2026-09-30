'use client';

import { useEffect, useRef } from 'react';

export function useAutoRefresh({
  intervalSec = 0,
  lastSyncAt = null,
  onRefresh,
  enabled = true,
  refreshing = false,
}) {
  const refreshingRef = useRef(refreshing);
  const onRefreshRef = useRef(onRefresh);
  const lastSyncAtRef = useRef(lastSyncAt);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    lastSyncAtRef.current = lastSyncAt;
  }, [lastSyncAt]);

  useEffect(() => {
    if (!enabled || !intervalSec || intervalSec <= 0 || typeof window === 'undefined') {
      return;
    }

    let timer = null;

    const scheduleTick = (delayMs) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!refreshingRef.current && typeof onRefreshRef.current === 'function') {
          onRefreshRef.current();
        }
      }, Math.max(0, delayMs));
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;

      if (document.visibilityState === 'hidden') {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      } else if (document.visibilityState === 'visible') {
        const lastSyncTime = lastSyncAtRef.current ? new Date(lastSyncAtRef.current).getTime() : 0;
        const elapsedMs = Date.now() - lastSyncTime;
        const intervalMs = intervalSec * 1000;

        if (elapsedMs >= intervalMs) {
          if (!refreshingRef.current && typeof onRefreshRef.current === 'function') {
            onRefreshRef.current();
          }
        } else {
          scheduleTick(intervalMs - elapsedMs);
        }
      }
    };

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      scheduleTick(intervalSec * 1000);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [intervalSec, enabled, lastSyncAt]);
}
