# App Router Knowledge Base

## OVERVIEW
Next.js App Router surface for dashboard UI, API endpoints, and global styles (high file and route count).

## STRUCTURE
- `api/` — Web `Request`/`Response` handlers; auth, health, quota, stats, and live-model endpoints.
- `components/` — Client-side dashboard surfaces, tables, dialogs, and controls.
- `styles/` — Global CSS split by surface and breakpoint; tokens in `tokens.css`.
- `layout.js` — Root metadata and global stylesheet imports.
- `page.js` — Dashboard orchestration and tab/state coordination.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Dashboard state and tabs | `page.js` | Coordinates data hooks, view state, dialogs, refresh |
| API endpoint behavior | `api/**/route.js` | Route-specific input, auth, and response mapping |
| UI surfaces | `components/` | Presentation; shared derivation belongs in `lib/client/` |
| Global CSS and tokens | `styles/` | Follow existing imports in `layout.js` |
| Live-model layout preview | `layout-preview/page.js` | Local visual preview surface |

## CONVENTIONS
- Interactive components use React client components; keep network and derived data logic in `lib/client/`.
- Route handlers use Web `Request`/`Response` APIs and shared server guards.
- CSS stays in `styles/`; use existing custom properties and responsive stylesheets.
- Preserve keyboard and accessible labeling behavior when changing controls or dialogs.

## ANTI-PATTERNS
- NEVER put CSS in components or introduce Tailwind/CSS Modules.
- NEVER duplicate quota derivation in components; use `lib/client/selectors.js`.
- NEVER bypass shared authentication and standardized route error handling in API handlers.
- NEVER render raw account identity or upstream credential fields.
