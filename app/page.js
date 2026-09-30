'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from './components/Header.js';
import LiveModelsStrip from './components/LiveModelsStrip.js';
import QuotaTable from './components/QuotaTable.js';
import UsageView from './components/UsageView.js';
import DetailSheet from './components/DetailSheet.js';
import LoginModal from './components/LoginModal.js';
import { fetchAuthStatus, loginWithPassword, logout, SessionExpiredError, toggleConnectionGovernor } from '../lib/client/api.js';
import { groupAccountsByProvider, filterAndSortAccounts, buildAccountPresentation, maskEmail, deriveAccountStatus, getAccountEffectiveRemainingPct } from '../lib/client/selectors.js';
import { useTheme } from '../lib/client/useTheme.js';
import { useQuotaData } from '../lib/client/useQuotaData.js';
import { useStatsData } from '../lib/client/useStatsData.js';
import { useAutoRefresh } from '../lib/client/useAutoRefresh.js';
import {
  checkAccountsForAlerts,
  requestNotificationPermission,
  getNotificationPermission,
} from '../lib/client/alerts.js';
import { exportCsv, exportJson } from '../lib/client/exportSnapshot.js';

export default function DashboardPage() {
  const [auth, setAuth] = useState({ authenticated: false, loginMode: 'password', checking: true });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('quotas');
  const { theme, toggleTheme } = useTheme();

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('active');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('remainingPct');
  const [sortOrder, setSortOrder] = useState('asc');
  const [expandedProviders, setExpandedProviders] = useState({});

  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const authMountAbortRef = useRef(null);
  const alertedIncidentsRef = useRef(new Map());

  const [cadence, setCadence] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('quota_refresh_interval');
      if (saved && ['off', '15s', '30s', '60s', '5m'].includes(saved)) {
        return saved;
      }
    }
    return 'off';
  });

  const [notificationPermission, setNotificationPermission] = useState(() => {
    return getNotificationPermission();
  });

  const handleCadenceChange = (val) => {
    setCadence(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('quota_refresh_interval', val);
    }
  };

  const handleRequestNotificationPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
  };

  const intervalSec = useMemo(() => {
    switch (cadence) {
      case '15s': return 15;
      case '30s': return 30;
      case '60s': return 60;
      case '5m': return 300;
      default: return 0;
    }
  }, [cadence]);

  const {
    connections,
    setConnections,
    quotas,
    refreshing,
    lastSyncAt,
    accountRefreshing,
    refreshAccountQuota,
    loadData,
    resetData,
  } = useQuotaData();

  const handleSessionLoss = useCallback(() => {
    if (authMountAbortRef.current) authMountAbortRef.current.abort();
    setAuth({ authenticated: false, loginMode: 'password', checking: false });
    resetData();
    setSelectedAccountId(null);
  }, [resetData]);

  const [togglingGovernor, setTogglingGovernor] = useState(false);

  const handleToggleGovernor = useCallback(async (connectionId, active) => {
    setTogglingGovernor(true);
    try {
      const res = await toggleConnectionGovernor(connectionId, active);
      setConnections((prev) =>
        prev.map((c) => (c.id === connectionId ? { ...c, active: res.active, isOverride: res.mode === 'simulated' } : c))
      );
      return { success: true, ...res };
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        handleSessionLoss();
      }
      return { success: false, error: err };
    } finally {
      setTogglingGovernor(false);
    }
  }, [handleSessionLoss, setConnections]);

  const {
    stats,
    statsLoading,
    statsError,
    statsPeriod,
    setStatsPeriod,
    loadStats,
  } = useStatsData(handleSessionLoss);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    authMountAbortRef.current = controller;

    fetchAuthStatus(fetch, controller.signal)
      .then((statusRes) => {
        if (ignore) return;
        const isAuth = !!statusRes.authenticated;
        setAuth({
          authenticated: isAuth,
          loginMode: statusRes.loginMode || 'password',
          checking: false,
        });
        if (isAuth) {
          loadData(false, handleSessionLoss);
        }
      })
      .catch((err) => {
        if (ignore) return;
        if (err instanceof SessionExpiredError) {
          handleSessionLoss();
        } else {
          setAuth({ authenticated: false, loginMode: 'password', checking: false });
        }
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [handleSessionLoss, loadData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && auth.authenticated) {
        loadData(false, handleSessionLoss);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleVisibility);
    };
  }, [auth.authenticated, handleSessionLoss, loadData]);

  const handleLogin = async (password) => {
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await loginWithPassword(fetch, password);
      if (res.authenticated) {
        setAuth({ authenticated: true, loginMode: 'password', checking: false });
        loadData(false, handleSessionLoss);
      }
    } catch (err) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout(fetch);
    } catch {
      // ignore
    }
    handleSessionLoss();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'usage' && !stats && !statsLoading) {
      loadStats(statsPeriod);
    }
  };

  const handleResetFilters = useCallback(() => {
    setSearch('');
    setActiveFilter('active');
    setProviderFilter('all');
    setStatusFilter('all');
  }, []);

  const handleToggleExpandProvider = useCallback((providerKey) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerKey]: !prev[providerKey],
    }));
  }, []);

  const uniqueProviders = useMemo(() => {
    const seen = new Set();
    for (const c of connections) {
      if (c.provider) seen.add(c.provider.toLowerCase());
    }
    return Array.from(seen);
  }, [connections]);

  const presentationMap = useMemo(() => buildAccountPresentation(connections), [connections]);

  const presentedConnections = useMemo(() => {
    return connections.map((conn) => {
      const pres = presentationMap.get(conn.id) || {};
      const displayAlias = pres.alias || conn.label || conn.id;
      const maskedIdentity = pres.maskedIdentity || maskEmail(conn.label || conn.id);
      const shortId = pres.shortId || conn.id;
      return {
        ...conn,
        displayAlias,
        maskedIdentity,
        shortId,
        _searchTarget: `${conn.label || ''} ${conn.id || ''} ${conn.provider || ''} ${displayAlias} ${maskedIdentity}`.toLowerCase(),
      };
    });
  }, [connections, presentationMap]);

  // ponytail: single-pass memoized account enrichment; avoids double grouping and redundant status derivations on filter changes
  const enrichedAccounts = useMemo(() => {
    return presentedConnections.map((conn) => {
      const quota = quotas[conn.id] || null;
      const effectiveStatus = deriveAccountStatus(conn, quota);
      return {
        ...conn,
        quota,
        effectiveStatus,
        effectiveRemainingPct: getAccountEffectiveRemainingPct({ quota }),
      };
    });
  }, [presentedConnections, quotas]);

  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null;
    return enrichedAccounts.find((a) => a.id === selectedAccountId) || null;
  }, [enrichedAccounts, selectedAccountId]);

  useAutoRefresh({
    intervalSec,
    lastSyncAt,
    onRefresh: () => {
      if (activeTab === 'usage') loadStats(statsPeriod);
      else loadData(true, handleSessionLoss);
    },
    enabled: auth.authenticated && cadence !== 'off',
    refreshing: refreshing || statsLoading,
  });

  useEffect(() => {
    if (!auth.authenticated) return;
    const notifyFn = notificationPermission === 'granted' && typeof Notification !== 'undefined'
      ? (title, opts) => new Notification(title, opts)
      : null;
    checkAccountsForAlerts(enrichedAccounts, alertedIncidentsRef.current, notifyFn);
  }, [enrichedAccounts, notificationPermission, auth.authenticated]);

  const activeAlertsCount = useMemo(() => {
    let count = 0;
    for (const acc of enrichedAccounts) {
      if (acc.effectiveStatus?.status === 'exhausted' || (acc.effectiveStatus?.reason || acc.quota?.reason) === 'PROVIDER_AUTH_REQUIRED') {
        count++;
      }
    }
    return count;
  }, [enrichedAccounts]);

  const handleExportCsv = () => {
    exportCsv(enrichedAccounts);
  };

  const handleExportJson = () => {
    exportJson(enrichedAccounts);
  };

  const displayedGroups = useMemo(() => {
    const filteredAccounts = filterAndSortAccounts(enrichedAccounts, {
      activeFilter,
      provider: providerFilter,
      status: statusFilter,
      search,
      sortBy,
      sortOrder,
    });

    return groupAccountsByProvider(filteredAccounts, quotas, { expandedProviders });
  }, [enrichedAccounts, quotas, activeFilter, providerFilter, statusFilter, search, sortBy, sortOrder, expandedProviders]);

  if (auth.checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ fontSize: 15, color: 'var(--theme-text-muted)' }}>Checking 9Router connection...</p>
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <LoginModal
        onLogin={handleLogin}
        loginMode={auth.loginMode}
        error={loginError}
        loading={loginLoading}
      />
    );
  }

  return (
    <>
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefresh={() => {
          if (activeTab === 'usage') loadStats(statsPeriod);
          else loadData(true, handleSessionLoss);
        }}
        onLogout={handleLogout}
        refreshing={refreshing || statsLoading}
        lastSyncAt={lastSyncAt}
        search={search}
        onSearchChange={setSearch}
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
        provider={providerFilter}
        onProviderChange={setProviderFilter}
        providersList={uniqueProviders}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(by, order) => {
          setSortBy(by);
          setSortOrder(order);
        }}
        onResetFilters={handleResetFilters}
        accountsCount={connections.length}
        cadence={cadence}
        onCadenceChange={handleCadenceChange}
        notificationPermission={notificationPermission}
        onRequestNotificationPermission={handleRequestNotificationPermission}
        activeAlertsCount={activeAlertsCount}
        onExportCsv={handleExportCsv}
        onExportJson={handleExportJson}
      />

      {activeTab === 'quotas' ? (
        <main>
          <LiveModelsStrip onSessionLoss={handleSessionLoss} />

          <QuotaTable
            groups={displayedGroups}
            onSelectAccount={(acc) => setSelectedAccountId(acc ? acc.id : null)}
            onToggleExpandProvider={handleToggleExpandProvider}
          />
        </main>
      ) : (
        <main>
          <UsageView
            stats={stats}
            connections={connections}
            loading={statsLoading}
            error={statsError}
            period={statsPeriod}
            onPeriodChange={(period) => {
              setStatsPeriod(period);
              loadStats(period);
            }}
          />
        </main>
      )}

      {selectedAccount && (
        <DetailSheet
          account={selectedAccount}
          onClose={() => setSelectedAccountId(null)}
          onRefreshQuota={refreshAccountQuota}
          isRefreshingQuota={Boolean(accountRefreshing[selectedAccountId])}
          onToggleGovernor={handleToggleGovernor}
          isTogglingGovernor={togglingGovernor}
        />
      )}
    </>
  );
}
