# DESIGN.md - Quota Dashboard Contract

Reading this as: Quota and traffic governor dashboard for local AI gateway operator, optimized for quota monitoring and account health decisions.

## 1. System Dials
- Density: 9/10
- Motion: 2/10
- Component Foundation: Native HTML/CSS and React client components
- Theme Strategy: Light default with full dark theme (`[data-theme='dark']`)
- Primary Workspace: Two-column split view (iPad landscape / desktop)
- Visual Reference: Local design preview files (internal reference only)

## 2. Design Tokens

### Canvas & Surfaces
- Canvas dotgrid (light): `#F8F9FA` with `radial-gradient(circle, rgba(15, 23, 42, 0.08) 1.2px, transparent 1.2px)` 24px x 24px
- Canvas dotgrid (dark): `#0C0C0E` with `radial-gradient(circle, rgba(255, 255, 255, 0.08) 1.2px, transparent 1.2px)` 24px x 24px
- Navbar surface: `#0C0C0E`, border `rgba(255, 255, 255, 0.12)`, radius 16px
- Card surface (light): `#FFFFFF`, border `rgba(0, 0, 0, 0.16)`, radius 16px, shadow `0 4px 12px rgba(0, 0, 0, 0.03)`
- Card surface (dark): `#141417`, border `rgba(255, 255, 255, 0.16)`, radius 16px, shadow `0 4px 12px rgba(0, 0, 0, 0.25)`
- Pool averages footer: Light `#F8F9FA`, Dark `rgba(255, 255, 255, 0.02)`, border-top `rgba(0, 0, 0, 0.08)` / `rgba(255, 255, 255, 0.08)`

### Colors & Semantics
- Accent Orange: `#FF7424` (hover `#E55A10`, tint `rgba(255, 116, 36, 0.12)`)
- Green (Healthy >20%): `#10B981` (tint `rgba(16, 185, 129, 0.12)`)
- Amber (Low <20%): `#F59E0B` (tint `rgba(245, 158, 11, 0.12)`)
- Red (Depleted 0%): `#EF4444` (tint `rgba(239, 68, 68, 0.12)`)
- Text Primary: Light `#0F172A`, Dark `#F8FAFC`
- Text Muted: Light `#64748B`, Dark `#94A3B8`
- Text Dim: Light `#94A3B8`, Dark `#64748B`

### Typography
- Monospace: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`
- System Sans: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif`
- Rule: Local fonts only. Zero external font network requests. Tabular numbers on all metrics.

## 3. Layout Geometry & Responsive Breakpoints

### >= 1000px (Desktop & iPad Landscape)
- Container: max-width 1240px, padding 8px 16px 10px 16px, height 100vh, overflow hidden.
- Grid: 2 columns. 1000px to 1024px uses `1.0356fr 1fr`, above 1024px uses `1.28fr 1fr`. Gap 10px.
- Left column: Antigravity Pool card.
- Right column: Codex Pool card.
- Account list: internal vertical scroll (`overflow-y: auto`). Outer page does not scroll.

### 768px to 999px (Tablet Portrait / Narrow Landscape)
- Container: max-width 100%, padding 8px 14px 12px 14px.
- Navbar: wraps into two intentional rows. Brand on row 1, search and actions on row 2.
- Live strip: wraps into two intentional rows.
- Grid: single provider column (`1fr`). Reflects actual current source for core quota cell readability.
- Account rows: maintain horizontal flex layout with minimum 48px row height.

### < 768px (Mobile)
- Grid: single provider column. Column legend hidden.
- Navbar: stacked column layout with grouped buttons.
- Live strip: chips scroll horizontally (`overflow-x: auto`), center text hidden.

### < 600px (Narrow Mobile)
- Account row: switches to vertical stack. Identity header full width on top.
- Quotas: 2 equal cells below (`grid-template-columns: repeat(2, 1fr)`), gap 8px.
- Touch targets: minimum 44px height for interactive controls.
- Font scaling: no shrinking below 10.5px. Use grid wrapping instead of font reduction.

