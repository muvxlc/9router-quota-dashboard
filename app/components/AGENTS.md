# UI Component Knowledge Base

## OVERVIEW
Reusable client-side dashboard components for quota, usage, live models, and interaction surfaces (distinct UI domain).

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Quota cards and rows | `QuotaCards.js`, `QuotaTable.js`, `QuotaWindowCell.js` | Quota presentation and status details |
| Live models | `LiveModelsView.js`, `LiveModelsStrip.js`, `LiveModelsModal.js` | Live-model cards, strip, and modal |
| Header and controls | `Header.js`, `Toolbar.js`, `FiltersPopover.js` | Navigation, filters, and actions |
| Account details | `DetailSheet.js`, `StatusPill.js` | Detail panel and status display |
| Usage and login | `UsageView.js`, `LoginModal.js` | Usage summaries and auth UI |

## CONVENTIONS
- Keep components focused on display and interaction; share calculations in `lib/client/selectors.js`.
- Keep data fetching in client hooks/API helpers, not component-local effects.
- Preserve semantic controls, accessible names, and keyboard operation.

## ANTI-PATTERNS
- NEVER put CSS in component files; use global styles under `app/styles/`.
- NEVER duplicate quota/status rules or render unmasked account identities.
- NEVER add a UI dependency for patterns already covered by React and project styles.
