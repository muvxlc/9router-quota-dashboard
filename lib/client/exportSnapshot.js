'use client';

const FORMULA_PREFIX_CHARS = new Set(['=', '+', '-', '@', '\t', '\r', '|']);

export function sanitizeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);

  const isFormula = str.length > 0 && FORMULA_PREFIX_CHARS.has(str[0]);
  if (isFormula) {
    str = `'${str}`;
  }

  if (isFormula || /[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function buildCsvSnapshot(accounts = []) {
  const headers = [
    'Connection ID',
    'Alias',
    'Provider',
    'Status',
    'Active',
    'Remaining %',
    'Reset At',
  ];

  const headerLine = headers.map(sanitizeCsvCell).join(',');
  const rows = accounts.map((acc) => {
    const connId = acc.id || '';
    const alias = acc.displayAlias || acc.label || acc.id || '';
    const provider = acc.provider || '';
    const status = acc.effectiveStatus?.label || acc.effectiveStatus?.status || 'Unknown';
    const active = acc.active ? 'true' : 'false';
    const remainingPct = typeof acc.effectiveRemainingPct === 'number'
      ? `${acc.effectiveRemainingPct}%`
      : '—';
    const resetAt = acc.quota?.windows?.[0]?.resetAt || '';

    return [
      sanitizeCsvCell(connId),
      sanitizeCsvCell(alias),
      sanitizeCsvCell(provider),
      sanitizeCsvCell(status),
      sanitizeCsvCell(active),
      sanitizeCsvCell(remainingPct),
      sanitizeCsvCell(resetAt),
    ].join(',');
  });

  return [headerLine, ...rows].join('\r\n');
}

export function buildJsonSnapshot(accounts = []) {
  const snapshot = accounts.map((acc) => ({
    id: acc.id,
    alias: acc.displayAlias || acc.label || acc.id,
    provider: acc.provider,
    active: Boolean(acc.active),
    status: acc.effectiveStatus?.status || 'unknown',
    statusLabel: acc.effectiveStatus?.label || 'Unknown',
    remainingPercent: acc.effectiveRemainingPct ?? null,
    reason: acc.effectiveStatus?.reason || acc.quota?.reason || null,
    resetAt: acc.quota?.windows?.[0]?.resetAt || null,
    updatedAt: acc.quota?.receivedAt || null,
  }));

  return JSON.stringify(snapshot, null, 2);
}

export function downloadBlob(content, filename, mimeType) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

export function exportCsv(accounts = [], filename = `quota-snapshot-${new Date().toISOString().slice(0, 10)}.csv`) {
  const csvText = buildCsvSnapshot(accounts);
  downloadBlob(csvText, filename, 'text/csv;charset=utf-8;');
}

export function exportJson(accounts = [], filename = `quota-snapshot-${new Date().toISOString().slice(0, 10)}.json`) {
  const jsonText = buildJsonSnapshot(accounts);
  downloadBlob(jsonText, filename, 'application/json;charset=utf-8;');
}
