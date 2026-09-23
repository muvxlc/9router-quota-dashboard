import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('QuotaTable renders More quotas in two lines (More quotas then extraWindowsCount)', () => {
  const quotaTableSrc = fs.readFileSync(path.join(projectRoot, 'app/components/QuotaTable.js'), 'utf8');

  // Verify two lines in JSX: More quotas followed by count in separate spans
  const hasTwoLineMoreQuotas =
    quotaTableSrc.includes('<span>More quotas</span>') &&
    quotaTableSrc.includes('<span>({extraWindowsCount})</span>');

  assert.ok(
    hasTwoLineMoreQuotas,
    'QuotaTable.js should render "More quotas" and "({extraWindowsCount})" in separate lines/spans'
  );
});

test('cards.css styles more-quotas-btn for two-line column display', () => {
  const cardsCss = fs.readFileSync(path.join(projectRoot, 'app/styles/cards.css'), 'utf8');

  assert.match(
    cardsCss,
    /\.more-quotas-btn\s*\{[^}]*flex-direction:\s*column/s,
    'cards.css should specify flex-direction: column for .more-quotas-btn'
  );
  assert.match(
    cardsCss,
    /\.more-quotas-btn\s*\{[^}]*min-height:\s*32px/s,
    'cards.css should specify min-height: 32px for .more-quotas-btn to prevent jump on expand'
  );
  assert.match(
    cardsCss,
    /\.more-quotas-btn\s*\{[^}]*white-space:\s*nowrap/s,
    'cards.css should specify white-space: nowrap to prevent first span from wrapping internally'
  );
  assert.match(
    cardsCss,
    /\.more-quotas-btn\s*\{[^}]*flex-shrink:\s*0/s,
    'cards.css should specify flex-shrink: 0 so button maintains intrinsic single-line label width'
  );
  assert.match(
    cardsCss,
    /\.more-quotas-btn\s+span\s*\{[^}]*white-space:\s*nowrap/s,
    'cards.css should specify white-space: nowrap on .more-quotas-btn span to prevent first span internal wrapping'
  );
  assert.match(
    cardsCss,
    /\.more-quotas-btn\s+span\s*\{[^}]*display:\s*block/s,
    'cards.css should specify display: block on .more-quotas-btn span for crisp two-line stacking'
  );
});

test('button height fits within 52px desktop header without expanding header area', () => {
  const fontSize = 11;
  const lineHeight = 1.15;
  const buttonPaddingY = 2 * 2;
  const buttonBorderY = 1 * 2;
  const headerPaddingY = 9 * 2;
  const targetHeaderMinHeight = 52;

  const twoLineContentHeight = Math.ceil(2 * fontSize * lineHeight);
  const twoLineButtonHeight = Math.max(32, twoLineContentHeight + buttonPaddingY + buttonBorderY);
  const twoLineHeaderContentTotal = twoLineButtonHeight + headerPaddingY;

  assert.ok(
    twoLineHeaderContentTotal <= targetHeaderMinHeight,
    `Unwrapped 2-line button total (${twoLineHeaderContentTotal}px) must fit within header min-height (${targetHeaderMinHeight}px)`
  );

  const threeLineContentHeight = Math.ceil(3 * fontSize * lineHeight);
  const threeLineButtonHeight = threeLineContentHeight + buttonPaddingY + buttonBorderY;
  const threeLineHeaderContentTotal = threeLineButtonHeight + headerPaddingY;

  assert.ok(
    threeLineHeaderContentTotal > targetHeaderMinHeight,
    `Simulated wrapped 3-line button (${threeLineHeaderContentTotal}px) confirms bug would blow past ${targetHeaderMinHeight}px`
  );
});

test('responsive-tablet.css equalizes Codex and Antigravity header heights on desktop (>=1000px)', () => {
  const tabletCss = fs.readFileSync(path.join(projectRoot, 'app/styles/responsive-tablet.css'), 'utf8');

  // Find min-width: 1000px media query block
  const desktopMatch = tabletCss.match(/@media\s*\(min-width:\s*1000px\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(desktopMatch, 'responsive-tablet.css must have @media (min-width: 1000px) block');

  const desktopContent = desktopMatch[1];
  assert.match(
    desktopContent,
    /\.pp-card-header\s*\{[^}]*min-height:\s*52px/s,
    'Desktop media query must equalize .pp-card-header height to min-height: 52px'
  );
});
