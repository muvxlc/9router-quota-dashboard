export function formatPercent(percent, unlimited = false) {
  if (unlimited) return 'Unlimited';
  if (percent === null || percent === undefined || Number.isNaN(percent)) {
    return '—';
  }
  return `${Math.round(percent)}%`;
}

export function formatUnits(used, total, unit = '') {
  const cleanUnit = unit ? ` ${unit}` : '';
  if (used === null && total === null) {
    return '—';
  }
  if (used !== null && total !== null) {
    return `${formatNumber(used)} / ${formatNumber(total)}${cleanUnit}`;
  }
  if (used !== null) {
    return `${formatNumber(used)}${cleanUnit} used`;
  }
  return `${formatNumber(total)}${cleanUnit} limit`;
}

export function formatUsage(used, total, unit = '') {
  if (unit === '%') {
    if (used !== null && used !== undefined) {
      return `Used ${Math.round(used)}%`;
    }
    if (total !== null && total !== undefined) {
      return `Limit ${Math.round(total)}%`;
    }
    return '';
  }
  const formatted = formatUnits(used, total, unit);
  return formatted === '—' ? '' : formatted;
}

export function formatResetRelative(resetAt, nowMs = Date.now()) {
  if (!resetAt) return '—';
  const target = new Date(resetAt).getTime();
  if (Number.isNaN(target)) return '—';

  const diffMs = target - nowMs;
  if (diffMs <= 0) return 'due to reset';

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return remHours > 0 ? `in ${diffDays}d ${remHours}h` : `in ${diffDays}d`;
  }
  if (diffHours > 0) {
    const remMin = diffMin % 60;
    return remMin > 0 ? `in ${diffHours}h ${remMin}m` : `in ${diffHours}h`;
  }
  return `in ${Math.max(1, diffMin)}m`;
}

export function formatExactDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatNumber(num) {
  if (num === null || num === undefined || Number.isNaN(num)) return '—';
  return Number(num).toLocaleString('en-US');
}

export function formatTokens(num) {
  if (num === null || num === undefined || Number.isNaN(num)) return '—';
  const val = Math.abs(num);
  if (val >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`;
  }
  if (val >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`;
  }
  if (val >= 1e3) {
    return `${(num / 1e3).toFixed(1)}K`;
  }
  return num.toString();
}

export function formatCost(cost) {
  if (cost === null || cost === undefined || Number.isNaN(cost)) return '—';
  return `$${Number(cost).toFixed(2)}`;
}

export function getLiveStatusMeta(status, activeCount = 0) {
  switch (status) {
    case 'live':
      return {
        text: 'CONNECTED',
        pillClass: 'connected',
        dotColor: 'var(--theme-green)',
        pulse: Number(activeCount) > 0,
      };
    case 'idle':
      return {
        text: 'IDLE',
        pillClass: 'idle',
        dotColor: 'var(--theme-text-muted)',
        pulse: false,
      };
    case 'connecting':
      return {
        text: 'CONNECTING',
        pillClass: 'connecting',
        dotColor: 'var(--theme-amber)',
        pulse: false,
      };
    case 'disconnected':
      return {
        text: 'DISCONNECTED',
        pillClass: 'disconnected',
        dotColor: 'var(--theme-red)',
        pulse: false,
      };
    case 'error':
    default:
      return {
        text: 'UNAVAILABLE',
        pillClass: 'unavailable',
        dotColor: 'var(--theme-red)',
        pulse: false,
      };
  }
}
