const CREDENTIAL_PATTERNS = [
  /[a-zA-Z0-9+.-]+:\/\/[^/\s]*:[^/@\s]*@/,
  /bearer\s+[a-zA-Z0-9._-]+/i,
  /eyJ[a-zA-Z0-9_-]{10,}/,
  /sk-[a-zA-Z0-9_-]{8,}/i,
  /[?&](?:key|token|secret|password|auth|api_key)=[^&\s]+/i,
];

export function containsCredential(str) {
  if (typeof str !== 'string') return false;
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(str));
}

const CLEAN_EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function sanitizeAccountDisplay(account) {
  if (typeof account !== 'string') return '';
  const clean = account.replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (!clean || containsCredential(clean)) return '';

  if (CLEAN_EMAIL_PATTERN.test(clean)) {
    const atIdx = clean.indexOf('@');
    const user = clean.slice(0, atIdx);
    const domain = clean.slice(atIdx + 1);
    const maskedUser = user.length <= 2 ? `${user[0] || '*'}***` : `${user.slice(0, 2)}***`;
    return `${maskedUser}@${domain}`.slice(0, 64);
  }

  return clean.slice(0, 64);
}

export function sanitizeLiveModels(raw) {
  const receivedAt = new Date().toISOString();
  if (!raw || typeof raw !== 'object') {
    return { activeModels: [], receivedAt };
  }

  const list = Array.isArray(raw.activeRequests)
    ? raw.activeRequests
    : Array.isArray(raw.activeModels)
      ? raw.activeModels
      : [];

  const activeModels = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;

    const rawModel = typeof item.model === 'string' ? item.model.replace(/[\x00-\x1f\x7f]/g, '').trim() : '';
    if (!rawModel) continue;

    const countNum = Number(item.count);
    if (!Number.isFinite(countNum) || countNum <= 0) continue;

    const model = containsCredential(rawModel) ? 'Unknown' : rawModel.slice(0, 128);
    const rawProvider = typeof item.provider === 'string' ? item.provider.replace(/[\x00-\x1f\x7f]/g, '').trim() : '';
    const provider = containsCredential(rawProvider) ? 'unknown' : (rawProvider || 'unknown').slice(0, 64);
    const account = sanitizeAccountDisplay(item.account);
    const count = Math.floor(countNum);

    activeModels.push({ model, provider, account, count });
  }

  return { activeModels, receivedAt };
}
