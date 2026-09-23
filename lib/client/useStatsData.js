'use client';

import { useState, useCallback } from 'react';
import { fetchStats, SessionExpiredError } from './api.js';

export function useStatsData(onSessionLoss) {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [statsPeriod, setStatsPeriod] = useState('24h');

  const loadStats = useCallback(
    async (period) => {
      setStatsLoading(true);
      setStatsError('');
      try {
        const data = await fetchStats(fetch, period);
        setStats(data);
      } catch (err) {
        if (err instanceof SessionExpiredError) {
          if (onSessionLoss) onSessionLoss();
        } else {
          setStatsError(err.message || 'Failed to fetch usage stats');
        }
      } finally {
        setStatsLoading(false);
      }
    },
    [onSessionLoss]
  );

  return {
    stats,
    setStats,
    statsLoading,
    statsError,
    statsPeriod,
    setStatsPeriod,
    loadStats,
  };
}
