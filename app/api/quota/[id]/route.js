import {
  requireAuthSession,
  jsonResponse,
  getCachedQuota,
  setCachedQuota,
  executeQuotaWithLimits,
  singleflightDirectoryRefresh,
} from '../../../../lib/server/routeHelpers.js';
import { validateConnectionId } from '../../../../lib/server/security.js';
import { createErrorResponse } from '../../../../lib/server/errors.js';
import { defaultUpstreamClient, readBoundedResponseText } from '../../../../lib/server/upstream.js';
import { defaultSessionStore } from '../../../../lib/server/session.js';
import { normalizeQuotaData } from '../../../../lib/server/normalize.js';

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
  if (url.searchParams && Array.from(url.searchParams.keys()).length > 0) {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }

  const params = await context.params;
  const connectionId = params?.id;

  if (!validateConnectionId(connectionId)) {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }

  // Verify known directory membership with singleflight cooldown refresh
  if (!defaultSessionStore.isKnownAccount(token, connectionId)) {
    try {
      await refreshDirectoryOnMiss(token, session.upstreamToken);
    } catch {
      // Ignore directory refresh failure
    }
    if (!defaultSessionStore.isKnownAccount(token, connectionId)) {
      return createErrorResponse(404, 'CONNECTION_NOT_FOUND');
    }
  }

  const cached = getCachedQuota(token, connectionId);
  if (cached) {
    return jsonResponse(cached);
  }

  try {
    const normalized = await executeQuotaWithLimits(token, connectionId, async () => {
      let upstreamRes;
      try {
        upstreamRes = await defaultUpstreamClient.request(
          `/api/usage/${encodeURIComponent(connectionId)}`,
          { method: 'GET' },
          session.upstreamToken
        );
      } catch (err) {
        if (err.status === 404 || err.code === 'CONNECTION_NOT_FOUND') {
          throw err;
        }
        return normalizeQuotaData(connectionId, 'unknown', {
          message: 'PROVIDER_UNAVAILABLE',
        });
      }

      if (upstreamRes.status === 404) {
        const err = new Error('Connection not found upstream');
        err.status = 404;
        err.code = 'CONNECTION_NOT_FOUND';
        throw err;
      }

      let data = null;
      try {
        const rawText = await readBoundedResponseText(upstreamRes);
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      // Disambiguate quota 401: Provider expired vs 9Router dashboard session expired
      if (upstreamRes.status === 401) {
        const authCheck = await defaultUpstreamClient.revalidateAuthResult(session.upstreamToken);
        if (authCheck.status === 'unauthenticated') {
          defaultSessionStore.destroySession(token);
          const err = new Error('Session expired');
          err.status = 401;
          err.code = 'SESSION_REQUIRED';
          throw err;
        }
        return normalizeQuotaData(connectionId, data?.provider || 'unknown', {
          message: 'authentication expired',
        });
      }

      const storedProvider = defaultSessionStore.getAccountProvider(token, connectionId);
      const provider = storedProvider || data?.provider || 'unknown';
      return normalizeQuotaData(connectionId, provider, data);
    });

    setCachedQuota(token, connectionId, normalized);
    return jsonResponse(normalized);
  } catch (err) {
    const status = err.status || 500;
    const code = err.code || 'INVALID_REQUEST';
    return createErrorResponse(status, code, null, err.retryAfterSeconds);
  }
}
