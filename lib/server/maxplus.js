import { LIMITS, MAXPLUS_BASE_URL, MAXPLUS_API_KEY } from './config.js';
import { ERROR_CODES } from './errors.js';
import { readBoundedResponseText } from './upstream.js';

export const MAXPLUS_ALLOWED_PATHS = ['/v1/usage', '/v1/me'];

export function isAllowedMaxplusPath(path) {
  if (typeof path !== 'string') return false;
  if (path.includes('..') || path.includes('\\') || /[\x00-\x1f\x7f]/.test(path)) {
    return false;
  }
  const cleanPath = path.split('?')[0];
  return MAXPLUS_ALLOWED_PATHS.includes(cleanPath);
}

export function mapMaxplusStatus(status) {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403) return 'UPSTREAM_FORBIDDEN';
  if (status === 404) return 'UPSTREAM_NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  return 'UPSTREAM_UNAVAILABLE';
}

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  err.status = ERROR_CODES[code]?.status ?? 502;
  return err;
}

export function createMaxplusClient(options = {}) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const baseUrl = options.baseUrl === undefined ? MAXPLUS_BASE_URL : options.baseUrl;
  const apiKey = options.apiKey === undefined ? MAXPLUS_API_KEY : options.apiKey;
  const defaultTimeoutMs = options.timeoutMs || LIMITS.MAXPLUS_TIMEOUT_MS;

  return {
    async request(path, { method = 'GET', timeoutMs } = {}) {
      if (!isAllowedMaxplusPath(path)) {
        throw fail('INVALID_REQUEST', 'Billing path not permitted');
      }

      const key = typeof apiKey === 'string' ? apiKey.trim() : '';
      if (baseUrl === null || !key) {
        throw fail('MAXPLUS_UNCONFIGURED', 'Billing service is not configured');
      }

      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${key}`,
      };

      const requestTimeoutMs = (typeof timeoutMs === 'number' && timeoutMs > 0) ? timeoutMs : defaultTimeoutMs;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

      try {
        const response = await fetchFn(new URL(path, baseUrl).toString(), {
          method,
          headers,
          redirect: 'manual',
          signal: controller.signal,
        });

        if (response.status >= 300 && response.status < 400) {
          throw fail('INVALID_UPSTREAM_RESPONSE', 'Billing redirects are prohibited');
        }

        const mappedCode = mapMaxplusStatus(response.status);
        if (mappedCode) {
          // Drain a bounded amount so the socket is released; the body is never surfaced.
          try {
            await readBoundedResponseText(response);
          } catch {
            // Body read failure must not replace the status mapping.
          }
          throw fail(mappedCode, 'Billing upstream rejected the request');
        }

        return response;
      } catch (err) {
        if (err.code === 'INVALID_REQUEST' || err.code === 'INVALID_UPSTREAM_RESPONSE'
          || err.code === 'UPSTREAM_FORBIDDEN' || err.code === 'UPSTREAM_NOT_FOUND'
          || err.code === 'RATE_LIMITED' || err.code === 'UPSTREAM_UNAVAILABLE') {
          throw err;
        }
        if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
          throw fail('UPSTREAM_TIMEOUT', 'Billing request timed out');
        }
        throw fail('UPSTREAM_UNAVAILABLE', 'Billing service unavailable');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export const defaultMaxplusClient = createMaxplusClient();
