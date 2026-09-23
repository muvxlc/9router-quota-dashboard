'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from './components/Header.js';
import LiveModelsStrip from './components/LiveModelsStrip.js';
import QuotaTable from './components/QuotaTable.js';
import UsageView from './components/UsageView.js';
import DetailSheet from './components/DetailSheet.js';
import LoginModal from './components/LoginModal.js';
import { fetchAuthStatus, loginWithPassword, logout, SessionExpiredError } from '../lib/client/api.js';
import { groupAccountsByProvider, filterAndSortAccounts, buildAccountPresentation, maskEmail } from '../lib/client/selectors.js';
import { useTheme } from '../lib/client/useTheme.js';
import { useQuotaData } from '../lib/client/useQuotaData.js';
import { useStatsData } from '../lib/client/useStatsData.js';

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

  const [selectedAccount, setSelectedAccount] = useState(null);
  const authMountAbortRef = useRef(null);

  const {
    connections,
    quotas,
    refreshing,
    lastSyncAt,
    loadData,
    resetData,
  } = useQuotaData();

  const handleSessionLoss = useCallback(() => {
    if (authMountAbortRef.current) authMountAbortRef.current.abort();
    setAuth({ authenticated: false, loginMode: 'password', checking: false });
    resetData();
    setSelectedAccount(null);
  }, [resetData]);

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
      return {
        ...conn,
        displayAlias: pres.alias || conn.label || conn.id,
        maskedIdentity: pres.maskedIdentity || maskEmail(conn.label || conn.id),
        shortId: pres.shortId || conn.id,
      };
    });
  }, [connections, presentationMap]);

  const displayedGroups = useMemo(() => {
    const allGroups = groupAccountsByProvider(presentedConnections, quotas);
    const flattenedAccounts = allGroups.flatMap((g) => g.accounts);
    const filteredAccounts = filterAndSortAccounts(flattenedAccounts, {
      activeFilter,
      provider: providerFilter,
      status: statusFilter,
      search,
      sortBy,
      sortOrder,
    });

    const filteredConns = filteredAccounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      label: a.label,
      active: a.active,
      displayAlias: a.displayAlias,
      maskedIdentity: a.maskedIdentity,
      shortId: a.shortId,
    }));

    return groupAccountsByProvider(filteredConns, quotas, { expandedProviders });
  }, [presentedConnections, quotas, activeFilter, providerFilter, statusFilter, search, sortBy, sortOrder, expandedProviders]);

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
      />

      {activeTab === 'quotas' ? (
        <main>
          <LiveModelsStrip onSessionLoss={handleSessionLoss} />

          <QuotaTable
            groups={displayedGroups}
            onSelectAccount={(acc) => setSelectedAccount(acc)}
            onToggleExpandProvider={handleToggleExpandProvider}
          />
        </main>
      ) : (
        <main>
          <UsageView
            stats={stats}
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
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </>
  );
}
