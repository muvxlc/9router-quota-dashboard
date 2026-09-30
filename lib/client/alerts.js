'use client';

export function isAccountAlertable(account) {
  if (!account) return false;
  const status = account.effectiveStatus?.status;
  const reason = account.effectiveStatus?.reason || account.quota?.reason;
  return status === 'exhausted' || reason === 'PROVIDER_AUTH_REQUIRED';
}

export function buildIncidentKey(account) {
  const connId = account.id || 'unknown';
  const status = account.effectiveStatus?.status || 'unknown';
  const reason = account.effectiveStatus?.reason || account.quota?.reason || 'none';
  const resetAt = account.quota?.windows?.[0]?.resetAt || 'none';
  return `${connId}:${status}:${reason}:${resetAt}`;
}

export function checkAccountsForAlerts(accounts = [], alertedIncidents = new Map(), notifyFn = null) {
  const newAlerts = [];
  const activeIncidentKeys = new Set();

  for (const account of accounts) {
    if (!account) continue;

    if (isAccountAlertable(account)) {
      const key = buildIncidentKey(account);
      activeIncidentKeys.add(key);

      if (!alertedIncidents.has(key)) {
        const isAuth = (account.effectiveStatus?.reason || account.quota?.reason) === 'PROVIDER_AUTH_REQUIRED';
        const alias = account.displayAlias || account.label || account.id;
        const alert = {
          key,
          connectionId: account.id,
          provider: account.provider,
          alias,
          type: isAuth ? 'auth_required' : 'exhausted',
          title: isAuth ? '9Router Auth Required' : '9Router Quota Exhausted',
          message: isAuth
            ? `Auth required for ${alias} (${account.provider})`
            : `Quota exhausted for ${alias} (${account.provider})`,
          createdAt: new Date().toISOString(),
        };

        alertedIncidents.set(key, alert);
        newAlerts.push(alert);

        if (typeof notifyFn === 'function') {
          notifyFn(alert.title, {
            body: alert.message,
            tag: key,
          });
        }
      }
    } else {
      const prefix = `${account.id}:`;
      for (const existingKey of Array.from(alertedIncidents.keys())) {
        if (existingKey.startsWith(prefix)) {
          alertedIncidents.delete(existingKey);
        }
      }
    }
  }

  return newAlerts;
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function getNotificationPermission() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}
