import { getCookie, jsonResponse, buildClearSessionCookie } from '../../../../lib/server/routeHelpers.js';
import { SESSION_COOKIE_NAME } from '../../../../lib/server/config.js';
import { defaultSessionStore } from '../../../../lib/server/session.js';
import { defaultUpstreamClient } from '../../../../lib/server/upstream.js';

export async function GET(request) {
  let shouldClearCookie = false;
  try {
    const rawToken = getCookie(request, SESSION_COOKIE_NAME);
    if (rawToken) {
      const session = defaultSessionStore.getSession(rawToken);
      if (session) {
        const authResult = await defaultUpstreamClient.revalidateAuthResult(session.upstreamToken);
        if (authResult.status === 'authenticated') {
          return jsonResponse({
            authenticated: true,
            loginMode: 'password',
            expiresAt: session.expiresAt,
          });
        }
        if (authResult.status === 'unauthenticated') {
          defaultSessionStore.destroySession(rawToken);
          shouldClearCookie = true;
        }
      } else {
        shouldClearCookie = true;
      }
    }

    let loginMode = 'password';
    try {
      const upstreamRes = await defaultUpstreamClient.request('/api/auth/status', { method: 'GET' });
      if (upstreamRes.ok) {
        const data = await upstreamRes.json();
        const isSso =
          data.authMode === 'sso' ||
          data.authMode === 'saml' ||
          data.authMode === 'oidc' ||
          Boolean(data.oidcConfigured) ||
          Boolean(data.samlConfigured);
        if (isSso) {
          loginMode = 'unsupported-sso';
        }
      }
    } catch {
      // Keep default password loginMode
    }

    const headers = shouldClearCookie ? { 'Set-Cookie': buildClearSessionCookie() } : {};
    return jsonResponse(
      {
        authenticated: false,
        loginMode,
        expiresAt: null,
      },
      200,
      headers
    );
  } catch {
    const headers = shouldClearCookie ? { 'Set-Cookie': buildClearSessionCookie() } : {};
    return jsonResponse(
      {
        authenticated: false,
        loginMode: 'password',
        expiresAt: null,
      },
      200,
      headers
    );
  }
}
