import { requireAuthSession, jsonResponse } from './routeHelpers.js';
import { createErrorResponse, ERROR_CODES } from './errors.js';
import { readBoundedResponseText } from './upstream.js';
import { mapMaxplusStatus, defaultMaxplusClient } from './maxplus.js';
import { sanitizeMaxplusSummary } from './maxplusSummary.js';

const SUMMARY_CACHE_TTL_MS = 30 * 1000;
const VALID_PERIODS = ['1d', '7d', '30d', 'all'];
const DEFAULT_PERIOD = '1d';

// ponytail: one cache entry per period (max 4) - billing has a single credential
// shared by every tab, so any uncached outcome multiplies the billed pair.
let snapshotCache = new Map(); // period -> { snapshot, expiresAt } | { error, expiresAt }
let inFlight = new Map(); // period -> promise

export function resetSummaryCache() {
  snapshotCache = new Map();
  inFlight = new Map();
}

function upstreamError(code) {
  const err = new Error('Billing upstream request failed');
  err.code = code;
  err.status = ERROR_CODES[code]?.status ?? 502;
  return err;
}

async function fetchSide(client, path) {
  const res = await client.request(path);
  const code = mapMaxplusStatus(res.status);
  if (code) throw upstreamError(code);
  const text = await readBoundedResponseText(res);
  try {
    return JSON.parse(text);
  } catch {
    throw upstreamError('INVALID_UPSTREAM_RESPONSE');
  }
}

function outcomeResponse(outcome) {
  if (outcome.error) {
    return createErrorResponse(outcome.error.status, outcome.error.code);
  }
  return jsonResponse(outcome.snapshot);
}

// now: () => epoch milliseconds (injectable clock); cacheTtlMs defaults to 30s.
export function createSummaryHandler(options = {}) {
  const client = options.client || defaultMaxplusClient;
  const now = options.now || Date.now;
  const cacheTtlMs = options.cacheTtlMs ?? SUMMARY_CACHE_TTL_MS;

  async function load(period) {
    const [usageResult, meResult] = await Promise.allSettled([
      fetchSide(client, `/v1/usage?period=${period}`),
      fetchSide(client, '/v1/me'),
    ]);

    if (usageResult.status === 'rejected' && meResult.status === 'rejected') {
      const usageErr = usageResult.reason;
      const meErr = meResult.reason;
      const err = usageErr.code === 'MAXPLUS_UNCONFIGURED'
        ? usageErr
        : (meErr.code === 'MAXPLUS_UNCONFIGURED' ? meErr : usageErr);
      return { error: { status: err.status || 503, code: err.code || 'UPSTREAM_UNAVAILABLE' } };
    }

    const usage = usageResult.status === 'fulfilled' ? usageResult.value : null;
    const me = meResult.status === 'fulfilled' ? meResult.value : null;
    return {
      snapshot: sanitizeMaxplusSummary({ usage, me, now: new Date(now()).toISOString() }),
    };
  }

  return async function handler(request) {
    const { errorResponse } = await requireAuthSession(request);
    if (errorResponse) return errorResponse;

    const url = new URL(request.url);
    for (const key of url.searchParams.keys()) {
      if (key !== 'period') {
        return createErrorResponse(400, 'INVALID_REQUEST');
      }
    }

    const period = url.searchParams.has('period') ? url.searchParams.get('period') : DEFAULT_PERIOD;
    if (!VALID_PERIODS.includes(period)) {
      return createErrorResponse(400, 'INVALID_REQUEST');
    }

    const current = now();
    const cached = snapshotCache.get(period);
    if (cached && current < cached.expiresAt) {
      return outcomeResponse(cached);
    }

    if (!inFlight.has(period)) {
      inFlight.set(period, (async () => {
        try {
          const outcome = await load(period);
          snapshotCache.set(period, { ...outcome, expiresAt: now() + cacheTtlMs });
          return outcome;
        } finally {
          inFlight.delete(period);
        }
      })());
    }

    return outcomeResponse(await inFlight.get(period));
  };
}

export const handleSummaryRequest = createSummaryHandler();
