import { APP_ORIGIN, LIMITS } from '../../../../lib/server/config.js';
import { validateOriginAndHeaders } from '../../../../lib/server/security.js';
import { defaultLoginLimiter, defaultSessionStore } from '../../../../lib/server/session.js';
import { defaultUpstreamClient, readBoundedResponseText } from '../../../../lib/server/upstream.js';
import { createErrorResponse } from '../../../../lib/server/errors.js';
import { buildSessionCookie, jsonResponse, readBoundedText } from '../../../../lib/server/routeHelpers.js';

export async function POST(request) {
  const headerCheck = validateOriginAndHeaders(request, APP_ORIGIN);
  if (!headerCheck.ok) {
    return createErrorResponse(headerCheck.status, headerCheck.code);
  }

  const lockCheck = defaultLoginLimiter.checkLocked();
  if (lockCheck.locked) {
    return createErrorResponse(
      429,
      'RATE_LIMITED',
      null,
      lockCheck.retryAfterSeconds
    );
  }

  if (!defaultLoginLimiter.tryAcquireInflight()) {
    return createErrorResponse(429, 'RATE_LIMITED', null, 1);
  }

  try {
    let rawText;
    try {
      rawText = await readBoundedText(request, LIMITS.MAX_LOGIN_BODY_BYTES);
    } catch {
      defaultLoginLimiter.releaseInflight();
      return createErrorResponse(400, 'INVALID_REQUEST');
    }

    let body;
    try {
      body = JSON.parse(rawText);
    } catch {
      defaultLoginLimiter.releaseInflight();
      return createErrorResponse(400, 'INVALID_REQUEST');
    }

    const { password } = body || {};
    if (typeof password !== 'string' || !password || password.length > LIMITS.MAX_PASSWORD_LENGTH) {
      defaultLoginLimiter.releaseInflight();
      return createErrorResponse(400, 'INVALID_REQUEST');
    }

    // Verify upstream does not require unsupported SSO
    try {
      const statusRes = await defaultUpstreamClient.request('/api/auth/status', { method: 'GET' });
      if (statusRes.ok) {
        const statusText = await readBoundedResponseText(statusRes);
        const statusData = JSON.parse(statusText);
        const isSso =
          statusData.authMode === 'sso' ||
          statusData.authMode === 'saml' ||
          statusData.authMode === 'oidc' ||
          Boolean(statusData.oidcConfigured) ||
          Boolean(statusData.samlConfigured);
        if (isSso) {
          defaultLoginLimiter.releaseInflight();
          return createErrorResponse(409, 'SSO_UNSUPPORTED');
        }
      }
    } catch {
      // Continue to login attempt
    }

    let upstreamRes;
    try {
      upstreamRes = await defaultUpstreamClient.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
    } catch (err) {
      defaultLoginLimiter.releaseInflight();
      const status = err.status || 503;
      const code = err.code || 'UPSTREAM_UNAVAILABLE';
      return createErrorResponse(status, code);
    }

    if (!upstreamRes.ok) {
      defaultLoginLimiter.releaseInflight();
      if (upstreamRes.status === 401 || upstreamRes.status === 403) {
        defaultLoginLimiter.recordFail();
        const postLock = defaultLoginLimiter.checkLocked();
        if (postLock.locked) {
          return createErrorResponse(
            429,
            'RATE_LIMITED',
            null,
            postLock.retryAfterSeconds
          );
        }
        return createErrorResponse(401, 'INVALID_CREDENTIALS');
      }
      if (upstreamRes.status === 429) {
        return createErrorResponse(429, 'RATE_LIMITED');
      }
      return createErrorResponse(502, 'INVALID_UPSTREAM_RESPONSE');
    }

    defaultLoginLimiter.reset();
    defaultLoginLimiter.releaseInflight();

    const setCookieHeader = upstreamRes.headers.get('set-cookie') || '';
    const tokenMatch = setCookieHeader.match(/(?:^|[,;]\s*)auth_token=([^;]+)/);
    const upstreamToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;

    if (!upstreamToken) {
      return createErrorResponse(502, 'INVALID_UPSTREAM_RESPONSE');
    }

    let token;
    let expiresAt;
    try {
      const created = defaultSessionStore.createSession(upstreamToken);
      token = created.token;
      expiresAt = created.expiresAt;
    } catch (sessErr) {
      if (sessErr.code === 'SESSION_CAPACITY') {
        return createErrorResponse(503, 'SESSION_CAPACITY');
      }
      throw sessErr;
    }

    const sessionCookie = buildSessionCookie(token, expiresAt);
    return jsonResponse(
      { authenticated: true, expiresAt },
      200,
      { 'Set-Cookie': sessionCookie }
    );
  } catch {
    defaultLoginLimiter.releaseInflight();
    return createErrorResponse(500, 'INVALID_REQUEST');
  }
}
