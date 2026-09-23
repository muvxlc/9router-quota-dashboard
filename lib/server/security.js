const SUSPICIOUS_CREDENTIAL_PATTERN = /^(sk-[a-zA-Z0-9_-]{8,}|bearer\s+[a-zA-Z0-9._-]+|eyJ[a-zA-Z0-9_-]{10,}|[a-zA-Z0-9_-]{32,})$/i;
const INVALID_ID_CHARS_PATTERN = /[\x00-\x1f\x7f/\\?#]|(\.\.)/;

export function safeDecodeURIComponent(str) {
  if (typeof str !== 'string') return null;
  try {
    return decodeURIComponent(str);
  } catch {
    return null;
  }
}

export function sanitizeLabel(connection = {}) {
  const candidate = (
    connection.email ||
    connection.displayName ||
    connection.name ||
    connection.id ||
    'Unknown'
  ).trim();

  if (!candidate) return 'Unknown';

  if (candidate.toLowerCase().startsWith('bearer ')) {
    return 'Credential***';
  }

  if (candidate.startsWith('sk-') && candidate.length > 8) {
    return `${candidate.slice(0, 8)}***`;
  }

  if (SUSPICIOUS_CREDENTIAL_PATTERN.test(candidate)) {
    return `${candidate.slice(0, 8)}***`;
  }

  return candidate.slice(0, 64);
}

export function validateConnectionId(id) {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > 128) return false;
  return !INVALID_ID_CHARS_PATTERN.test(trimmed);
}

export function validateOriginAndHeaders(request, allowedOrigin) {
  const method = (request.method || 'GET').toUpperCase();
  if (method !== 'POST' && method !== 'PUT' && method !== 'DELETE' && method !== 'PATCH') {
    return { ok: true };
  }

  const getHeader = (name) => {
    if (typeof request.headers?.get === 'function') {
      return request.headers.get(name);
    }
    return request.headers?.[name.toLowerCase()] || null;
  };

  // 1. Fetch Metadata: Reject cross-site requests upfront
  const secFetchSite = (getHeader('sec-fetch-site') || '').toLowerCase();
  if (secFetchSite === 'cross-site') {
    return { ok: false, status: 403, code: 'ORIGIN_REJECTED', message: 'Cross-site request rejected' };
  }

  // 2. Exact Origin check
  const origin = getHeader('origin');
  if (!origin) {
    return { ok: false, status: 403, code: 'ORIGIN_REJECTED', message: 'Missing Origin header' };
  }

  const normalizedOrigin = origin.replace(/\/+$/, '');
  const normalizedAllowed = allowedOrigin.replace(/\/+$/, '');
  if (normalizedOrigin !== normalizedAllowed) {
    return { ok: false, status: 403, code: 'ORIGIN_REJECTED', message: 'Invalid Origin header' };
  }

  // 3. Exact Host check against allowed origin
  let expectedHost = '';
  try {
    expectedHost = new URL(normalizedAllowed).host.toLowerCase();
  } catch {
    expectedHost = '';
  }

  const host = (getHeader('host') || '').trim().toLowerCase();
  if (!host || /[\x00-\x1f\x7f\s]/.test(host) || (expectedHost && host !== expectedHost)) {
    return { ok: false, status: 403, code: 'ORIGIN_REJECTED', message: 'Invalid Host header' };
  }

  // 4. Content-Type check
  const contentType = (getHeader('content-type') || '').toLowerCase().split(';')[0].trim();
  if (contentType !== 'application/json') {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', message: 'Content-Type must be application/json' };
  }

  return { ok: true };
}

export function isSecureCookie(configuredOrigin) {
  return String(configuredOrigin).toLowerCase().startsWith('https:');
}

export function sanitizeUpstreamError(_err) {
  return 'Upstream service error';
}
