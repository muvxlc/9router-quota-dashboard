import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('QuotaTable.js imports getProviderQuotaAverages from selectors', () => {
  const quotaTableSrc = fs.readFileSync(path.join(projectRoot, 'app/components/QuotaTable.js'), 'utf8');

  assert.match(
    quotaTableSrc,
    /import\s*\{[^}]*getProviderQuotaAverages[^}]*\}\s*from\s*['"]\.\.\/\.\.\/lib\/client\/selectors(\.js)?['"]/,
    'QuotaTable.js must import getProviderQuotaAverages from selectors.js'
  );
});

test('QuotaTable.js removes entire QUOTA PROTOCOL SPECIFICATION / TELEMETRY block', () => {
  const quotaTableSrc = fs.readFileSync(path.join(projectRoot, 'app/components/QuotaTable.js'), 'utf8');

  assert.ok(
    !quotaTableSrc.includes('QUOTA PROTOCOL SPECIFICATION'),
    'QUOTA PROTOCOL SPECIFICATION must be completely removed from QuotaTable.js'
  );
  assert.ok(
    !quotaTableSrc.includes('TELEMETRY'),
    'TELEMETRY tag must be removed from QuotaTable.js'
  );
  assert.ok(
    !quotaTableSrc.includes('pp-spec-card'),
    'pp-spec-card container must be removed from QuotaTable.js'
  );
  assert.ok(
    quotaTableSrc.includes('right-col-stack'),
    'right-col-stack wrapper must be retained for right column layout'
  );
});

test('QuotaTable.js renders pool average UI with required labels and formatting', () => {
  const quotaTableSrc = fs.readFileSync(path.join(projectRoot, 'app/components/QuotaTable.js'), 'utf8');

  assert.ok(
    quotaTableSrc.includes('Average remaining'),
    'QuotaTable.js must render semantic label "Average remaining"'
  );

  assert.ok(
    quotaTableSrc.includes('—') || quotaTableSrc.includes('\\u2014'),
    'QuotaTable.js must handle null / empty average by displaying em-dash —'
  );

  // Checks for provider target keys/labels: 5-Hour / Weekly and Flash / Pro / Weekly
  const hasCodexLabels = quotaTableSrc.includes('5-Hour') && quotaTableSrc.includes('Weekly');
  const hasAntigravityLabels = quotaTableSrc.includes('Flash / Pro');

  assert.ok(hasCodexLabels, 'QuotaTable.js should reference 5-Hour and Weekly for Codex');
  assert.ok(hasAntigravityLabels, 'QuotaTable.js should reference Flash / Pro for Antigravity');
});

test('cards.css and responsive styles remove spec card and style pool-average footer', () => {
  const cardsCss = fs.readFileSync(path.join(projectRoot, 'app/styles/cards.css'), 'utf8');
  const tabletCss = fs.readFileSync(path.join(projectRoot, 'app/styles/responsive-tablet.css'), 'utf8');

  assert.ok(
    !cardsCss.includes('.pp-spec-card'),
    'cards.css must remove .pp-spec-card rules'
  );

  // Footer must stay pinned / visible below scrollable account list
  assert.match(
    cardsCss,
    /\.(pp-card-footer|pp-pool-averages)[^{]*\{[^}]*flex-shrink:\s*0/s,
    'cards.css must define footer with flex-shrink: 0 to stay visible below scrollable list'
  );

  // Equalize desktop header 52 vs 55px
  assert.match(
    tabletCss,
    /\.pp-card-header\s*\{[^}]*height:\s*52px/s,
    'responsive-tablet.css desktop media query must equalize .pp-card-header to height: 52px'
  );
  assert.match(
    tabletCss,
    /\.pp-card-header\s*\{[^}]*min-height:\s*52px/s,
    'responsive-tablet.css desktop media query must retain min-height: 52px'
  );
});

test('QuotaTable.js renders separate progress bars below pool average percentage values', () => {
  const quotaTableSrc = fs.readFileSync(path.join(projectRoot, 'app/components/QuotaTable.js'), 'utf8');
  const cardsCss = fs.readFileSync(path.join(projectRoot, 'app/styles/cards.css'), 'utf8');

  assert.ok(
    quotaTableSrc.includes('pp-pool-averages'),
    'QuotaTable.js must contain pp-pool-averages'
  );
  assert.match(
    quotaTableSrc,
    /pp-pool-avg-cell[\s\S]*?pp-bar-track[\s\S]*?pp-bar-fill/,
    'QuotaTable.js must render pp-bar-track and pp-bar-fill inside each pool average cell'
  );

  assert.match(
    cardsCss,
    /\.pp-pool-avg-cell\s*\{[^}]*flex-direction:\s*column/s,
    'cards.css must set flex-direction: column on .pp-pool-avg-cell'
  );
});
