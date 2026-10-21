// ponytail: only documented field names are read (no alias hunting); a future
// upstream rename needs a deliberate edit here.
// ponytail: grammar covers the documented periods (1d, 7d, 30d, all) plus
// h/w/m/y variants; a future upstream period format needs one deliberate edit
// to this regex.
const PERIOD_PATTERN = /^(all|\d{1,4}[dhwmy])$/;

function toNum(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function sanitizeMaxplusSummary({ usage, me, now } = {}) {
  const period =
    typeof usage?.period === 'string' && PERIOD_PATTERN.test(usage.period) ? usage.period : null;

  return {
    period,
    totalCost: toNum(usage?.totals?.total_cost),
    creditUsd: toNum(me?.credit_usd),
    usageReceivedAt: usage ? now : null,
    creditReceivedAt: me ? now : null,
  };
}
