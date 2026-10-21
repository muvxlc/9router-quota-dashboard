# Test Suite Knowledge Base

## OVERVIEW
Automated test suite using native Node.js test runner covering server and client units (Score: 9, distinct domain).

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Test runner execution | `test/*.test.js` | Individual test files executed via `node --test` |
| Client formatting tests | `test/client-formatters.test.js` | Verifies token formatting and reset countdowns |
| Client selector tests | `test/client-selectors.test.js` | Tests account status, filters, and pool averages |
| Client API tests | `test/client-api.test.js` | Tests client HTTP wrapper and error handling |
| Alert trigger tests | `test/client-alerts.test.js` | Verifies quota breach notifications and incident keys |
| Server security tests | `test/server-quota-security.test.js` | Validates credential redaction and host checks |
| Server routes & auth | `test/server-routes.test.js` | Tests session cookie lifecycle and route guards |
| Quota normalization | `test/server-normalize.test.js` | Tests parsing of upstream quota schemas |
| Antigravity parser | `test/server-normalize-antigravity.test.js` | Tests Antigravity sliding window quotas |
| UI component mount | `test/ui-features-mount.jsx` | Test fixture rendering UI with happy-dom |

## CONVENTIONS
- Native runner only: tests run via standard `node:test` and `node:assert/strict`.
- No third-party test runners: do not import Jest, Vitest, or Mocha.
- Lightweight DOM: browser DOM tests use `happy-dom` directly in fixtures.
- Mock upstream: network calls mock `fetch` or instantiate mock upstream responses.

## ANTI-PATTERNS
- NEVER install Jest or Vitest; project strictly standardizes on native `node:test`.
- NEVER hit live upstream endpoints during test runs; mock responses in memory.
- NEVER hardcode absolute ports; test servers must bind to dynamic ephemeral ports (0).
- DO NOT leave unhandled promise rejections or lingering timers in test cleanup.
