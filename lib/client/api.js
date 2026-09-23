/**
 * Same-origin browser API client.
 * Strictly uses same-origin credentials.
 * Never stores passwords or session tokens in localStorage or persistent stores.
 * Enforces <= 300 lines.
 */

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
    this.status = 401;
  }
}

export async function fetchAuthStatus(fetchFn = fetch, signal = null) {
  const res = await fetchFn('/api/auth/status', {
    method: 'GET',
    credentials: 'same-origin',
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch auth status: ${res.status}`);
  }
  return res.json();
}

export async function loginWithPassword(fetchFn = fetch, password, signal = null) {
  const res = await fetchFn('/api/auth/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 409) {
      const msg = data.error?.message || 'Unsupported SSO login mode. Password login unavailable.';
      throw new Error(msg);
    }
    const msg = data.error?.message || `Login failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function logout(fetchFn = fetch, signal = null) {
  const res = await fetchFn('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Logout failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchAllConnections({
  fetchFn = fetch,
  pageSize = 100,
  onPageBatch = null,
  signal = null,
} = {}) {
  const allConnections = [];
  const seenIds = new Set();
  let currentPage = 1;
  let totalPages = 1;
  let previousPageFirstId = null;

  while (currentPage <= totalPages) {
    if (signal?.aborted) break;

    const res = await fetchFn(`/api/connections?page=${currentPage}&pageSize=${pageSize}`, {
      method: 'GET',
      credentials: 'same-origin',
      signal,
    });

    if (res.status === 401) {
      throw new SessionExpiredError();
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch connections page ${currentPage}: ${res.status}`);
    }

    const data = await res.json();
    const connections = Array.isArray(data.connections) ? data.connections : [];
    const pagination = data.pagination || {};
    totalPages = pagination.totalPages && pagination.totalPages > 0 ? pagination.totalPages : 1;

    // Detect infinite loop / clamping from backend returning identical page
    const currentFirstId = connections[0]?.id || null;
    if (currentFirstId && currentFirstId === previousPageFirstId && currentPage > 1) {
      break;
    }
    previousPageFirstId = currentFirstId;

    const newInThisPage = [];
    for (const conn of connections) {
      if (conn && conn.id && !seenIds.has(conn.id)) {
        seenIds.add(conn.id);
        allConnections.push(conn);
        newInThisPage.push(conn);
      }
    }

    if (onPageBatch && newInThisPage.length > 0) {
      onPageBatch(newInThisPage);
    }

    if (connections.length === 0 || currentPage >= totalPages) {
      break;
    }

    currentPage++;
  }

  return allConnections;
}

export async function fetchQuotaWithCadence({
  fetchFn = fetch,
  connectionId,
  cachedQuota = null,
  force = false,
  nowMs = Date.now(),
  signal = null,
} = {}) {
  if (cachedQuota && !force && cachedQuota.nextRefreshAt) {
    const nextRefreshTime = new Date(cachedQuota.nextRefreshAt).getTime();
    if (!Number.isNaN(nextRefreshTime) && nextRefreshTime > nowMs) {
      return cachedQuota;
    }
  }

  const encodedId = encodeURIComponent(connectionId);
  const url = force ? `/api/quota/${encodedId}?force=true` : `/api/quota/${encodedId}`;
  const res = await fetchFn(url, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
  });

  if (res.status === 401) {
    throw new SessionExpiredError();
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const reason = errData.error?.code || 'PROVIDER_UNAVAILABLE';
    const isTransient = res.status >= 500;
    if (isTransient && reason !== 'PROVIDER_AUTH_REQUIRED' && cachedQuota && Array.isArray(cachedQuota.windows) && cachedQuota.windows.length > 0) {
      return {
        ...cachedQuota,
        status: 'stale',
        stale: true,
        isStale: true,
        reason: 'STALE_DATA',
        receivedAt: cachedQuota.receivedAt || new Date().toISOString(),
        nextRefreshAt: new Date(Date.now() + 15000).toISOString(),
      };
    }
    return {
      connectionId,
      provider: cachedQuota?.provider || null,
      plan: cachedQuota?.plan || null,
      status: 'unavailable',
      reason,
      windows: [],
      receivedAt: new Date().toISOString(),
      nextRefreshAt: new Date(Date.now() + 60000).toISOString(),
    };
  }

  const data = await res.json();
  if (data.status === 'unavailable' && data.reason === 'PROVIDER_UNAVAILABLE' && cachedQuota && Array.isArray(cachedQuota.windows) && cachedQuota.windows.length > 0) {
    return {
      ...cachedQuota,
      status: 'stale',
      stale: true,
      isStale: true,
      reason: 'STALE_DATA',
      receivedAt: cachedQuota.receivedAt || data.receivedAt || new Date().toISOString(),
      nextRefreshAt: new Date(Date.now() + 15000).toISOString(),
    };
  }

  return {
    ...data,
    receivedAt: data.receivedAt || new Date().toISOString(),
  };
}

export async function runWithConcurrency(tasks = [], limit = 4) {
  if (!tasks.length) return [];
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      const task = tasks[idx];
      try {
        results[idx] = await task();
      } catch (err) {
        results[idx] = { error: err };
      }
    }
  }

  const workerCount = Math.min(limit, tasks.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return results;
}

export async function fetchStats(fetchFn = fetch, period = '24h', signal = null) {
  const res = await fetchFn(`/api/stats?period=${encodeURIComponent(period)}`, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
  });

  if (res.status === 401) {
    throw new SessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch stats: ${res.status}`);
  }

  return res.json();
}
