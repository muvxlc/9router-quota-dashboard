import { UPSTREAM_BASE_URL, LIMITS } from './config.js';

const ALLOWED_PATH_PREFIXES = [
  '/api/auth/status',
  '/api/auth/login',
  '/api/providers/client',
  '/api/usage',
  '/api/usage/stats',
  '/api/usage/chart',
];

export function isAllowedPath(path) {
  if (typeof path !== 'string') return false;
  if (path.includes('..') || path.includes('\\') || /[\x00-\x1f\x7f]/.test(path)) {
    return false;
  }
  const cleanPath = path.split('?')[0];
  return ALLOWED_PATH_PREFIXES.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`));
}

export async function readBoundedStreamText(stream, maxBytes) {
  if (!stream) return '';
  const reader = stream.getReader();
  const chunks = [];
  let totalBytes = 0;
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          const err = new Error('Payload exceeds maximum size');
          err.code = 'INVALID_REQUEST';
          err.status = 400;
          throw err;
        }
        chunks.push(decoder.decode(value, { stream: true }));
      }
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    reader.releaseLock?.();
  }
}

export async function readBoundedResponseText(response, maxBytes = LIMITS.MAX_UPSTREAM_BODY_BYTES) {
  const cl = response.headers?.get?.('content-length');
  if (cl && Number(cl) > maxBytes) {
    const err = new Error('Upstream response exceeds maximum size');
    err.code = 'INVALID_UPSTREAM_RESPONSE';
    err.status = 502;
    throw err;
  }
  if (response.body) {
    try {
      return await readBoundedStreamText(response.body, maxBytes);
    } catch (err) {
      if (err.code === 'INVALID_REQUEST') {
        const upErr = new Error('Upstream response exceeds maximum size');
        upErr.code = 'INVALID_UPSTREAM_RESPONSE';
        upErr.status = 502;
        throw upErr;
      }
      throw err;
    }
  }
  if (typeof response.text === 'function') {
    return response.text();
  }
  if (typeof response.json === 'function') {
    const obj = await response.json();
    return JSON.stringify(obj);
  }
  return '';
}

async function defaultProtoRevalidateAuth(token) {
  const result = await this.revalidateAuthResult(token);
  return result.status === 'authenticated';
}

export function createUpstreamClient(options = {}) {
  const baseUrl = UPSTREAM_BASE_URL;
  const fetchFn = options.fetchFn || globalThis.fetch;
  const timeoutMs = options.timeoutMs || LIMITS.UPSTREAM_TIMEOUT_MS;

  const client = {
    async request(path, init = {}, upstreamToken = null) {
      if (typeof path !== 'string' || path.startsWith('http://') || path.startsWith('https://')) {
        const err = new Error('Invalid request target');
        err.code = 'INVALID_REQUEST';
        err.status = 400;
        throw err;
      }

      if (!isAllowedPath(path)) {
        const err = new Error('Upstream path not permitted');
        err.code = 'INVALID_REQUEST';
        err.status = 400;
        throw err;
      }

      const headers = new Headers(init.headers || {});
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
      }

      if (upstreamToken) {
        headers.set('Cookie', `auth_token=${upstreamToken}`);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      if (init.signal) {
        if (init.signal.aborted) {
          controller.abort(init.signal.reason);
        } else {
          init.signal.addEventListener('abort', () => controller.abort(init.signal.reason), { once: true });
        }
      }

      try {
        const fullUrl = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
        const response = await fetchFn(fullUrl, {
          ...init,
          headers,
          redirect: 'manual',
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.status >= 300 && response.status < 400) {
          const err = new Error('Upstream redirects are prohibited');
          err.code = 'INVALID_UPSTREAM_RESPONSE';
          err.status = 502;
          throw err;
        }

        return response;
      } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
          const timeoutErr = new Error('Upstream request timed out');
          timeoutErr.code = 'UPSTREAM_TIMEOUT';
          timeoutErr.status = 504;
          throw timeoutErr;
        }
        if (err.code === 'INVALID_REQUEST' || err.code === 'INVALID_UPSTREAM_RESPONSE') {
          throw err;
        }
        const unavailableErr = new Error('Upstream router unavailable');
        unavailableErr.code = 'UPSTREAM_UNAVAILABLE';
        unavailableErr.status = 503;
        throw unavailableErr;
      }
    },

    async revalidateAuthResult(upstreamToken) {
      if (Object.hasOwn(this, 'revalidateAuth') && this.revalidateAuth !== defaultProtoRevalidateAuth) {
        const ok = await this.revalidateAuth(upstreamToken);
        return { status: ok ? 'authenticated' : 'unauthenticated', authenticated: Boolean(ok) };
      }

      if (!upstreamToken) return { status: 'unauthenticated', authenticated: false };
      try {
        const res = await this.request('/api/auth/status', { method: 'GET' }, upstreamToken);
        if (res.status === 401) {
          return { status: 'unauthenticated', authenticated: false };
        }
        if (!res.ok) {
          return { status: 'error', transportError: true, authenticated: null };
        }
        const rawText = await readBoundedResponseText(res);
        const data = JSON.parse(rawText);
        return {
          status: data.authenticated === true ? 'authenticated' : 'unauthenticated',
          authenticated: data.authenticated === true,
          data,
        };
      } catch (err) {
        return { status: 'error', transportError: true, authenticated: null, error: err };
      }
    },

    revalidateAuth: defaultProtoRevalidateAuth,
  };

  return client;
}

export const defaultUpstreamClient = createUpstreamClient();
