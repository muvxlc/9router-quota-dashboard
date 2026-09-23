/**
 * Presentation helper for account numbering and email masking.
 * Ensures deterministic provider-scoped numbering independent of filters/sorts.
 */

export function maskEmail(emailOrIdentity) {
  if (!emailOrIdentity || typeof emailOrIdentity !== 'string') return '';
  const trimmed = emailOrIdentity.trim();
  if (!trimmed) return '';

  const atIdx = trimmed.indexOf('@');
  if (atIdx > 0) {
    const local = trimmed.slice(0, atIdx);
    const domain = trimmed.slice(atIdx + 1);
    if (local.includes('***')) {
      return `${local}@${domain}`;
    }
    const prefixLen = Math.min(5, local.length);
    const prefix = local.slice(0, prefixLen);
    return `${prefix}***@${domain}`;
  }

  if (trimmed.includes('***')) return trimmed;
  if (trimmed.length > 8) {
    return `${trimmed.slice(0, 8)}***`;
  }
  return `${trimmed}***`;
}

export function buildAccountPresentation(connections = []) {
  const presentationMap = new Map();
  if (!Array.isArray(connections)) return presentationMap;

  // Group by provider
  const byProvider = new Map();
  for (const conn of connections) {
    if (!conn || !conn.id) continue;
    const prov = (conn.provider || 'other').toLowerCase();
    if (!byProvider.has(prov)) {
      byProvider.set(prov, []);
    }
    byProvider.get(prov).push(conn);
  }

  // Stable natural sort by id within provider
  for (const [prov, conns] of byProvider.entries()) {
    conns.sort((a, b) => {
      const idA = String(a.id || '');
      const idB = String(b.id || '');
      return idA.localeCompare(idB, undefined, { numeric: true });
    });

    conns.forEach((conn, index) => {
      const ordinal = String(index + 1).padStart(2, '0');
      let alias = '';
      if (prov === 'antigravity') {
        alias = `Account ${ordinal}`;
      } else if (prov === 'codex') {
        alias = `Codex ${ordinal}`;
      } else {
        const cap = prov.charAt(0).toUpperCase() + prov.slice(1);
        alias = `${cap} ${ordinal}`;
      }

      const rawIdentity = conn.email || conn.label || conn.id || '';
      const maskedIdentity = maskEmail(rawIdentity);
      const shortId = conn.id.length > 12 ? `${conn.id.slice(0, 8)}...` : conn.id;

      presentationMap.set(conn.id, {
        alias,
        maskedIdentity,
        shortId,
      });
    });
  }

  return presentationMap;
}
