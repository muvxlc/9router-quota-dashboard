import { handleSummaryRequest } from '../../../../lib/server/maxplusSummaryRoute.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  return handleSummaryRequest(request);
}
