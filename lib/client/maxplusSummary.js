import { formatCost } from './formatters.js';

export const EMPTY_SUMMARY = {
  period: null,
  totalCost: null,
  creditUsd: null,
  usageReceivedAt: null,
  creditReceivedAt: null,
};

const DASH = '—';
const NOT_CONFIGURED_HINT = 'Not configured';
const FAILED_HINT = 'Last known - refresh failed';
const STALE_HINT = 'Stale';
const STALE_AFTER_MS = 150000;

const CARD_META = [
  { key: 'period', label: 'Usage Period', hint: 'Billing window', timestampKey: 'usageReceivedAt' },
  { key: 'totalCost', label: 'Total Cost', hint: 'Cost in window', timestampKey: 'usageReceivedAt' },
  { key: 'creditUsd', label: 'Credit', hint: 'Remaining balance', timestampKey: 'creditReceivedAt' },
];

// ponytail: merge per endpoint group, not per field - a null timestamp means that
// whole group failed, so its previous values survive verbatim.
export function mergeSummary(prev, next) {
  const base = prev || EMPTY_SUMMARY;
  const incoming = next || {};
  const usageFresh = incoming.usageReceivedAt != null;
  const creditFresh = incoming.creditReceivedAt != null;
  return {
    period: usageFresh ? (incoming.period ?? null) : (base.period ?? null),
    totalCost: usageFresh ? (incoming.totalCost ?? null) : (base.totalCost ?? null),
    usageReceivedAt: usageFresh ? incoming.usageReceivedAt : (base.usageReceivedAt ?? null),
    creditUsd: creditFresh ? (incoming.creditUsd ?? null) : (base.creditUsd ?? null),
    creditReceivedAt: creditFresh ? incoming.creditReceivedAt : (base.creditReceivedAt ?? null),
  };
}

export function deriveSummaryFailures(incoming) {
  const body = incoming || {};
  const usageFailed = body.usageReceivedAt == null;
  const creditFailed = body.creditReceivedAt == null;
  return { usageFailed, creditFailed, partial: usageFailed !== creditFailed };
}

function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

function isStaleAt(timestamp, nowMs, maxAgeMs) {
  if (timestamp == null) return false;
  const ms = toMs(timestamp);
  if (ms === null) return false;
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) return false;
  return nowMs - ms > maxAgeMs;
}

export function isSummaryStale(summary, nowMs, maxAgeMs = STALE_AFTER_MS) {
  if (!summary) return false;
  return ['usageReceivedAt', 'creditReceivedAt'].some((key) => isStaleAt(summary[key], nowMs, maxAgeMs));
}

function formatValue(key, summary) {
  if (key === 'period') {
    return summary.period == null || summary.period === '' ? DASH : String(summary.period);
  }
  const raw = key === 'totalCost' ? summary.totalCost : summary.creditUsd;
  return raw == null ? DASH : formatCost(raw);
}

export function deriveSummaryCards(summary, { nowMs, unconfigured = false, failing = false, failedKeys = [] } = {}) {
  const current = summary || EMPTY_SUMMARY;
  const failed = new Set(failing ? CARD_META.map((c) => c.key) : failedKeys);
  return CARD_META.map(({ key, label, hint, timestampKey }) => {
    const value = formatValue(key, current);
    if (unconfigured || value === DASH) {
      return { key, label, value: DASH, hint: NOT_CONFIGURED_HINT, tone: 'neutral' };
    }
    const credit = key === 'creditUsd' ? Number(current.creditUsd) : null;
    const critical = credit !== null && credit <= 0;
    const isFailed = failed.has(key);
    const stale = isStaleAt(current[timestampKey], nowMs, STALE_AFTER_MS);
    if (critical) {
      return { key, label, value, hint: isFailed ? FAILED_HINT : stale ? STALE_HINT : hint, tone: 'critical' };
    }
    if (stale) return { key, label, value, hint: STALE_HINT, tone: 'warn' };
    if (isFailed) return { key, label, value, hint: FAILED_HINT, tone: 'warn' };
    if (credit !== null && credit <= 5) return { key, label, value, hint, tone: 'warn' };
    return { key, label, value, hint, tone: key === 'creditUsd' ? 'ok' : 'neutral' };
  });
}
