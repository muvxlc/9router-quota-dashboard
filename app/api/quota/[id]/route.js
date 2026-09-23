import {
  requireAuthSession,
  jsonResponse,
  getCachedQuota,
  setCachedQuota,
  getLastKnownGoodQuota,
  recordTransientFailure,
  clearCachedQuota,
  allowForceQuotaRefresh,
  executeQuotaWithLimits,
  singleflightDirectoryRefresh,
} from '../../../../lib/server/routeHelpers.js';
import { validateConnectionId } from '../../../../lib/server/security.js';
import { createErrorResponse } from '../../../../lib/server/errors.js';
import { defaultUpstreamClient, readBoundedResponseText } from '../../../../lib/server/upstream.js';
import { defaultSessionStore } from '../../../../lib/server/session.js';
import { normalizeQuotaData } from '../../../../lib/server/normalize.js';
import { LIMITS } from '../../../../lib/server/config.js';

async function refreshDirectoryOnMiss(token, upstreamToken) {
  await singleflightDirectoryRefresh(token, async () => {
    const res = await defaultUpstreamClient.request(
      '/api/providers/client?provider=all&accountStatus=all&sort=provider&page=1&pageSize=100',
      { method: 'GET' },
      upstreamToken
    );
    if (!res.ok) return;
    const rawText = await readBoundedResponseText(res);
    const data = JSON.parse(rawText);
    const conns = Array.isArray(data?.connections) ? data.connections : [];
    defaultSessionStore.addKnownAccounts(token, conns);
    const totalPages = Number(data?.pagination?.totalPages) || 1;
    if (totalPages > 1) {
      for (let p = 2; p <= Math.min(totalPages, 5); p++) {
        const pageRes = await defaultUpstreamClient.request(
          `/api/providers/client?provider=all&accountStatus=all&sort=provider&page=${p}&pageSize=100`,
          { method: 'GET' },
          upstreamToken
        );
        if (pageRes.ok) {
          const pageRaw = await readBoundedResponseText(pageRes);
          const pageData = JSON.parse(pageRaw);
          const pageConns = Array.isArray(pageData?.connections) ? pageData.connections : [];
          defaultSessionStore.addKnownAccounts(token, pageConns);
        }
      }
    }
  });
}

export async function GET(request, context) {
  const { session, token, errorResponse } = await requireAuthSession(request);
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const searchKeys = Array.from(url.searchParams.keys());
  const hasInvalidParams = searchKeys.some((k) => k !== 'force');
  const forceParam = url.searchParams.get('force');
  if (hasInvalidParams || (forceParam !== null && forceParam !== 'true' && forceParam !== '1')) {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }
  const isForce = forceParam === 'true' || forceParam === '1' || request.headers?.get?.('cache-control') === 'no-cache';

  const params = await context.params;
  const connectionId = params?.id;

  if (!validateConnectionId(connectionId)) {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }

  if (!defaultSessionStore.isKnownAccount(token, connectionId)) {
    try {
      await refreshDirectoryOnMiss(token, session.upstreamToken);
    } catch {
      // Ignore directory refresh failure
    }
    if (!defaultSessionStore.isKnownAccount(token, connectionId)) {
      clearCachedQuota(token, connectionId);
      return createErrorResponse(404, 'CONNECTION_NOT_FOUND');
    }
  }

  const storedProvider = defaultSessionStore.getAccountProvider(token, connectionId);
  const cached = getCachedQuota(token, connectionId);
  const provider = storedProvider || cached?.provider;
  if (isForce && !cached?.stale && (provider !== 'claude' || !cached) && !allowForceQuotaRefresh(token, connectionId)) {
    return cached ? jsonResponse(cached) : createErrorResponse(429, 'RATE_LIMITED');
  }
  if (cached && (!isForce || provider === 'claude' || cached.stale)) {
    return jsonResponse(cached);
  }

  try {
    const normalized = await executeQuotaWithLimits(token, connectionId, async () => {
      let upstreamRes;
      try {
        upstreamRes = await defaultUpstreamClient.request(
          `/api/usage/${encodeURIComponent(connectionId)}`,
          { method: 'GET', timeoutMs: LIMITS.QUOTA_UPSTREAM_TIMEOUT_MS },
          session.upstreamToken
        );
      } catch (err) {
        if (err.status === 404 || err.code === 'CONNECTION_NOT_FOUND' || err.status === 403 || err.status === 400) {
          clearCachedQuota(token, connectionId);
          throw err;
        }
        const lastGood = getLastKnownGoodQuota(token, connectionId);
        if (lastGood) {
          return recordTransientFailure(token, connectionId, lastGood);
        }
        return normalizeQuotaData(connectionId, storedProvider || 'unknown', {
          message: 'PROVIDER_UNAVAILABLE',
        });
      }

      if (upstreamRes.status === 404 || upstreamRes.status === 403 || upstreamRes.status === 400) {
        clearCachedQuota(token, connectionId);
        const err = new Error(upstreamRes.status === 404 ? 'Connection not found upstream' : 'Upstream client error');
        err.status = upstreamRes.status;
        err.code = upstreamRes.status === 404 ? 'CONNECTION_NOT_FOUND' : (upstreamRes.status === 403 ? 'FORBIDDEN' : 'INVALID_REQUEST');
        throw err;
      }

      let data = null;
      try {
        const rawText = await readBoundedResponseText(upstreamRes);
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      if (upstreamRes.status === 401) {
        const authCheck = await defaultUpstreamClient.revalidateAuthResult(session.upstreamToken);
        if (authCheck.status === 'unauthenticated') {
          defaultSessionStore.destroySession(token);
          const err = new Error('Session expired');
          err.status = 401;
          err.code = 'SESSION_REQUIRED';
          throw err;
        }
        clearCachedQuota(token, connectionId);
        return normalizeQuotaData(connectionId, data?.provider || 'unknown', {
          message: 'authentication expired',
        });
      }

      const provider = storedProvider || data?.provider || 'unknown';

      if (upstreamRes.status >= 500) {
        const lastGood = getLastKnownGoodQuota(token, connectionId);
        if (lastGood) {
          return recordTransientFailure(token, connectionId, lastGood);
        }
        return normalizeQuotaData(connectionId, provider, { message: 'PROVIDER_UNAVAILABLE' });
      }

      const norm = normalizeQuotaData(connectionId, provider, data);
      if (norm.reason === 'PROVIDER_AUTH_REQUIRED') {
        clearCachedQuota(token, connectionId);
        return norm;
      }
      if (norm.status === 'unavailable' && norm.reason === 'PROVIDER_UNAVAILABLE') {
        const lastGood = getLastKnownGoodQuota(token, connectionId);
        if (lastGood) {
          return recordTransientFailure(token, connectionId, lastGood);
        }
      }
      return norm;
    });

    if (normalized.status !== 'unavailable' && !normalized.stale && normalized.reason !== 'PROVIDER_AUTH_REQUIRED') {
      setCachedQuota(token, connectionId, normalized);
    }
    return jsonResponse(normalized);
  } catch (err) {
    const status = err.status || 500;
    const code = err.code || 'INVALID_REQUEST';
    return createErrorResponse(status, code, null, err.retryAfterSeconds);
  }
}
