export const DEFAULT_UPSTREAM_BASE_URL = 'https://router.bangkhan.com';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function resolveBaseUrl(rawValue, { fallback = null, envName = 'UPSTREAM_BASE_URL' } = {}) {
  if (rawValue === undefined || rawValue === null) {
    return fallback;
  }
  if (typeof rawValue !== 'string') {
    throw new Error(`Invalid ${envName}: must be a string`);
  }
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return fallback;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid ${envName}: malformed URL`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid ${envName}: protocol must be http or https`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`Invalid ${envName}: credentials not permitted`);
  }

  if (parsed.search) {
    throw new Error(`Invalid ${envName}: query parameters not permitted`);
  }

  if (parsed.hash) {
    throw new Error(`Invalid ${envName}: hash fragment not permitted`);
  }

  if (parsed.pathname && parsed.pathname.replace(/\/+$/, '') !== '') {
    throw new Error(`Invalid ${envName}: base path must be empty`);
  }

  if (!parsed.hostname) {
    throw new Error(`Invalid ${envName}: hostname required`);
  }

  if (parsed.protocol === 'http:') {
    const host = parsed.hostname.toLowerCase();
    if (!LOOPBACK_HOSTS.has(host)) {
      throw new Error(`Invalid ${envName}: must be HTTPS or loopback HTTP`);
    }
  }

  return parsed.origin;
}

export function resolveUpstreamBaseUrl(rawValue) {
  return resolveBaseUrl(rawValue, { fallback: DEFAULT_UPSTREAM_BASE_URL, envName: 'UPSTREAM_BASE_URL' });
}
