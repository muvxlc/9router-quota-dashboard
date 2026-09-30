import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computePoolColumns,
  getGroupWeight,
  MIN_CARD_WIDTH_PX,
  COLUMN_GAP_PX,
} from '../lib/client/poolLayout.js';

function group(provider, accountCount) {
  return {
    provider,
    providerTitle: provider,
    accounts: Array.from({ length: accountCount }, (_, i) => ({ id: `${provider}-${i}` })),
    windows: [],
  };
}

function flatten(columns) {
  return columns.flatMap((c) => c.groups.map((g) => g.provider));
}

test('getGroupWeight counts accounts plus card chrome', () => {
  assert.equal(getGroupWeight(group('codex', 4)), 6);
  assert.equal(getGroupWeight(group('glm', 0)), 2);
  assert.equal(getGroupWeight(null), 2);
  assert.equal(getGroupWeight(undefined), 2);
});

test('empty input yields no columns', () => {
  const result = computePoolColumns([], 1240);
  assert.deepEqual(result.columns, []);
  assert.equal(result.columnCount, 0);
  assert.equal(result.template, '1fr');
});

test('current pools: antigravity gets its own column, codex and glm share one', () => {
  const result = computePoolColumns(
    [group('codex', 4), group('antigravity', 14), group('glm', 1)],
    1240
  );

  assert.equal(result.columnCount, 2);
  assert.deepEqual(flatten(result.columns).sort(), ['antigravity', 'codex', 'glm']);

  const antigravityCol = result.columns.find((c) =>
    c.groups.some((g) => g.provider === 'antigravity')
  );
  assert.equal(antigravityCol.groups.length, 1, 'dense pool must not share its column');

  const sharedCol = result.columns.find((c) => c !== antigravityCol);
  assert.deepEqual(
    sharedCol.groups.map((g) => g.provider),
    ['codex', 'glm'],
    'sparse pools stack together in original provider order'
  );

  assert.ok(
    result.columns[0].groups[0].provider === 'codex',
    'columns keep original provider order left to right'
  );
});

test('columns are equal width regardless of pool weight', () => {
  const result = computePoolColumns(
    [group('codex', 4), group('antigravity', 14), group('glm', 1)],
    1440
  );
  assert.equal(result.template, '1fr 1fr');

  const unbalanced = computePoolColumns(
    [group('codex', 2), group('antigravity', 30)],
    1440
  );
  assert.equal(unbalanced.template, '1fr 1fr');
});

test('single pool renders a single full-width column', () => {
  const result = computePoolColumns([group('codex', 6)], 1240);
  assert.equal(result.columnCount, 1);
  assert.equal(result.template, '1fr');
  assert.equal(result.columns[0].groups.length, 1);
});

test('a fourth pool on a wide screen rebalances into three columns', () => {
  const pools = [group('codex', 4), group('antigravity', 14), group('glm', 1), group('claude', 8)];
  const wideWidth = 3 * MIN_CARD_WIDTH_PX + 2 * COLUMN_GAP_PX + 40;
  const result = computePoolColumns(pools, wideWidth);

  assert.equal(result.columnCount, 3);
  assert.deepEqual(flatten(result.columns).sort(), ['antigravity', 'claude', 'codex', 'glm']);
  assert.equal(result.template, '1fr 1fr 1fr');

  const weights = result.columns.map((c) => c.weight);
  const spread = Math.max(...weights) - Math.min(...weights);
  assert.ok(
    spread <= 13,
    `LPT keeps column weights balanced, spread was ${spread} for weights ${weights.join(',')}`
  );
});

test('narrow width caps column count to what fits', () => {
  const pools = [group('codex', 4), group('antigravity', 14), group('glm', 1), group('claude', 8)];
  const twoColWidth = 2 * MIN_CARD_WIDTH_PX + COLUMN_GAP_PX + 40;
  const result = computePoolColumns(pools, twoColWidth);
  assert.equal(result.columnCount, 2);

  const oneColWidth = MIN_CARD_WIDTH_PX + COLUMN_GAP_PX - 20;
  const narrow = computePoolColumns(pools, oneColWidth);
  assert.equal(narrow.columnCount, 1);
});

test('LPT keeps the heaviest column within the classic bound', () => {
  const counts = [14, 8, 4, 1, 6, 11];
  const pools = counts.map((n, i) => group(`p${i}`, n));
  const width = 3 * MIN_CARD_WIDTH_PX + 2 * COLUMN_GAP_PX + 40;
  const result = computePoolColumns(pools, width);

  const weights = pools.map(getGroupWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  const maxWeight = Math.max(...weights);
  const m = result.columnCount;
  const heaviest = Math.max(...result.columns.map((c) => c.weight));

  assert.ok(
    heaviest <= total / m + (1 - 1 / m) * maxWeight + 0.001,
    `heaviest column ${heaviest} must stay within LPT bound for weights [${weights.join(', ')}]`
  );
});

test('many pools on a narrow screen stay width-capped at two columns', () => {
  const manyPools = Array.from({ length: 20 }, (_, i) => group(`p${i}`, 5));
  const result = computePoolColumns(manyPools, 1240);
  assert.equal(result.columnCount, 2);
  assert.equal(result.columns.reduce((n, c) => n + c.groups.length, 0), 20);
});

test('unmeasured width falls back to two columns', () => {
  const result = computePoolColumns([group('codex', 4), group('antigravity', 14), group('glm', 1)], 0);
  assert.equal(result.columnCount, 2);
});

test('layout is deterministic for repeated computation', () => {
  const pools = [group('codex', 4), group('antigravity', 14), group('glm', 1), group('claude', 8)];
  const a = computePoolColumns(pools, 1560);
  const b = computePoolColumns(pools, 1560);
  assert.deepEqual(a, b);
});
