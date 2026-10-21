# Client Domain Knowledge Base

## OVERVIEW
Client-side state management, custom React hooks, data selectors, and API communication (Score: 9, distinct domain).

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| API client & auth fetch | `lib/client/api.js` | HTTP client wrapper with auth handling |
| Quota state hook | `lib/client/useQuotaData.js` | Manages connection list, quota cache, refresh state |
| Stats hook | `lib/client/useStatsData.js` | Manages aggregated usage statistics and date ranges |
| Auto-refresh hook | `lib/client/useAutoRefresh.js` | Configurable interval timer for dashboard polling |
| Theme toggle hook | `lib/client/useTheme.js` | Light/dark theme toggle backed by localStorage |
| Central clock hook | `lib/client/useCentralClock.js` | Synchronized tick for countdowns across rows |
| Data selectors & aggregations | `lib/client/selectors.js` | Pure status derivation, pool averages, sorting |
| Summary derivation | `lib/client/maxplusSummary.js` | Merges summary data, derives stale/failure state and cards |
| Display formatters | `lib/client/formatters.js` | Token counts, timestamps, relative countdowns |
| Account identity masking | `lib/client/accountPresentation.js` | Email and identifier masking for display |
| Live models SSE client | `lib/client/liveModels.js` | Client listener for Server-Sent Events stream |
| Incident alerts | `lib/client/alerts.js` | Quota threshold breach notifications |
| Snapshot export | `lib/client/exportSnapshot.js` | CSV and JSON export generators |
| Pool card layout | `lib/client/poolLayout.js` | Computes column and grid layout for account pools |

## CONVENTIONS
- Pure selector functions: computation logic in `selectors.js` must remain side-effect free.
- `selectors.js` is the shared export hub for selectors, formatting, and account presentation.
- MaxPlus client summary code merges and presents server-sanitized summary data; server sanitization stays in `lib/server/`.
- Single clock source: use `useCentralClock` instead of per-row `setInterval` to avoid drift.
- Graceful degradation: formatters fall back to safe strings on invalid or missing dates.
- Local storage keys: theme and cadence preferences persist across sessions in browser storage.

## ANTI-PATTERNS
- NEVER introduce external state management libraries (Redux, Zustand); use custom hooks.
- NEVER fetch data directly inside UI components; encapsulate in `lib/client/api.js`.
- NEVER bypass email masking in `accountPresentation.js` when rendering account IDs.
- DO NOT duplicate quota calculation logic; centralize in `lib/client/selectors.js`.
