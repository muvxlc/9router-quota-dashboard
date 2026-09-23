import { jsonResponse } from '../../../lib/server/routeHelpers.js';

export async function GET() {
  // ponytail: minimal health endpoint for container supervisor. add deep dependency checks when multi-service orchestration requires it.
  return jsonResponse({ status: 'ok' });
}
