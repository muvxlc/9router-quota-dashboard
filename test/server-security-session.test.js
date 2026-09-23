import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatApiError,
  createErrorResponse,
  ERROR_CODES,
} from '../lib/server/errors.js';
import {
  sanitizeLabel,
  validateOriginAndHeaders,
  validateConnectionId,
  isSecureCookie,
  sanitizeUpstreamError,
} from '../lib/server/security.js';
import {
  createSessionStore,
  createLoginLimiter,
} from '../lib/server/session.js';

// --- ERRORS CONTRACT TESTS ---
test('formatApiError produces exact error schema with private, no-store headers', () => {
  const err = formatApiError('INVALID_REQUEST', 'Missing parameter');
  assert.deepEqual(err, {
    error: {
      code: 'INVALID_REQUEST',
      message: 'Missing parameter',
      retryAfterSeconds: null,
    },
  });

  const res = createErrorResponse(400, 'INVALID_REQUEST', 'Bad input', null);
  assert.equal(res.status, 400);
  assert.equal(res.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  assert.equal(res.headers.get('Content-Type'), 'application/json');

  const rateLimitRes = createErrorResponse(429, 'RATE_LIMITED', 'Too many attempts', 60);
  assert.equal(rateLimitRes.status, 429);
  assert.equal(rateLimitRes.headers.get('Retry-After'), '60');
});

test('sanitizeUpstreamError replaces raw upstream leaks with fixed message', () => {
  const leaked = sanitizeUpstreamError(new Error('upstream connection refused at 10.0.0.1:8080 with secret_key_12345'));
  assert.equal(leaked.includes('10.0.0.1'), false);
  assert.equal(leaked.includes('secret_key_12345'), false);
  assert.equal(leaked, 'Upstream service error');
});

// --- SECURITY & SANITIZER TESTS ---
test('sanitizeLabel sanitizes name, email, displayName without leaking credentials or secrets', () => {
  // Never leak tokens, bearer, sk- or credentials
  assert.equal(sanitizeLabel({ email: 'user@example.com' }), 'user@example.com');
  assert.equal(sanitizeLabel({ displayName: 'Dev Account' }), 'Dev Account');
  assert.equal(sanitizeLabel({ name: 'sk-1234567890abcdef1234567890abcdef' }), 'sk-12345***');
  assert.equal(sanitizeLabel({ name: 'Bearer eyJhbGciOiJIUzI1NiIsIn...' }), 'Credential***');
  assert.equal(sanitizeLabel({ id: 'acc-1234' }), 'acc-1234');
  assert.equal(sanitizeLabel({}), 'Unknown');

  // Length capping
  const longName = 'A'.repeat(200);
  const sanitized = sanitizeLabel({ name: longName });
  assert.ok(sanitized.length <= 64);
});

test('validateConnectionId rejects path traversal, slashes, and control characters', () => {
  assert.equal(validateConnectionId('valid-id_123.abc'), true);
  assert.equal(validateConnectionId('../etc/passwd'), false);
  assert.equal(validateConnectionId('acc/sub'), false);
  assert.equal(validateConnectionId('acc\\sub'), false);
  assert.equal(validateConnectionId('acc\x00null'), false);
  assert.equal(validateConnectionId('acc\nnewline'), false);
  assert.equal(validateConnectionId(''), false);
  assert.equal(validateConnectionId('a'.repeat(129)), false);
  assert.equal(validateConnectionId('a'.repeat(128)), true);
});

test('validateOriginAndHeaders strictly verifies origin and JSON content-type', () => {
  const allowedOrigin = 'http://127.0.0.1:20130';

  // Valid POST request
  const validReq = {
    method: 'POST',
    headers: {
      get: (h) => {
        const lower = h.toLowerCase();
        if (lower === 'origin') return 'http://127.0.0.1:20130';
        if (lower === 'content-type') return 'application/json';
        if (lower === 'host') return '127.0.0.1:20130';
        return null;
      },
    },
  };
  const validCheck = validateOriginAndHeaders(validReq, allowedOrigin);
  assert.equal(validCheck.ok, true);

  // Mismatched origin (cross-site attempt)
  const attackerReq = {
    method: 'POST',
    headers: {
      get: (h) => {
        const lower = h.toLowerCase();
        if (lower === 'origin') return 'http://evil.com';
        if (lower === 'content-type') return 'application/json';
        if (lower === 'host') return '127.0.0.1:20130';
        return null;
      },
    },
  };
  const attackerCheck = validateOriginAndHeaders(attackerReq, allowedOrigin);
  assert.equal(attackerCheck.ok, false);
  assert.equal(attackerCheck.status, 403);
  assert.equal(attackerCheck.code, 'ORIGIN_REJECTED');

  // Missing origin on POST
  const missingOriginReq = {
    method: 'POST',
    headers: {
      get: (h) => {
        const lower = h.toLowerCase();
        if (lower === 'content-type') return 'application/json';
        if (lower === 'host') return '127.0.0.1:20130';
        return null;
      },
    },
  };
  const missingOriginCheck = validateOriginAndHeaders(missingOriginReq, allowedOrigin);
  assert.equal(missingOriginCheck.ok, false);
  assert.equal(missingOriginCheck.status, 403);

  // Invalid Content-Type
  const badTypeReq = {
    method: 'POST',
    headers: {
      get: (h) => {
        const lower = h.toLowerCase();
        if (lower === 'origin') return 'http://127.0.0.1:20130';
        if (lower === 'content-type') return 'text/plain';
        if (lower === 'host') return '127.0.0.1:20130';
        return null;
      },
    },
  };
  const badTypeCheck = validateOriginAndHeaders(badTypeReq, allowedOrigin);
  assert.equal(badTypeCheck.ok, false);
  assert.equal(badTypeCheck.status, 400);
});

test('isSecureCookie relies solely on configured origin scheme, not untrusted forward headers', () => {
  assert.equal(isSecureCookie('http://127.0.0.1:20130'), false);
  assert.equal(isSecureCookie('https://dashboard.example.com'), true);
});

// --- SESSION MANAGEMENT TESTS ---
test('createSessionStore handles 32-byte tokens, hashing, 8h expiry, and bounded capacity', () => {
  const store = createSessionStore({ maxSessions: 3, defaultTtlMs: 8 * 3600 * 1000 });

  // 1. Create session
  const session1 = store.createSession('upstream-token-1', null);
  assert.ok(session1.token);
  assert.equal(session1.token.length, 64); // 32 bytes hex
  assert.ok(session1.expiresAt);

  // 2. Retrieve session using raw token
  const retrieved1 = store.getSession(session1.token);
  assert.ok(retrieved1);
  assert.equal(retrieved1.upstreamToken, 'upstream-token-1');

  // 3. Unknown token returns null
  assert.equal(store.getSession('unknown-token'), null);

  // 4. Destroy session
  store.destroySession(session1.token);
  assert.equal(store.getSession(session1.token), null);

  // 5. Capped capacity and eviction
  const sA = store.createSession('tok-A', null);
  const sB = store.createSession('tok-B', null);
  const sC = store.createSession('tok-C', null);

  assert.throws(
    () => store.createSession('tok-D', null),
    (err) => err.code === 'SESSION_CAPACITY' && err.status === 503
  );

  store.addKnownAccounts(sC.token, ['acc-1', 'acc-2']);
  assert.equal(store.isKnownAccount(sC.token, 'acc-1'), true);
  assert.equal(store.isKnownAccount(sC.token, 'acc-3'), false);
});

// --- LOGIN LIMITER TESTS ---
test('createLoginLimiter limits failed attempts to 5 per 15 min and single inflight', () => {
  const limiter = createLoginLimiter({ maxFails: 5, windowMs: 15 * 60 * 1000 });

  // Initial check
  assert.equal(limiter.checkLocked().locked, false);

  // Inflight locking
  assert.equal(limiter.tryAcquireInflight(), true);
  assert.equal(limiter.tryAcquireInflight(), false); // Already inflight
  limiter.releaseInflight();
  assert.equal(limiter.tryAcquireInflight(), true);
  limiter.releaseInflight();

  // Failed attempts
  for (let i = 0; i < 4; i++) {
    limiter.recordFail();
    assert.equal(limiter.checkLocked().locked, false);
  }

  limiter.recordFail(); // 5th failure
  const locked = limiter.checkLocked();
  assert.equal(locked.locked, true);
  assert.ok(locked.retryAfterSeconds > 0);

  // Success resets
  limiter.reset();
  assert.equal(limiter.checkLocked().locked, false);
});
