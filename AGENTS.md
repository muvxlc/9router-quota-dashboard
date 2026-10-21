# PROJECT KNOWLEDGE BASE

**Generated:** 2026-10-21 UTC
**Commit:** ce3a0da
**Branch:** main

## OVERVIEW
Next.js 16 real-time quota and usage dashboard for LLM provider routers, using 9router upstream, React, custom CSS, and Node.js native tests.

## STRUCTURE
```
quota-dashboard/
├── app/              # Next.js App Router UI, API routes, styles, components
├── lib/
│   ├── client/       # Data hooks, selectors, API access, presentation logic
│   └── server/       # Upstream boundary, auth/session, route helpers, normalization
├── test/             # Native node:test suite; happy-dom UI tests
└── app/styles/       # Global CSS split by UI surface
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Dashboard orchestration | `app/page.js` | Top-level state coordinator, modals, auto-refresh |
| UI components | `app/components/` | Dashboard views, cards, tables, toolbar, dialogs |
| Global styles | `app/styles/` | Tokens and surface-specific CSS; imported by `app/layout.js` |
| API Route Handlers | `app/api/**/route.js` | Web standard Request/Response endpoints |
| Upstream proxy client | `lib/server/upstream.js` | Network boundary to 9router with bounds checking |
| Session & governor store | `lib/server/session.js` | Ephemeral SHA-256 session token store and governor state |
| Route middleware guards | `lib/server/routeHelpers.js` | `requireAuthSession`, singleflight upstream revalidation |
| Quota normalization | `lib/server/normalize.js` | Converts diverse provider payloads into standard quota schema |
| React data hooks | `lib/client/useQuotaData.js` | Manages connection list, quota caching, background fetch |
| Quota status selectors | `lib/client/selectors.js` | Status computation, provider pooling, pool averages |
| Formatting & countdowns | `lib/client/formatters.js` | Relative time calculations and token count display |
| Automated test suite | `test/*.test.js` | Native unit and integration tests (`node --test`) |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `defaultUpstreamClient` | Constant | `lib/server/upstream.js` | 102 | Central HTTP client proxying 9router |
| `defaultSessionStore` | Constant | `lib/server/session.js` | 78 | In-memory token hash and governor map |
| `createErrorResponse` | Function | `lib/server/errors.js` | 56 | Standardized JSON error response generator |
| `normalizeQuotaData` | Function | `lib/server/normalize.js` | 34 | Core normalization for quota and model info |
| `resolveUpstreamBaseUrl` | Function | `lib/server/configBaseUrl.js` | 33 | Dynamic/fallback resolution of upstream target |
| `UPSTREAM_BASE_URL` | Constant | `lib/server/config.js` | 32 | Configured upstream service address |
| `deriveAccountStatus` | Function | `lib/client/selectors.js` | 26 | Computes OK/WARN/EXHAUSTED account status |
| `LIMITS` | Constant | `lib/server/config.js` | 26 | Concurrency caps, timeouts, and batch size |
| `formatTokens` | Function | `lib/client/formatters.js` | 25 | Formats large numeric token usage strings |
| `createLiveModelsSubscription` | Function | `lib/client/liveModels.js` | 24 | Client SSE connection for live model updates |
| `buildSessionCookie` | Function | `lib/server/routeHelpers.js` | 24 | Serializes secure HttpOnly session cookie |
| `maskEmail` | Function | `lib/client/accountPresentation.js` | 23 | Redacts account email identities for display |
| `createUpstreamClient` | Function | `lib/server/upstream.js` | — | Bounded upstream HTTP client and auth revalidation |
| `groupAccountsByProvider` | Function | `lib/client/selectors.js` | — | Builds provider groups and visible quota windows |

## CONVENTIONS
- Pure ES modules (`"type": "module"`) and vanilla JavaScript throughout; no TypeScript.
- Native Node.js test runner (`node:test`) only; no Jest, Vitest, or Babel.
- Webpack build explicitly enforced (`next build --webpack`).
- Global styles are split across `app/styles/*.css`; design tokens live in `tokens.css`.
- API handlers share auth/error helpers in `lib/server/routeHelpers.js` and `lib/server/errors.js`.
- Zero external UI libraries: vanilla CSS with CSS custom properties in `app/styles/tokens.css`.
- Fail-closed authentication with singleflight revalidation to protect upstream from burst requests.

## ANTI-PATTERNS (THIS PROJECT)
- NEVER install third-party testing frameworks or state management libraries.
- NEVER expose raw auth tokens or upstream credentials in responses or logs.
- NEVER write CSS inside components with Tailwind or CSS Modules; use `app/styles/`.
- NEVER bypass `createErrorResponse` in API route error branches.
- NEVER loosen URL/path, response-size, timeout, or session bounds at server trust boundaries without updating their tests.

## UNIQUE STYLES
- Bounded in-memory state: session store and singleflight caches use local `Map` with strict size/TTL caps.
- Intentional trade-off markers: deliberate simplifications marked with `ponytail:` comments.
- Client data hooks own refresh/cache coordination; selectors and formatters keep derived display logic pure.

## COMMANDS
```bash
npm run dev      # next dev -H 127.0.0.1 -p 20130
npm test         # node --test test/*.test.js
npm run build    # next build --webpack
npm run start    # next start -H 127.0.0.1 -p 20130
npm run lint     # eslint .
```

## NOTES
- Dev and start bind to localhost port 20130 (`-H 127.0.0.1 -p 20130`).
- Upstream 9router runs on port 20120 by default (or configured via `UPSTREAM_BASE_URL`).
- Container deployments must be single-instance due to in-process memory session storage.
- Tests use `node:test` with `happy-dom` for DOM-facing behavior; no browser test framework.
