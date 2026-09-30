// Bin-packing for provider pool cards: heaviest pool goes to the lightest
// column (LPT), column count follows available width and total content,
// column widths follow the same weights. Pure data in, layout out.

export const MIN_CARD_WIDTH_PX = 500; // real min-content of a card: footer averages + fixed 136px quota cells
export const COLUMN_GAP_PX = 10;
export const ROWS_PER_COLUMN = 16; // account rows that fit one screen column
const CARD_CHROME_ROWS = 2; // header + footer ~= two 48px rows
const MAX_COLUMN_RATIO = 1.75; // densest column at most 1.75x the sparsest

export function getGroupWeight(group) {
  return (group?.accounts?.length ?? 0) + CARD_CHROME_ROWS;
}

function columnCapacity(widthPx) {
  if (!widthPx || widthPx <= 0) return 2; // pre-measure fallback: 2 columns
  return Math.max(
    1,
    Math.floor((widthPx + COLUMN_GAP_PX) / (MIN_CARD_WIDTH_PX + COLUMN_GAP_PX))
  );
}

function formatFr(ratio) {
  const rounded = Number(ratio.toFixed(3));
  return `${rounded}fr`;
}

export function computePoolColumns(groups, containerWidthPx) {
  const list = Array.isArray(groups) ? groups.filter(Boolean) : [];
  if (list.length === 0) {
    return { columns: [], columnCount: 0, template: '1fr' };
  }

  const weighted = list.map((group, index) => ({
    group,
    index,
    weight: getGroupWeight(group),
  }));
  const totalWeight = weighted.reduce((sum, g) => sum + g.weight, 0);

  const byWidth = columnCapacity(containerWidthPx);
  const byContent = Math.ceil(totalWeight / ROWS_PER_COLUMN);
  const columnCount = Math.min(list.length, byWidth, Math.max(byContent, 2));

  const columns = Array.from({ length: columnCount }, () => ({
    groups: [],
    weight: 0,
  }));
  for (const item of [...weighted].sort(
    (a, b) => b.weight - a.weight || a.index - b.index
  )) {
    let target = columns[0];
    for (const col of columns) {
      if (col.weight < target.weight) target = col;
    }
    target.groups.push(item);
    target.weight += item.weight;
  }

  // sort by first-assigned group's original index: stable left-to-right order
  columns.sort((a, b) => a.groups[0].index - b.groups[0].index);

  const minWeight = Math.min(...columns.map((c) => c.weight));
  let ratios = columns.map((c) => Math.min(c.weight / minWeight, MAX_COLUMN_RATIO));

  const shareable = containerWidthPx - (columnCount - 1) * COLUMN_GAP_PX;
  if (containerWidthPx > 0 && shareable / ratios.reduce((a, b) => a + b, 0) < MIN_CARD_WIDTH_PX) {
    ratios = columns.map(() => 1);
  }
  const template = ratios.map(formatFr).join(' ');

  return {
    columns: columns.map((c, i) => ({
      key: `col-${i}`,
      groups: c.groups.map((g) => g.group),
      weight: c.weight,
    })),
    columnCount,
    template,
  };
}
