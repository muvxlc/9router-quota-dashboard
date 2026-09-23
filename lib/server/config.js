import { resolveUpstreamBaseUrl } from './configBaseUrl.js';

export const UPSTREAM_BASE_URL = resolveUpstreamBaseUrl(process.env.UPSTREAM_BASE_URL);
export const APP_ORIGIN = (process.env.APP_ORIGIN || 'http://127.0.0.1:20130').replace(/\/+$/, '');

export const LIMITS = {
  MAX_LOGIN_BODY_BYTES: 4096, // 4KiB
  MAX_PASSWORD_LENGTH: 1024,
  MAX_CONNECTION_ID_LENGTH: 128,
  MAX_SESSIONS: 100,
  SESSION_TTL_MS: 8 * 60 * 60 * 1000, // 8 hours
  LOGIN_MAX_FAILS: 5,
  LOGIN_LOCKOUT_MS: 15 * 60 * 1000, // 15 minutes
  MAX_QUOTA_CONCURRENCY: 4,
  DEFAULT_QUOTA_CADENCE_MS: 60 * 1000, // 60s
  CLAUDE_QUOTA_CADENCE_MS: 600 * 1000, // 600s
  UPSTREAM_TIMEOUT_MS: 10000,
  MAX_UPSTREAM_BODY_BYTES: 2 * 1024 * 1024, // 2MB
  DIRECTORY_COOLDOWN_MS: 30 * 1000, // 30s
};

export const SESSION_COOKIE_NAME = 'quota_session';
