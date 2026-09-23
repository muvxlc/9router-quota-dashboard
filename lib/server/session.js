import crypto from 'node:crypto';
import { LIMITS } from './config.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function createSessionStore(options = {}) {
  const maxSessions = options.maxSessions || LIMITS.MAX_SESSIONS;
  const defaultTtlMs = options.defaultTtlMs || LIMITS.SESSION_TTL_MS;
  const sessions = new Map(); // key: tokenHash -> session

  function cleanExpired() {
    const now = Date.now();
    for (const [hash, session] of sessions.entries()) {
      if (new Date(session.expiresAt).getTime() <= now) {
        sessions.delete(hash);
      }
    }
  }

  return {
    createSession(upstreamToken, upstreamExpiresAt = null) {
      cleanExpired();
      if (sessions.size >= maxSessions) {
        const err = new Error('Server session capacity reached');
        err.code = 'SESSION_CAPACITY';
        err.status = 503;
        throw err;
      }

      const rawBytes = crypto.randomBytes(32);
      const token = rawBytes.toString('hex');
      const tokenHash = hashToken(token);
      const now = Date.now();

      let expiresAtMs = now + defaultTtlMs;
      if (upstreamExpiresAt) {
        const upstreamMs = new Date(upstreamExpiresAt).getTime();
        if (Number.isFinite(upstreamMs) && upstreamMs > now) {
          expiresAtMs = Math.min(expiresAtMs, upstreamMs);
        }
      }

      const session = {
        tokenHash,
        upstreamToken,
        createdAt: now,
        lastAccessAt: now,
        expiresAt: new Date(expiresAtMs).toISOString(),
        knownAccounts: new Set(),
        accountProviders: new Map(),
      };

      sessions.set(tokenHash, session);
      return { token, expiresAt: session.expiresAt };
    },

    getSession(token) {
      if (!token || typeof token !== 'string') return null;
      const tokenHash = hashToken(token);
      const session = sessions.get(tokenHash);
      if (!session) return null;

      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        sessions.delete(tokenHash);
        return null;
      }

      session.lastAccessAt = Date.now();
      return session;
    },

    destroySession(token) {
      if (!token) return;
      const tokenHash = hashToken(token);
      sessions.delete(tokenHash);
    },

    addKnownAccounts(token, accounts = []) {
      const session = this.getSession(token);
      if (!session) return;
      for (const item of accounts) {
        if (!item) continue;
        const id = typeof item === 'object' ? item.id : item;
        const provider = typeof item === 'object' ? item.provider : null;
        if (id && session.knownAccounts.size < 500) {
          const strId = String(id);
          session.knownAccounts.add(strId);
          if (provider && session.accountProviders) {
            session.accountProviders.set(strId, String(provider));
          }
        }
      }
    },

    getAccountProvider(token, accountId) {
      const session = this.getSession(token);
      if (!session || !accountId || !session.accountProviders) return null;
      return session.accountProviders.get(String(accountId)) || null;
    },

    isKnownAccount(token, accountId) {
      const session = this.getSession(token);
      if (!session || !accountId) return false;
      return session.knownAccounts.has(String(accountId));
    },

    size() {
      cleanExpired();
      return sessions.size;
    },

    clear() {
      sessions.clear();
    },
  };
}

export function createLoginLimiter(options = {}) {
  const maxFails = options.maxFails || LIMITS.LOGIN_MAX_FAILS;
  const windowMs = options.windowMs || LIMITS.LOGIN_LOCKOUT_MS;
  const failures = [];
  let inflight = false;

  function prune(now = Date.now()) {
    while (failures.length > 0 && now - failures[0] > windowMs) {
      failures.shift();
    }
  }

  return {
    tryAcquireInflight() {
      if (inflight) return false;
      inflight = true;
      return true;
    },

    releaseInflight() {
      inflight = false;
    },

    recordFail() {
      const now = Date.now();
      prune(now);
      failures.push(now);
    },

    checkLocked() {
      const now = Date.now();
      prune(now);
      if (failures.length >= maxFails) {
        const oldest = failures[0];
        const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        return { locked: true, retryAfterSeconds };
      }
      return { locked: false, retryAfterSeconds: null };
    },

    reset() {
      failures.length = 0;
      inflight = false;
    },
  };
}

// Global persistence across hot-reload in Next.js development and process instances
if (!globalThis._quotaSessionStore) {
  globalThis._quotaSessionStore = createSessionStore();
}
if (!globalThis._quotaLoginLimiter) {
  globalThis._quotaLoginLimiter = createLoginLimiter();
}

export const defaultSessionStore = globalThis._quotaSessionStore;
export const defaultLoginLimiter = globalThis._quotaLoginLimiter;
