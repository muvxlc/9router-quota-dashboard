import { APP_ORIGIN, LIMITS } from '../../../../../lib/server/config.js';
import { validateOriginAndHeaders, validateConnectionId } from '../../../../../lib/server/security.js';
import { defaultSessionStore } from '../../../../../lib/server/session.js';
import { createErrorResponse } from '../../../../../lib/server/errors.js';
import { requireAuthSession, readBoundedText, jsonResponse } from '../../../../../lib/server/routeHelpers.js';
import { defaultUpstreamClient } from '../../../../../lib/server/upstream.js';

export async function POST(request, context) {
  const headerCheck = validateOriginAndHeaders(request, APP_ORIGIN);
  if (!headerCheck.ok) {
    return createErrorResponse(headerCheck.status, headerCheck.code, headerCheck.message);
  }

  const { session, token, errorResponse } = await requireAuthSession(request);
  if (errorResponse) return errorResponse;

  const params = await context.params;
  const connectionId = params?.id;

  if (!validateConnectionId(connectionId)) {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }

  if (!defaultSessionStore.isKnownAccount(token, connectionId)) {
    return createErrorResponse(404, 'CONNECTION_NOT_FOUND');
  }

  let body;
  try {
    const rawText = await readBoundedText(request, 1024);
    body = JSON.parse(rawText);
  } catch (err) {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }

  if (typeof body?.active !== 'boolean') {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }

  let upstreamRes;
  try {
    upstreamRes = await defaultUpstreamClient.request(
      `/api/providers/client/${encodeURIComponent(connectionId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: body.active }),
        timeoutMs: LIMITS.QUOTA_UPSTREAM_TIMEOUT_MS,
      },
      session.upstreamToken
    );
  } catch (err) {
    if (err.code === 'UPSTREAM_TIMEOUT' || err.status === 504) {
      return createErrorResponse(504, 'UPSTREAM_TIMEOUT');
    }
    return createErrorResponse(err.status || 502, err.code || 'UPSTREAM_UNAVAILABLE');
  }

  if (upstreamRes.ok) {
    defaultSessionStore.setConnectionOverride(token, connectionId, { active: body.active });
    return jsonResponse({
      connectionId,
      active: body.active,
      mode: 'upstream',
      notice: null,
    });
  }

  if (upstreamRes.status === 404 || upstreamRes.status === 405) {
    defaultSessionStore.setConnectionOverride(token, connectionId, { active: body.active });
    return jsonResponse({
      connectionId,
      active: body.active,
      mode: 'simulated',
      notice: 'Upstream 9router read-only. Effective in dashboard display only.',
    });
  }

  if (upstreamRes.status >= 500) {
    return createErrorResponse(502, 'UPSTREAM_UNAVAILABLE');
  }

  return createErrorResponse(upstreamRes.status, 'INVALID_UPSTREAM_RESPONSE');
}
