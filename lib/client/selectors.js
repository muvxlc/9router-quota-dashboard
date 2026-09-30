export * from './formatters.js';
export * from './accountPresentation.js';

export function deriveAccountStatus(connection = {}, quota = null) {
  if (connection && connection.active === false) {
    return { status: 'inactive', label: 'Inactive', reason: null };
  }
  if (!quota || quota.status === 'no-data') {
    return { status: 'no-data', label: 'No Data', reason: quota?.reason || 'NO_QUOTA_DATA' };
  }
  if (quota.status === 'unavailable') {
    const reason = quota.reason || 'PROVIDER_UNAVAILABLE';
    const label = reason === 'PROVIDER_AUTH_REQUIRED' ? 'Auth Required' :
      reason === 'NO_QUOTA_DATA' ? 'No Data' :
      reason === 'INVALID_QUOTA_DATA' ? 'Invalid Data' : 'Unavailable';
    return { status: reason === 'NO_QUOTA_DATA' ? 'no-data' : 'unavailable', label, reason };
  }

  const isStale = quota.status === 'stale' || quota.stale === true || quota.isStale === true ||
    Boolean(quota.cached && quota.nextRefreshAt && new Date(quota.nextRefreshAt).getTime() <= (quota._nowMs || Date.now()));
  if (isStale) {
    return { status: 'stale', label: 'Stale', reason: quota.reason || 'STALE_DATA' };
  }

  if (quota.status === 'partial') {
    return { status: 'partial', label: 'Partial', reason: quota.reason || null };
  }

  const windows = Array.isArray(quota.windows) ? quota.windows : [];
  if (windows.length === 0) {
    return { status: 'no-data', label: 'No Data', reason: 'NO_QUOTA_DATA' };
  }

  let minRemaining = null;
  let knownCount = 0;
  let unknownCount = 0;
  let hasUnlimited = false;

  for (const win of windows) {
    if (!win) continue;
    if (win.unlimited === true) {
      hasUnlimited = true;
      continue;
    }
    if (typeof win.remainingPercent === 'number' && !Number.isNaN(win.remainingPercent)) {
      knownCount++;
      if (minRemaining === null || win.remainingPercent < minRemaining) {
        minRemaining = win.remainingPercent;
      }
    } else {
      unknownCount++;
    }
  }

  if (minRemaining === 0) {
    return { status: 'exhausted', label: 'Exhausted', reason: null };
  }

  if (knownCount === 0 && !hasUnlimited) {
    return { status: 'no-data', label: 'No Data', reason: 'NO_QUOTA_DATA' };
  }

  if (knownCount === 0 && hasUnlimited) {
    return { status: 'healthy', label: 'Available', reason: null };
  }

  if (minRemaining !== null && minRemaining < 15) {
    return { status: 'low', label: 'Low Quota', reason: null };
  }

  if (unknownCount > 0) {
    return { status: 'partial', label: 'Partial', reason: 'PARTIAL_DATA' };
  }

  return { status: 'healthy', label: 'Available', reason: null };
}

export function getAccountEffectiveRemainingPct(account) {
  const quota = account.quota;
  if (!quota || !Array.isArray(quota.windows) || quota.windows.length === 0) {
    return null;
  }
  let minPct = null;
  for (const win of quota.windows) {
    if (win.unlimited) continue;
    if (typeof win.remainingPercent === 'number') {
      if (minPct === null || win.remainingPercent < minPct) {
        minPct = win.remainingPercent;
      }
    }
  }
  return minPct;
}

export const ANTIGRAVITY_CORE_KEYS = ['gemini', 'gemini_weekly'];

export const ANTIGRAVITY_SHORT_LABELS = {
  gemini: 'Flash / Pro',
  gemini_weekly: 'Weekly',
  claude: 'Sonnet / Opus',
  claude_gpt_weekly: 'Claude/GPT Wk',
  gpt: 'GPT-OSS',
  image: 'Image',
};

export function getProviderCommonWindows(accounts = [], options = {}) {
  const provider = (options.provider || '').toLowerCase();
  const expanded = options.expanded === true;

  const seen = new Map();
  for (const acc of accounts) {
    const windows = acc.quota?.windows;
    if (Array.isArray(windows)) {
      for (const w of windows) {
        if (w && w.key && !seen.has(w.key)) {
          const item = { key: w.key, label: w.label || w.key };
          if (provider === 'antigravity' && ANTIGRAVITY_SHORT_LABELS[w.key]) {
            item.shortLabel = ANTIGRAVITY_SHORT_LABELS[w.key];
          }
          seen.set(w.key, item);
        }
      }
    }
  }

  const allWindows = Array.from(seen.values());

  if (provider === 'antigravity') {
    if (expanded) {
      return allWindows;
    }
    const coreWindows = [];
    for (const key of ANTIGRAVITY_CORE_KEYS) {
      const found = allWindows.find((w) => w.key === key);
      if (found) {
        coreWindows.push(found);
      } else {
        const defaultLabel = key === 'gemini' ? 'Gemini (Flash / Pro)' : 'Gemini Weekly';
        const item = { key, label: defaultLabel };
        if (ANTIGRAVITY_SHORT_LABELS[key]) {
          item.shortLabel = ANTIGRAVITY_SHORT_LABELS[key];
        }
        coreWindows.push(item);
      }
    }
    return coreWindows;
  }

  return allWindows;
}

