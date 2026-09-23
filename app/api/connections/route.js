import { requireAuthSession, jsonResponse } from '../../../lib/server/routeHelpers.js';
import { createErrorResponse } from '../../../lib/server/errors.js';
import { defaultUpstreamClient, readBoundedResponseText } from '../../../lib/server/upstream.js';
import { normalizeConnection } from '../../../lib/server/normalize.js';
import { defaultSessionStore } from '../../../lib/server/session.js';

export async function GET(request) {
  const { session, token, errorResponse } = await requireAuthSession(request);
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  for (const key of url.searchParams.keys()) {
    if (key !== 'page' && key !== 'pageSize') {
      return createErrorResponse(400, 'INVALID_REQUEST');
    }
  }

  const rawPage = url.searchParams.get('page') || '1';
  const rawPageSize = url.searchParams.get('pageSize') || '100';

  const page = Number.parseInt(rawPage, 10);
  const pageSize = Number.parseInt(rawPageSize, 10);

  if (!Number.isFinite(page) || page < 1) {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }

  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 100) {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }

  const upstreamPath = `/api/providers/client?provider=all&accountStatus=all&sort=provider&page=${page}&pageSize=${pageSize}`;

  let upstreamRes;
  try {
    upstreamRes = await defaultUpstreamClient.request(upstreamPath, { method: 'GET' }, session.upstreamToken);
  } catch (err) {
    const status = err.status || 503;
    const code = err.code || 'UPSTREAM_UNAVAILABLE';
    return createErrorResponse(status, code);
  }

  if (!upstreamRes.ok) {
    return createErrorResponse(502, 'INVALID_UPSTREAM_RESPONSE');
  }

  let data;
  try {
    const rawText = await readBoundedResponseText(upstreamRes);
    data = JSON.parse(rawText);
  } catch {
    return createErrorResponse(502, 'INVALID_UPSTREAM_RESPONSE');
  }

  const rawConnections = Array.isArray(data?.connections) ? data.connections : [];
  const connections = rawConnections.map(normalizeConnection);
  const providerOptions = Array.isArray(data?.providerOptions) ? data.providerOptions : [];

  defaultSessionStore.addKnownAccounts(token, connections);

  const pagination = {
    page: data?.pagination?.page || page,
    pageSize: data?.pagination?.pageSize || pageSize,
    total: data?.pagination?.total ?? connections.length,
    totalPages: data?.pagination?.totalPages ?? 1,
  };

  return jsonResponse({
    connections,
    providers: providerOptions,
    pagination,
    receivedAt: new Date().toISOString(),
  });
}