## 4. Content Hierarchy & Core Flows

### Top Floating Navbar
- Brand title: `9Router Quotas` with subtitle `QUOTA & TRAFFIC MONITOR` and orange accent logo mark.
- View tabs: Quotas (active default) and Usage.
- Search box: filter alias or masked identity.
- Active Only toggle: active by default (`activeFilter = 'active'`).
- Refresh CTA: orange background, rotates on refresh.

### Live Models Strip
- Live beacon: orange pulsing dot with `Live Models` label.
- Model chips: active model name plus account badge and in-flight count.
- Telemetry: connection status (`Live Stream Monitor`), total active requests count, and updated timestamp (`Updated HH:MM:SS`). No gateway port.
- View all: modal trigger for overflow active models.

### Provider Cards
- Header: provider title, pill account counter, column legend labels.
- Antigravity Core Windows: shows 2 core columns by default (Flash / Pro and Weekly).
- More Quotas button: toggles extra windows (Sonnet/Opus, Claude/GPT Wk, GPT-OSS, Image).
- Codex Windows: 5-Hour and Weekly columns.

### Pool Averages Footer
- Pinned at bottom of each provider card beneath scrollable account list (`flex-shrink: 0`).
- Semantic label: `Average remaining`.
- Codex Windows: `5-Hour` and `Weekly` mean remaining percentage.
- Antigravity Windows: `Flash / Pro` and `Weekly` mean remaining percentage.
- Formatted with 1 decimal max (e.g. `82.5%`, `40%`); empty / null values display `—`.
- Header Height Alignment: Desktop provider card headers equalized to 52px across columns.

## 5. Account Presentation & Privacy Rules

### Stable Numbering
- Antigravity pool: `Account 01`, `Account 02`, sequential.
- Codex pool: `Codex 01`, `Codex 02`, sequential.
- Other providers: `<Provider> 01`, `<Provider> 02`.
- Rule: Sorted naturally by connection ID within provider. Numbers remain stable when filters or sorts change.

### Identity Masking
- Email rule: `first5***@domain` (e.g. `user1***@gmail.com`).
- Short string rule: strings under 5 chars get `***@domain`.
- Non-email rule: slice first 8 characters and append `***`.
- Privacy gate: Raw email, unmasked labels, and access tokens must never appear in DOM attributes, tooltips, or copy.

### Defaults
- Theme: Light mode default.
- Filters: Active Only enabled by default.

## 6. Accessibility & Motion Rules
- Interactive minimums: 44px touch targets on mobile, 40px on desktop.
- Focus visible: 2px solid `#FF7424` outline with 2px offset.
- Motion baseline: 2/10. Transitions limited to transform and opacity (150ms to 200ms).
- Reduced motion: disable pulse animation and transitions when `prefers-reduced-motion: reduce`.

## 7. Accepted Constraints & Account Growth Behavior
- Account Growth Behavior: Fixed 2-column layout on viewports >= 1000px with internal provider list scrolling (`overflow-y: auto`).
- Viewport Capacity Rule: Up to roughly 20-24 accounts total (~10-12 per column) may fit in a single static desktop/iPad viewport depending on column split and expanded quotas. Unbounded accounts cannot all be visible simultaneously. Do not shrink rows or reduce font sizes to force-fit accounts; cards must preserve standard row heights and use internal panel scrolling while outer page remains locked at 100vh.
- Font independence: Zero CDN dependencies. Rely on system monospace and sans-serif stacks.

## 8. Reference Fidelity Checklist (Forbidden Drift)
- NO solid white or gradient canvas. Must preserve 24px dotgrid.
- NO external font links. Never import Google Fonts or Adobe Typekit.
- NO raw account identities or tokens in DOM.
- NO multi-column provider grid on tablet (768px to 999px). Keep single column.
- NO 2-column layout below 1000px.
- NO expanding Antigravity extra quotas by default.
- NO font shrinking below 10.5px on small screens.
- NO proprietary brand assets or remote URLs in documentation.