export function groupAccountsByProvider(connections = [], quotas = {}, options = {}) {
  const groupsMap = new Map();

  for (const conn of connections) {
    const quota = conn.quota !== undefined ? conn.quota : (quotas[conn.id] || null);
    const effectiveStatus = conn.effectiveStatus !== undefined ? conn.effectiveStatus : deriveAccountStatus(conn, quota);
    const effectiveRemainingPct = conn.effectiveRemainingPct !== undefined
      ? conn.effectiveRemainingPct
      : getAccountEffectiveRemainingPct({ quota });
    const enrichedAccount = (conn.quota !== undefined && conn.effectiveStatus !== undefined)
      ? conn
      : {
          ...conn,
          quota,
          effectiveStatus,
          effectiveRemainingPct,
        };

    const providerKey = (conn.provider || 'other').toLowerCase();
    let group = groupsMap.get(providerKey);
    if (!group) {
      group = {
        provider: providerKey,
        providerTitle: conn.provider || 'Other',
        accounts: [],
      };
      groupsMap.set(providerKey, group);
    }
    group.accounts.push(enrichedAccount);
  }

  const result = [];
  for (const group of groupsMap.values()) {
    const isExpanded = options.expandedProviders?.[group.provider] ?? options.expanded ?? false;
    const allWindows = getProviderCommonWindows(group.accounts, {
      provider: group.provider,
      expanded: true,
    });
    const windows = (isExpanded || group.provider !== 'antigravity')
      ? allWindows
      : getProviderCommonWindows(group.accounts, {
          provider: group.provider,
          expanded: isExpanded,
        });
    const visibleKeys = new Set(windows.map((w) => w.key));
    const extraWindows = allWindows.filter((w) => !visibleKeys.has(w.key));

    result.push({
      ...group,
      windows,
      allWindows,
      extraWindows,
      extraWindowsCount: isExpanded ? 0 : extraWindows.length,
      isExpanded,
    });
  }

  return result;
}

export function filterAndSortAccounts(accounts = [], options = {}) {
  const {
    provider = 'all',
    status = 'all',
    activeFilter,
    active,
    search = '',
    sortBy = 'remainingPct',
    sortOrder = 'asc',
  } = options;

  let filtered = [...accounts];

  const effectiveActive = activeFilter !== undefined ? activeFilter : active;
  if (effectiveActive === 'active' || effectiveActive === true) {
    filtered = filtered.filter((acc) => acc.active === true);
  } else if (effectiveActive === 'inactive' || effectiveActive === false) {
    filtered = filtered.filter((acc) => acc.active === false);
  }

  if (provider && provider !== 'all') {
    const p = provider.toLowerCase();
    filtered = filtered.filter((acc) => (acc.provider || '').toLowerCase() === p);
  }

  if (status && status !== 'all') {
    filtered = filtered.filter((acc) => {
      const st = acc.effectiveStatus?.status || (acc.active === false ? 'inactive' : 'unknown');
      return st === status;
    });
  }

  if (search && search.trim() !== '') {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((acc) => {
      if (acc._searchTarget !== undefined) {
        return acc._searchTarget.includes(q);
      }
      const label = (acc.label || '').toLowerCase();
      const id = (acc.id || '').toLowerCase();
      const prov = (acc.provider || '').toLowerCase();
      const alias = (acc.displayAlias || '').toLowerCase();
      const masked = (acc.maskedIdentity || '').toLowerCase();
      return label.includes(q) || id.includes(q) || prov.includes(q) || alias.includes(q) || masked.includes(q);
    });
  }

  filtered.sort((a, b) => {
    let comp = 0;
    if (sortBy === 'remainingPct') {
      const valA = a.effectiveRemainingPct !== undefined ? a.effectiveRemainingPct : getAccountEffectiveRemainingPct(a);
      const valB = b.effectiveRemainingPct !== undefined ? b.effectiveRemainingPct : getAccountEffectiveRemainingPct(b);
      // Put accounts without numeric percentage at the end regardless of sort order
      if (valA === null && valB === null) comp = 0;
      else if (valA === null) return 1;
      else if (valB === null) return -1;
      else comp = valA - valB;
    } else if (sortBy === 'label') {
      const labelA = (a.displayAlias || a.label || a.id || '').toLowerCase();
      const labelB = (b.displayAlias || b.label || b.id || '').toLowerCase();
      comp = labelA < labelB ? -1 : (labelA > labelB ? 1 : 0);
    } else if (sortBy === 'status') {
      const stA = a.effectiveStatus?.status || '';
      const stB = b.effectiveStatus?.status || '';
      comp = stA < stB ? -1 : (stA > stB ? 1 : 0);
    }

    return sortOrder === 'desc' ? -comp : comp;
  });

  return filtered;
}

