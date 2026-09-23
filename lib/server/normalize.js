import { sanitizeLabel } from './security.js';
import { LIMITS } from './config.js';
import { normalizeAntigravityWindows } from './normalizeAntigravity.js';

export { normalizeAntigravityWindows };

const AUTH_EXPIRED_PATTERNS = ['unauthorized', '401', 'expired', 'authentication', 're-authorize'];

function toIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function toNum(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeConnection(raw = {}) {
  return {
    id: String(raw.id || ''),
    provider: String(raw.provider || ''),
    label: sanitizeLabel(raw),
    active: raw.isActive !== false,
  };
}

function normalizeCodexWindows(quotas = {}) {
  const CODEX_LABELS = {
    session: '5h',
    weekly: 'Weekly',
    review_session: 'Review (5h)',
    review_weekly: 'Review (Weekly)',
    spark_session: 'Spark (5h)',
    spark_weekly: 'Spark (Weekly)',
  };

  const windows = [];
  for (const [key, q] of Object.entries(quotas)) {
    if (!q || typeof q !== 'object') continue;
    const label = CODEX_LABELS[key] || key;
    const used = toNum(q.used, 0);
    const total = toNum(q.total, 100);
    const remaining = q.remaining !== undefined ? toNum(q.remaining, 0) : Math.max(0, total - used);
    windows.push({
      key,
      label,
      remainingPercent: remaining,
      used,
      total,
      unit: '%',
      resetAt: toIso(q.resetAt),
      unlimited: false,
      recurring: true,
    });
  }
  return windows;
}

function isAntigravityQuotas(quotas) {
  if (!quotas || typeof quotas !== 'object') return false;
  const entries = Array.isArray(quotas)
    ? quotas.map((q) => `${q?.modelId || ''} ${q?.displayName || ''} ${q?.name || ''}`)
    : Object.entries(quotas).map(([k, q]) => `${k} ${q?.displayName || ''} ${q?.name || ''}`);
  const text = entries.join(' ').toLowerCase();
  return (
    text.includes('antigravity') ||
    text.includes('gemini') ||
    text.includes('gemini_weekly') ||
    text.includes('claude_gpt_weekly') ||
    text.includes('gpt-oss') ||
    text.includes('gpt_oss')
  );
}

function isCodexQuotas(quotas) {
  if (!quotas || typeof quotas !== 'object') return false;
  const keys = Array.isArray(quotas)
    ? quotas.map((q) => q?.modelId || q?.name || '')
    : Object.keys(quotas);
  const text = keys.join(' ').toLowerCase();
  return text.includes('session') || text.includes('spark_session') || text.includes('review_session');
}

function normalizeGenericWindows(quotas = {}) {
  const windows = [];
  for (const [key, q] of Object.entries(quotas)) {
    if (!q || typeof q !== 'object') continue;
    let rem = null;
    if (q.remainingPercentage !== undefined) rem = toNum(q.remainingPercentage, null);
    else if (q.total > 0 && q.used !== undefined) rem = Math.max(0, Math.round(((q.total - q.used) / q.total) * 100));
    windows.push({
      key,
      label: q.name || q.displayName || key,
      remainingPercent: rem,
      used: toNum(q.used, null),
      total: toNum(q.total, null),
      unit: q.unit || null,
      resetAt: toIso(q.resetAt),
      unlimited: q.unlimited === true,
      recurring: q.recurring !== false,
    });
  }
  return windows;
}

export function normalizeQuotaData(connectionId, provider, raw) {
  let p = (provider || '').toLowerCase();
  if (!p || p === 'unknown') {
    if (isAntigravityQuotas(raw?.quotas)) {
      p = 'antigravity';
    } else if (isCodexQuotas(raw?.quotas)) {
      p = 'codex';
    }
  }

  const cadenceMs = p === 'claude' ? LIMITS.CLAUDE_QUOTA_CADENCE_MS : LIMITS.DEFAULT_QUOTA_CADENCE_MS;
  const now = Date.now();
  const receivedAt = new Date(now).toISOString();
  const nextRefreshAt = new Date(now + cadenceMs).toISOString();

  if (!raw || typeof raw !== 'object') {
    return {
      connectionId,
      provider: p || provider,
      plan: null,
      status: 'unavailable',
      reason: 'NO_QUOTA_DATA',
      windows: [],
      receivedAt,
      nextRefreshAt,
    };
  }

  const rawMsg = (raw.message || raw.error || '').toLowerCase();
  if (rawMsg && AUTH_EXPIRED_PATTERNS.some((pattern) => rawMsg.includes(pattern))) {
    return {
      connectionId,
      provider: p || provider,
      plan: raw.plan || null,
      status: 'unavailable',
      reason: 'PROVIDER_AUTH_REQUIRED',
      windows: [],
      receivedAt,
      nextRefreshAt,
    };
  }

  if (!raw.quotas || typeof raw.quotas !== 'object') {
    const hasErrMsg = Boolean(raw.message || raw.error);
    return {
      connectionId,
      provider: p || provider,
      plan: raw.plan || null,
      status: 'unavailable',
      reason: hasErrMsg ? 'PROVIDER_UNAVAILABLE' : 'NO_QUOTA_DATA',
      windows: [],
      receivedAt,
      nextRefreshAt,
    };
  }

  let windows = [];
  try {
    if (p === 'codex') {
      windows = normalizeCodexWindows(raw.quotas);
    } else if (p === 'antigravity') {
      windows = normalizeAntigravityWindows(raw.quotas);
    } else {
      windows = normalizeGenericWindows(raw.quotas);
    }
  } catch {
    return {
      connectionId,
      provider: p || provider,
      plan: raw.plan || null,
      status: 'partial',
      reason: 'INVALID_QUOTA_DATA',
      windows: [],
      receivedAt,
      nextRefreshAt,
    };
  }

  return {
    connectionId,
    provider: p || provider,
    plan: raw.plan || null,
    status: windows.length > 0 ? 'ok' : 'unavailable',
    reason: windows.length > 0 ? null : 'NO_QUOTA_DATA',
    windows,
    receivedAt,
    nextRefreshAt,
  };
}

export function normalizeStats(period, rawStats = {}, rawChart = []) {
  const inTokens = toNum(rawStats.totalPromptTokens, 0);
  const outTokens = toNum(rawStats.totalCompletionTokens, 0);
  const cachedTokens = toNum(rawStats.totalCachedTokens, 0);
  const totalTokens = inTokens + outTokens;
  const requests = toNum(rawStats.totalRequests, 0);
  const estimatedCost = toNum(rawStats.totalCost, 0);

  const accountMap = new Map();
  for (const acc of Object.values(rawStats.byAccount || {})) {
    if (!acc || typeof acc !== 'object') continue;
    const connId = acc.connectionId || 'unknown';
    const existing = accountMap.get(connId) || {
      connectionId: connId,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    };
    const reqs = toNum(acc.requests, 0);
    const pTokens = toNum(acc.promptTokens, 0);
    const cTokens = toNum(acc.completionTokens, 0);
    const cdTokens = toNum(acc.cachedTokens, 0);
    const cost = toNum(acc.cost, 0);

    existing.requests += reqs;
    existing.inputTokens += pTokens;
    existing.outputTokens += cTokens;
    existing.cachedTokens += cdTokens;
    existing.totalTokens += pTokens + cTokens;
    existing.estimatedCost += cost;
    accountMap.set(connId, existing);
  }

  const chart = Array.isArray(rawChart)
    ? rawChart.map((point) => ({
        label: String(point.label || ''),
        tokens: toNum(point.tokens, 0),
        estimatedCost: toNum(point.cost ?? point.estimatedCost, 0),
      }))
    : [];

  return {
    period,
    scope: 'all-router-traffic',
    totals: {
      requests,
      inputTokens: inTokens,
      outputTokens: outTokens,
      cachedTokens,
      totalTokens,
      estimatedCost,
    },
    accounts: Array.from(accountMap.values()),
    chart,
    chartStatus: chart.length > 0 ? 'ok' : 'unavailable',
    receivedAt: new Date().toISOString(),
  };
}
