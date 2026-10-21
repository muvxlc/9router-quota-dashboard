# Server Domain Knowledge Base

## OVERVIEW
Backend runtime logic managing upstream API communication, in-memory sessions, security guards, and response normalization (Score: 10, distinct domain).

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Upstream HTTP proxy | `lib/server/upstream.js` | Enforces URL bounds, timeouts, and whitelisting |
| Base URL resolution | `lib/server/configBaseUrl.js` | Resolves and validates UPSTREAM_BASE_URL |
| Configuration limits | `lib/server/config.js` | Timeout constants, cookie names, origin targets |
| Auth & session storage | `lib/server/session.js` | In-memory SHA-256 session store and governor state |
| Route guards & cookies | `lib/server/routeHelpers.js` | `requireAuthSession`, singleflight upstream revalidation |
| Quota normalization | `lib/server/normalize.js` | Unifies standard and legacy quota schemas |
| Antigravity quota parser | `lib/server/normalizeAntigravity.js` | Parses Antigravity window structures |
| Sanitization & redaction | `lib/server/security.js` | Strips bearer tokens and sensitive keys |
| Live model stream SSE | `lib/server/liveModels.js` | Server-Sent Events broker for upstream models |
| Live models display guard | `lib/server/liveModelsSanitize.js` | Masks sensitive provider labels |
| Standardized errors | `lib/server/errors.js` | Standard JSON error generator with codes |
| MaxPlus upstream | `lib/server/maxplus.js` | Allowlisted billing API client |
| MaxPlus summary | `lib/server/maxplusSummary.js`, `maxplusSummaryRoute.js` | Payload sanitization and bounded summary cache/handler |
| Provider labels | `lib/server/providerLabels.js` | Cached upstream node labels |

## CONVENTIONS
- Fail-closed security: missing or malformed auth fails before proxying upstream.
- Singleflight revalidation: concurrent auth checks coalesce into one upstream request.
- Pure Node crypto: uses `node:crypto` for session token generation and SHA-256 hashing.
- Strict payload sanitization: always scrub sensitive credentials before returning downstream.
- `routeHelpers.js` centralizes auth/session checks, quota cache state, and singleflight work; treat changes as security- and concurrency-sensitive.
- Client `lib/client/maxplusSummary.js` handles presentation/merging; this subtree owns upstream access and server-side sanitization.

## ANTI-PATTERNS
- NEVER store raw session tokens; hash with SHA-256 prior to in-memory lookup.
- NEVER allow arbitrary URLs in `upstreamClient`; enforce strict path whitelisting.
- NEVER bypass `createErrorResponse`; maintain unified error schema across all endpoints.
- DO NOT assume multi-node session replication; state is ephemeral in-process `Map`.
