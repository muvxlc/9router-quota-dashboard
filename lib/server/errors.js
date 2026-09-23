export const ERROR_CODES = {
  INVALID_REQUEST: { status: 400, defaultMessage: 'Invalid request' },
  INVALID_CREDENTIALS: { status: 401, defaultMessage: 'Invalid credentials' },
  SESSION_REQUIRED: { status: 401, defaultMessage: 'Authentication required' },
  ORIGIN_REJECTED: { status: 403, defaultMessage: 'Request origin rejected' },
  LOGIN_DENIED: { status: 403, defaultMessage: 'Login denied' },
  CONNECTION_NOT_FOUND: { status: 404, defaultMessage: 'Connection not found' },
  SSO_UNSUPPORTED: { status: 409, defaultMessage: 'Single sign-on is not supported in dashboard mode' },
  RATE_LIMITED: { status: 429, defaultMessage: 'Rate limit exceeded' },
  INVALID_UPSTREAM_RESPONSE: { status: 502, defaultMessage: 'Invalid response from upstream router' },
  UPSTREAM_UNAVAILABLE: { status: 503, defaultMessage: 'Upstream router unavailable' },
  SESSION_CAPACITY: { status: 503, defaultMessage: 'Server session capacity reached' },
  UPSTREAM_TIMEOUT: { status: 504, defaultMessage: 'Upstream router request timed out' },
};

export const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function formatApiError(code, message = null, retryAfterSeconds = null) {
  const meta = ERROR_CODES[code];
  const finalMessage = message || (meta ? meta.defaultMessage : 'An error occurred');
  return {
    error: {
      code,
      message: finalMessage,
      retryAfterSeconds: typeof retryAfterSeconds === 'number' ? retryAfterSeconds : null,
    },
  };
}

export function createErrorResponse(status, code, message = null, retryAfterSeconds = null) {
  const body = formatApiError(code, message, retryAfterSeconds);
  const headers = new Headers(NO_STORE_HEADERS);
  if (typeof retryAfterSeconds === 'number') {
    headers.set('Retry-After', String(retryAfterSeconds));
  }
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
