import { requireAuthSession } from '../../../lib/server/routeHelpers.js';
import { createErrorResponse } from '../../../lib/server/errors.js';
import { createLiveModelsStream } from '../../../lib/server/liveModels.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { session, token, errorResponse } = await requireAuthSession(request);
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  if (url.searchParams.size > 0) {
    return createErrorResponse(400, 'INVALID_REQUEST');
  }

  const stream = createLiveModelsStream({
    upstreamToken: session.upstreamToken,
    sessionToken: token,
    abortSignal: request.signal,
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
