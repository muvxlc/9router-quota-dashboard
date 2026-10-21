import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { getAccountsQuotaAverages } from '../lib/client/selectors.js';

const projectRoot = path.resolve(import.meta.dirname, '..');
const cardsSrc = fs.readFileSync(path.join(projectRoot, 'app/components/QuotaCards.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(projectRoot, 'app/styles/cards.css'), 'utf8');

function summaryBlock(src) {
  const start = src.indexOf('quota-card-summary');
  const end = src.indexOf('accounts.map(');
  assert.ok(start > 0 && end > start, 'summary block must precede the account cards');
  return src.slice(start, end);
}

test('QuotaCards imports the cross-account average selector', () => {
  assert.match(cardsSrc, /import \{[^}]*getAccountsQuotaAverages[^}]*\} from '\.\.\/\.\.\/lib\/client\/selectors\.js'/s);
});

test('the summary card renders first, before the account cards', () => {
  assert.ok(cardsSrc.indexOf('quota-card-summary') < cardsSrc.indexOf('accounts.map('));
  assert.equal((cardsSrc.match(/quota-card-summary"/g) || []).length, 1, 'exactly one summary card');
});

test('the summary card shows the overall average and one cell per quota window', () => {
  const block = summaryBlock(cardsSrc);
  assert.match(block, /Average Remaining/);
  assert.match(block, /Overall \{formatAverage\(averages\.overall\.average\)\}/);
  assert.match(block, /data-window=\{avg\.key\}/);
  assert.match(block, /title=\{\`\$\{windowLabel\(avg\)\}: \$\{formatAverage\(avg\.average\)\} \(\$\{avg\.count\}\/\$\{avg\.total\} accounts\)\`\}/, 'cell title carries count/total');
  assert.match(block, /pp-pool-avg-cell/);
  assert.match(block, /pp-bar-fill/);
  assert.match(block, /width: `\$\{fillWidth\}%`/);
  assert.match(block, /Math\.min\(Math\.max\(avg\.average, 0\), 100\)/, 'bar width must be clamped');
});

test('the summary card is not interactive', () => {
  const block = summaryBlock(cardsSrc);
  assert.doesNotMatch(block, /role="button"/);
  assert.doesNotMatch(block, /onClick/);
  assert.doesNotMatch(block, /tabIndex/);
});

test('an unavailable or unknown average renders an em dash, never NaN', () => {
  const block = summaryBlock(cardsSrc);
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

test('cards.css styles the summary card without restyling .quota-card', () => {
  assert.match(cssSrc, /\.quota-card\.quota-card-summary\s*\{[^}]*cursor:\s*default/s);
  assert.match(cssSrc, /\.quota-card\.quota-card-summary\s*\{[^}]*border-style:\s*dashed/s);
  assert.match(cssSrc, /\.quota-card-summary-overall\s*\{/);

  const mobileCss = fs.readFileSync(path.join(projectRoot, 'app/styles/responsive-mobile.css'), 'utf8');
  assert.match(mobileCss, /@media \(max-width: 767px\)[\s\S]*\.quota-card\.quota-card-summary\s*\{[^}]*grid-column:\s*1 \/ -1/s);
});
