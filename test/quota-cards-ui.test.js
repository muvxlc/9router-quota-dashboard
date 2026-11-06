import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { getAccountsQuotaAverages } from '../lib/client/selectors.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const cardsSrc = fs.readFileSync(path.join(projectRoot, 'app/components/QuotaCards.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(projectRoot, 'app/styles/cards.css'), 'utf8');

function summaryBlock(src) {
  const start = src.indexOf('className="quota-card quota-card-summary"');
  const end = src.indexOf('</section>', start);
  assert.ok(start > 0 && end > start, 'summary block must be the final quota card');
  return src.slice(start, end);
}

test('QuotaCards imports the cross-account average selector', () => {
  assert.match(cardsSrc, /import \{[^}]*getAccountsQuotaAverages[^}]*\} from '\.\.\/\.\.\/lib\/client\/selectors\.js'/s);
});

test('inactive accounts (active === false) are excluded before rendering cards', () => {
  assert.match(cardsSrc, /acc\?\.active !== false/);
  const filterIdx = cardsSrc.indexOf('acc?.active !== false');
  assert.ok(filterIdx > 0 && filterIdx < cardsSrc.indexOf('filteredAccounts.map('));
});

test('derived inactive status is excluded even when the raw active flag is missing', () => {
  assert.match(cardsSrc, /effectiveStatus\?\.status !== 'inactive'/);
});

test('the summary card renders after all account cards', () => {
  assert.ok(cardsSrc.indexOf('filteredAccounts.map(') < cardsSrc.indexOf('className="quota-card quota-card-summary"'));
  assert.equal((cardsSrc.match(/quota-card-summary"/g) || []).length, 1, 'exactly one summary card');
});

test('the summary card shows 2-line per-provider average summary with 5-HOUR / WEEKLY header and no progress bars', () => {
  const block = summaryBlock(cardsSrc);
  assert.match(block, /className="quota-card-summary-header"/);
  assert.match(block, /summary-header-col-5h.*5-HOUR/);
  assert.match(block, /summary-header-col-w.*WEEKLY/);
  assert.match(block, /className="quota-card-summary-lines"/);
  assert.match(block, /className="quota-card-summary-line tabular-nums"/);
  assert.match(block, /summary-line-prefix.*AVG/);
  assert.match(block, /summary-line-values/);
  assert.match(block, /summary-val-5h/);
  assert.match(block, /summary-val-w/);
  assert.match(block, /summary-line-provider/);
  assert.doesNotMatch(block, /pp-bar-track/, 'progress bar track must be removed');
  assert.doesNotMatch(block, /pp-bar-fill/, 'progress bar fill must be removed');
});

test('the summary card is not interactive', () => {
  const block = summaryBlock(cardsSrc);
  assert.doesNotMatch(block, /role="button"/);
  assert.doesNotMatch(block, /onClick/);
  assert.doesNotMatch(block, /tabIndex/);
});

test('an unavailable or unknown average renders an em dash, never NaN', () => {
  assert.match(cardsSrc, /function formatAverage/, 'formatAverage lives in the same file');
  assert.match(cardsSrc, /Number\.isFinite\(value\) \? `\$\{Math\.round\(value\)\}%` : '—'/);

  const probe = getAccountsQuotaAverages([
    { id: 'a', quota: { status: 'unavailable', windows: [] } },
    { id: 'b', quota: { windows: [{ key: 'session', remainingPercent: null }] } },
  ]);
  assert.equal(probe.overall.average, null);
  assert.ok(!JSON.stringify(probe).includes('NaN'));
  assert.ok(cardsSrc.includes(": '—'"), 'null average must render an em dash');
});

test('opencode accounts get their own provider summary line', () => {
  assert.match(cardsSrc, /opencodeAccounts/);
  assert.match(cardsSrc, /getProviderSummaryLine\('opencode', 'opencode', opencodeAccounts\)/);
  assert.doesNotMatch(cardsSrc, /p !== 'antigravity' && p !== 'codex';/);
});

test('cards.css styles the summary card without restyling .quota-card', () => {
  const latestCss = fs.readFileSync(path.join(projectRoot, 'app/styles/cards.css'), 'utf8');
  assert.match(latestCss, /\.quota-card\.quota-card-summary\s*\{[^}]*cursor:\s*default/s);
  assert.match(latestCss, /\.quota-card\.quota-card-summary\s*\{[^}]*background:\s*var\(--theme-dark\)/s);
  assert.match(latestCss, /\.quota-card-summary-header\s*\{/);
  assert.match(latestCss, /\.summary-header-col-5h\s*\{[^}]*color:\s*var\(--theme-orange\)/s);
  assert.match(latestCss, /\.summary-val-5h\s*\{[^}]*color:\s*var\(--theme-orange\)/s);
  assert.match(latestCss, /\.quota-card-summary-lines\s*\{/);
  assert.match(latestCss, /\.quota-card-summary-line\s*\{/);

  const mobileCss = fs.readFileSync(path.join(projectRoot, 'app/styles/responsive-mobile.css'), 'utf8');
  assert.match(mobileCss, /\.quota-card\.quota-card-summary\s*\{[^}]*grid-column:\s*1 \/ -1/s);
});
