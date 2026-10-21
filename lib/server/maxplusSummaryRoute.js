import { requireAuthSession, jsonResponse } from './routeHelpers.js';
import { createErrorResponse, ERROR_CODES } from './errors.js';
import { readBoundedResponseText } from './upstream.js';
import { mapMaxplusStatus, defaultMaxplusClient } from './maxplus.js';
import { sanitizeMaxplusSummary } from './maxplusSummary.js';

const SUMMARY_CACHE_TTL_MS = 30 * 1000;

// ponytail: one global cache entry - billing has a single credential shared by
// every tab, so any uncached outcome multiplies the billed pair.
let snapshotCache = null; // { snapshot, expiresAt } | { error: { status, code }, expiresAt }
let inFlight = null;

export function resetSummaryCache() {
  snapshotCache = null;
  inFlight = null;
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

  async function load() {
    const [usageResult, meResult] = await Promise.allSettled([
      fetchSide(client, '/v1/usage'),
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
    if (url.searchParams.size > 0) {
      return createErrorResponse(400, 'INVALID_REQUEST');
    }

    const current = now();
    if (snapshotCache && current < snapshotCache.expiresAt) {
      return outcomeResponse(snapshotCache);
    }

    if (!inFlight) {
      inFlight = (async () => {
        try {
          const outcome = await load();
          snapshotCache = { ...outcome, expiresAt: now() + cacheTtlMs };
          return outcome;
        } finally {
          inFlight = null;
        }
      })();
    }

    return outcomeResponse(await inFlight);
  };
}

export const handleSummaryRequest = createSummaryHandler();
