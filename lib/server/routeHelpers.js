import { SESSION_COOKIE_NAME, APP_ORIGIN, LIMITS } from './config.js';
import { defaultSessionStore } from './session.js';
import { defaultUpstreamClient, readBoundedStreamText } from './upstream.js';
import { createErrorResponse, NO_STORE_HEADERS } from './errors.js';
import { isSecureCookie, safeDecodeURIComponent } from './security.js';

export function getCookie(request, name) {
  const cookieHeader = typeof request.headers?.get === 'function'
    ? request.headers.get('cookie')
    : request.headers?.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? safeDecodeURIComponent(match[1]) : null;
}

export async function readBoundedText(request, maxBytes = LIMITS.MAX_LOGIN_BODY_BYTES) {
  const cl = request.headers?.get?.('content-length');
  if (cl && Number(cl) > maxBytes) {
    const err = new Error('Payload exceeds maximum size');
    err.code = 'INVALID_REQUEST';
    err.status = 400;
    throw err;
  }
  if (request.body) {
    return readBoundedStreamText(request.body, maxBytes);
  }
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    const err = new Error('Payload exceeds maximum size');
    err.code = 'INVALID_REQUEST';
    err.status = 400;
    throw err;
  }
  return text;
}

export function buildSessionCookie(token, expiresAt = null) {
  const secure = isSecureCookie(APP_ORIGIN);
  const maxAge = Math.floor(LIMITS.SESSION_TTL_MS / 1000);
  const expires = expiresAt ? `; Expires=${new Date(expiresAt).toUTCString()}` : '';
  const secureFlag = secure ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${expires}${secureFlag}`;
}

export function buildClearSessionCookie() {
  const secure = isSecureCookie(APP_ORIGIN);
  const secureFlag = secure ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`;
}

export async function requireAuthSession(request) {
  const rawToken = getCookie(request, SESSION_COOKIE_NAME);
  if (!rawToken) {
    return {
      session: null,
      errorResponse: createErrorResponse(401, 'SESSION_REQUIRED'),
    };
  }

  const session = defaultSessionStore.getSession(rawToken);
  if (!session) {
    return {
      session: null,
      errorResponse: createErrorResponse(401, 'SESSION_REQUIRED'),
    };
  }

  // Revalidate upstream status for fail-closed security, distinguishing transport failure
  const authResult = await defaultUpstreamClient.revalidateAuthResult(session.upstreamToken);
  if (authResult.status === 'unauthenticated') {
    defaultSessionStore.destroySession(rawToken);
    return {
      session: null,
      errorResponse: createErrorResponse(401, 'SESSION_REQUIRED'),
    };
  }
  if (authResult.status === 'error') {
    return {
      session: null,
      errorResponse: createErrorResponse(503, 'UPSTREAM_UNAVAILABLE'),
    };
  }

  return { session, token: rawToken, errorResponse: null };
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers(NO_STORE_HEADERS);
  for (const [k, v] of Object.entries(extraHeaders)) {
    headers.set(k, v);
  }
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

// Bounded quota cache and concurrency manager
const quotaCache = new Map();
const inflightQuota = new Map();
const sessionConcurrency = new Map();
const directoryRefreshCooldowns = new Map();
const directoryInflight = new Map();

export function getCachedQuota(token, connectionId) {
  const key = `${token}:${connectionId}`;
  const entry = quotaCache.get(key);
  if (!entry) return null;
  if (Date.now() >= new Date(entry.nextRefreshAt).getTime()) {
    quotaCache.delete(key);
    return null;
  }
  return entry;
}

export function setCachedQuota(token, connectionId, quota) {
  if (quotaCache.size > 500) {
    const firstKey = quotaCache.keys().next().value;
    quotaCache.delete(firstKey);
  }
  const key = `${token}:${connectionId}`;
  quotaCache.set(key, quota);
}

export async function executeQuotaWithLimits(token, connectionId, fetchFn) {
  const key = `${token}:${connectionId}`;
  if (inflightQuota.has(key)) {
    return inflightQuota.get(key);
  }

  const currentCount = sessionConcurrency.get(token) || 0;
  if (currentCount >= LIMITS.MAX_QUOTA_CONCURRENCY) {
    const err = new Error('Quota concurrency limit reached for session');
    err.status = 429;
    err.code = 'RATE_LIMITED';
    err.retryAfterSeconds = 1;
    throw err;
  }

  sessionConcurrency.set(token, currentCount + 1);

  const promise = (async () => {
    try {
      return await fetchFn();
    } finally {
      inflightQuota.delete(key);
      const updated = (sessionConcurrency.get(token) || 1) - 1;
      if (updated <= 0) sessionConcurrency.delete(token);
      else sessionConcurrency.set(token, updated);
    }
  })();

  inflightQuota.set(key, promise);
  return promise;
}

export async function singleflightDirectoryRefresh(token, refreshFn) {
  const now = Date.now();
  const lastTime = directoryRefreshCooldowns.get(token) || 0;
  if (now - lastTime < LIMITS.DIRECTORY_COOLDOWN_MS) {
    return;
  }

  if (directoryInflight.has(token)) {
    return directoryInflight.get(token);
  }

  const promise = (async () => {
    try {
      await refreshFn();
      directoryRefreshCooldowns.set(token, Date.now());
    } finally {
      directoryInflight.delete(token);
    }
  })();

  directoryInflight.set(token, promise);
  return promise;
}
