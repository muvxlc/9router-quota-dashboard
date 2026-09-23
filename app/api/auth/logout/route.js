import { APP_ORIGIN, SESSION_COOKIE_NAME } from '../../../../lib/server/config.js';
import { validateOriginAndHeaders } from '../../../../lib/server/security.js';
import { defaultSessionStore } from '../../../../lib/server/session.js';
import { createErrorResponse } from '../../../../lib/server/errors.js';
import { getCookie, buildClearSessionCookie, jsonResponse } from '../../../../lib/server/routeHelpers.js';

export async function POST(request) {
  const headerCheck = validateOriginAndHeaders(request, APP_ORIGIN);
  if (!headerCheck.ok) {
    return createErrorResponse(headerCheck.status, headerCheck.code, headerCheck.message);
  }

  const rawToken = getCookie(request, SESSION_COOKIE_NAME);
  if (rawToken) {
    defaultSessionStore.destroySession(rawToken);
  }

  return jsonResponse(
    { authenticated: false },
    200,
    { 'Set-Cookie': buildClearSessionCookie() }
  );
}
