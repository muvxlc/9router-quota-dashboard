# API Route Knowledge Base

## OVERVIEW
Next.js route handlers for authenticated dashboard data and live streams; separate endpoint directory earns focused guidance.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Login, logout, session status | `auth/*/route.js` | Session cookie and login limiter |
| Connections and governor | `connections/route.js`, `connections/[id]/governor/route.js` | Validated identifiers and governor state |
| Quota and stats | `quota/[id]/route.js`, `stats/route.js` | Authenticated upstream fetch and normalization |
| Live models | `live-models/route.js`, `live-models/summary/route.js` | SSE and sanitized summary endpoints |
| Health | `health/route.js` | Readiness/status endpoint |

## CONVENTIONS
- Use Web `Request` and `Response` APIs; share guards and serialization from `lib/server/`.
- Validate path identifiers and request origins before protected work.
- Normalize upstream payloads and bound response/time behavior through server clients.

## ANTI-PATTERNS
- NEVER expose upstream credentials, raw session tokens, or unsanitized provider identity.
- NEVER skip `requireAuthSession` on protected routes or bypass `createErrorResponse` for errors.
- NEVER fetch arbitrary URLs or accept unchecked connection IDs.
