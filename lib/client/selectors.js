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
    const quota = quotas[conn.id] || null;
    const effectiveStatus = deriveAccountStatus(conn, quota);
    const enrichedAccount = {
      ...conn,
      quota,
      effectiveStatus,
      effectiveRemainingPct: getAccountEffectiveRemainingPct({ quota }),
    };

    const providerKey = (conn.provider || 'other').toLowerCase();
    if (!groupsMap.has(providerKey)) {
      groupsMap.set(providerKey, {
        provider: providerKey,
        providerTitle: conn.provider || 'Other',
        accounts: [],
      });
    }
    groupsMap.get(providerKey).accounts.push(enrichedAccount);
  }

  const result = [];
  for (const group of groupsMap.values()) {
    const isExpanded = options.expandedProviders?.[group.provider] ?? options.expanded ?? false;
    const allWindows = getProviderCommonWindows(group.accounts, {
      provider: group.provider,
      expanded: true,
    });
    const windows = getProviderCommonWindows(group.accounts, {
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
      comp = labelA.localeCompare(labelB);
    } else if (sortBy === 'status') {
      const stA = a.effectiveStatus?.status || '';
      const stB = b.effectiveStatus?.status || '';
      comp = stA.localeCompare(stB);
    }

    return sortOrder === 'desc' ? -comp : comp;
  });

  return filtered;
}