export function getProviderQuotaAverages(group = {}, options = {}) {
  const provider = (group?.provider || options.provider || '').toLowerCase();
  const accounts = Array.isArray(group?.accounts) ? group.accounts : (Array.isArray(group) ? group : []);
  const targetKeys = provider === 'codex'
    ? [{ key: 'session', label: '5-Hour' }, { key: 'weekly', label: 'Weekly' }]
    : provider === 'antigravity'
      ? [{ key: 'gemini', label: 'Gemini (Flash / Pro)' }, { key: 'gemini_weekly', label: 'Gemini Weekly' }]
      : (Array.isArray(group?.windows) ? group.windows : []);

  return targetKeys.map((target) => {
    let sum = 0, count = 0;
    for (const acc of accounts) {
      if (!acc?.quota || acc.quota.status === 'unavailable' || !Array.isArray(acc.quota.windows)) continue;
      const win = acc.quota.windows.find((w) => w && (w.key === target.key || (target.key === 'session' && w.key === '5h')));
      if (!win || win.unlimited === true || typeof win.remainingPercent !== 'number' || !Number.isFinite(win.remainingPercent)) continue;
      sum += win.remainingPercent;
      count++;
    }
    const winDef = group?.windows?.find?.((w) => w.key === target.key);
    return {
      key: target.key,
      label: winDef?.label || target.label || target.key,
      average: count > 0 ? Math.round((sum / count) * 10) / 10 : null, count,
    };
  });
}

export function aggregateUsageByProvider(stats = {}, connections = []) {
  const totals = stats?.totals || { totalTokens: 0, requests: 0, estimatedCost: 0 };
  const totalTokens = totals.totalTokens || 0;
  const totalRequests = totals.requests || 0;
  const totalCost = totals.estimatedCost || 0;

  const rawAccounts = Array.isArray(stats?.accounts) ? stats.accounts : [];
  if (rawAccounts.length === 0) {
    return {
      status: 'unavailable',
      available: false,
      notice: 'Upstream usage breakdown unavailable for this period',
      providers: [],
      accounts: [],
      totals,
    };
  }

  const connMap = new Map();
  for (const c of connections) {
    if (c && c.id) connMap.set(String(c.id), c);
  }

  const providerMap = new Map();
  const getProviderEntry = (name) => {
    const key = (name || 'unassigned').toLowerCase();
    if (!providerMap.has(key)) {
      providerMap.set(key, {
        provider: key,
        tokens: 0,
        requests: 0,
        cost: 0,
        accountCount: 0,
      });
    }
    return providerMap.get(key);
  };

  const accountRows = [];
  let accountedTokens = 0;
  let accountedRequests = 0;
  let accountedCost = 0;

  for (const acc of rawAccounts) {
    const conn = connMap.get(String(acc.connectionId));
    const providerName = conn?.provider || 'unassigned';
    const entry = getProviderEntry(providerName);

    const tokens = acc.totalTokens || 0;
    const requests = acc.requests || 0;
    const cost = acc.estimatedCost || 0;

    entry.tokens += tokens;
    entry.requests += requests;
    entry.cost += cost;
    entry.accountCount += 1;

    accountedTokens += tokens;
    accountedRequests += requests;
    accountedCost += cost;

    accountRows.push({
      connectionId: acc.connectionId,
      alias: conn?.label || conn?.id || acc.connectionId,
      provider: providerName,
      totalTokens: tokens,
      requests,
      estimatedCost: cost,
      tokenPct: totalTokens > 0 ? (tokens / totalTokens) * 100 : 0,
    });
  }

  const tokenRemainder = Math.max(0, totalTokens - accountedTokens);
  const requestsRemainder = Math.max(0, totalRequests - accountedRequests);
  const costRemainder = Math.max(0, totalCost - accountedCost);

  if (tokenRemainder > 0 || requestsRemainder > 0 || costRemainder > 0) {
    const unassignedEntry = getProviderEntry('unassigned');
    unassignedEntry.tokens += tokenRemainder;
    unassignedEntry.requests += requestsRemainder;
    unassignedEntry.cost += costRemainder;
  }

  const providers = Array.from(providerMap.values()).map((p) => ({
    ...p,
    tokenPct: totalTokens > 0 ? (p.tokens / totalTokens) * 100 : 0,
    requestPct: totalRequests > 0 ? (p.requests / totalRequests) * 100 : 0,
  }));

  return {
    status: 'ok',
    available: true,
    notice: null,
    providers,
    accounts: accountRows,
    totals,
  };
}
