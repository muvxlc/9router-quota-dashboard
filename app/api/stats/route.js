import { requireAuthSession, jsonResponse } from '../../../lib/server/routeHelpers.js';
import { createErrorResponse } from '../../../lib/server/errors.js';
import { defaultUpstreamClient, readBoundedResponseText } from '../../../lib/server/upstream.js';
import { normalizeStats } from '../../../lib/server/normalize.js';

const VALID_PERIODS = new Set(['24h', '7d', '30d']);

export async function GET(request) {
  const { session, errorResponse } = await requireAuthSession(request);
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  for (const key of url.searchParams.keys()) {
    if (key !== 'period') {
      return createErrorResponse(400, 'INVALID_REQUEST');
    }
  }

  const period = url.searchParams.get('period') || '7d';
  if (!VALID_PERIODS.has(period)) {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }

  let statsData = null;
  let chartData = [];

  // ponytail: parallel fetch stats + chart; chart failure degrades gracefully to empty array
  const [statsResult, chartResult] = await Promise.allSettled([
    (async () => {
      const statsRes = await defaultUpstreamClient.request(
        `/api/usage/stats?period=${period}`,
        { method: 'GET' },
        session.upstreamToken
      );
      if (!statsRes.ok) {
        const err = new Error('Invalid upstream response');
        err.status = 502;
        err.code = 'INVALID_UPSTREAM_RESPONSE';
        throw err;
      }
      const statsText = await readBoundedResponseText(statsRes);
      return JSON.parse(statsText);
    })(),
    (async () => {
      const chartRes = await defaultUpstreamClient.request(
        `/api/usage/chart?period=${period}`,
        { method: 'GET' },
        session.upstreamToken
      );
      if (chartRes.ok) {
        const chartText = await readBoundedResponseText(chartRes);
        return JSON.parse(chartText);
      }
      return [];
    })(),
  ]);

  if (statsResult.status === 'rejected') {
    const err = statsResult.reason;
    const status = err.status || 503;
    const code = err.code || 'UPSTREAM_UNAVAILABLE';
    return createErrorResponse(status, code);
  }

  statsData = statsResult.value;
  if (chartResult.status === 'fulfilled') {
    chartData = chartResult.value;
  }

  const normalized = normalizeStats(period, statsData, chartData);
  return jsonResponse(normalized);
}
