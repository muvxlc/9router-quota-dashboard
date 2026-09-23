export const DEFAULT_UPSTREAM_BASE_URL = 'https://9router.bangkhan.com';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function resolveUpstreamBaseUrl(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return DEFAULT_UPSTREAM_BASE_URL;
  }
  if (typeof rawValue !== 'string') {
    throw new Error('Invalid UPSTREAM_BASE_URL: must be a string');
  }
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return DEFAULT_UPSTREAM_BASE_URL;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid UPSTREAM_BASE_URL: malformed URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Invalid UPSTREAM_BASE_URL: protocol must be http or https');
  }

  if (parsed.username || parsed.password) {
    throw new Error('Invalid UPSTREAM_BASE_URL: credentials not permitted');
  }

  if (parsed.search) {
    throw new Error('Invalid UPSTREAM_BASE_URL: query parameters not permitted');
  }

  if (parsed.hash) {
    throw new Error('Invalid UPSTREAM_BASE_URL: hash fragment not permitted');
  }

  if (parsed.pathname && parsed.pathname.replace(/\/+$/, '') !== '') {
    throw new Error('Invalid UPSTREAM_BASE_URL: base path must be empty');
  }

  if (!parsed.hostname) {
    throw new Error('Invalid UPSTREAM_BASE_URL: hostname required');
  }

  if (parsed.protocol === 'http:') {
    const host = parsed.hostname.toLowerCase();
    if (!LOOPBACK_HOSTS.has(host)) {
      throw new Error('Invalid UPSTREAM_BASE_URL: must be HTTPS or loopback HTTP');
    }
  }

  return parsed.origin;
}
