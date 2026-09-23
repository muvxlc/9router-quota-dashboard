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

  try {
    const statsRes = await defaultUpstreamClient.request(
      `/api/usage/stats?period=${period}`,
      { method: 'GET' },
      session.upstreamToken
    );
    if (!statsRes.ok) {
      return createErrorResponse(502, 'INVALID_UPSTREAM_RESPONSE');
    }
    const statsText = await readBoundedResponseText(statsRes);
    statsData = JSON.parse(statsText);
  } catch (err) {
    const status = err.status || 503;
    const code = err.code || 'UPSTREAM_UNAVAILABLE';
    return createErrorResponse(status, code);
  }

  try {
    const chartRes = await defaultUpstreamClient.request(
      `/api/usage/chart?period=${period}`,
      { method: 'GET' },
      session.upstreamToken
    );
    if (chartRes.ok) {
      const chartText = await readBoundedResponseText(chartRes);
      chartData = JSON.parse(chartText);
    }
  } catch {
    chartData = [];
  }

  const normalized = normalizeStats(period, statsData, chartData);
  return jsonResponse(normalized);
}
