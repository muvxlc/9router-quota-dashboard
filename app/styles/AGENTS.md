# Global Styles Knowledge Base

## OVERVIEW
Global CSS for tokens, dashboard surfaces, tables, modals, and responsive breakpoints (separate visual system).

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Design tokens | `tokens.css` | Shared colors, spacing, and visual variables |
| Quota cards and grid | `cards.css`, `grid.css` | Card and pool layout styling |
| Tables | `table.css` | Quota table presentation |
| Navigation and live strip | `navbar.css`, `live-strip.css` | Header and live-model strip |
| Dialogs and preview | `modals.css`, `preview.css` | Modal and preview surfaces |
| Responsive rules | `responsive-mobile.css`, `responsive-tablet.css` | Breakpoint-specific overrides |

## CONVENTIONS
- Styles are global CSS imported by `app/layout.js`; tokens live in `tokens.css`.
- Reuse existing custom properties and component class naming patterns.
- Keep responsive overrides in responsive stylesheets, not JavaScript viewport logic.

## ANTI-PATTERNS
- NEVER introduce CSS Modules, Tailwind, or inline component style blocks.
- NEVER hardcode values where an existing design token applies.
- NEVER create conflicting duplicate selectors across responsive and base files.
