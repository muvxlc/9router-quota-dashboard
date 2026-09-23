function toIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function toNum(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function convertScale(val, total) {
  if (total === 1000 && typeof val === 'number') {
    return Math.round(val / 10);
  }
  return val;
}

function getRemainingPercent(q) {
  if (!q || typeof q !== 'object') return null;
  if (q.remainingPercentage !== undefined && q.remainingPercentage !== null) {
    const n = Number(q.remainingPercentage);
    return Number.isFinite(n) ? n : null;
  }
  if (q.remaining !== undefined && q.remaining !== null) {
    const rem = Number(q.remaining);
    if (Number.isFinite(rem)) {
      if (q.total === 1000) return Math.round(rem / 10);
      if (Number.isFinite(Number(q.total)) && Number(q.total) > 0) {
        return Math.max(0, Math.round((rem / Number(q.total)) * 100));
      }
      return rem;
    }
  }
  if (q.total !== undefined && q.used !== undefined) {
    const tot = Number(q.total);
    const usd = Number(q.used);
    if (Number.isFinite(tot) && Number.isFinite(usd) && tot > 0) {
      return Math.max(0, Math.round(((tot - usd) / tot) * 100));
    }
  }
  return null;
}

function buildGroupWindow(familyKey, familyLabel, members) {
  if (!members || members.length === 0) return null;

  let rep = members[0][1];
  let minPct = getRemainingPercent(rep);

  for (let i = 1; i < members.length; i++) {
    const cur = members[i][1];
    const curPct = getRemainingPercent(cur);
    if (curPct !== null) {
      if (minPct === null || curPct < minPct) {
        minPct = curPct;
        rep = cur;
      }
    }
  }

  const remainingPercent = minPct;
  const isSynthetic = rep?.total === 1000;
  let total;
  let used;
  let unit;

  if (isSynthetic) {
    total = 100;
    unit = '%';
    if (typeof rep.used === 'number') {
      used = convertScale(rep.used, 1000);
    } else if (remainingPercent !== null) {
      used = 100 - remainingPercent;
    } else {
      used = null;
    }
  } else {
    total = toNum(rep?.total, null);
    used = toNum(rep?.used, null);
    unit = rep?.unit || null;
    if (used === null && total !== null && remainingPercent !== null) {
      used = Math.max(0, Math.round(((100 - remainingPercent) / 100) * total));
    }
  }

  return {
    key: familyKey,
    label: familyLabel,
    remainingPercent,
    used,
    total,
    unit,
    resetAt: toIso(rep?.resetAt),
    unlimited: rep?.unlimited === true,
    recurring: rep?.recurring !== false,
  };
}

function buildSingleWindow(key, q, defaultLabel) {
  const isSynthetic = q?.total === 1000;
  const rem = getRemainingPercent(q);
  let total;
  let used;
  let unit;

  if (isSynthetic) {
    total = 100;
    unit = '%';
    if (typeof q.used === 'number') {
      used = convertScale(q.used, 1000);
    } else if (rem !== null) {
      used = 100 - rem;
    } else {
      used = null;
    }
  } else {
    total = toNum(q?.total, null);
    used = toNum(q?.used, null);
    unit = q?.unit || null;
    if (used === null && total !== null && rem !== null) {
      used = Math.max(0, Math.round(((100 - rem) / 100) * total));
    }
  }

  return {
    key,
    label: q?.displayName || q?.name || defaultLabel || key,
    remainingPercent: rem,
    used,
    total,
    unit,
    resetAt: toIso(q?.resetAt),
    unlimited: q?.unlimited === true,
    recurring: q?.recurring !== false,
  };
}

export function normalizeAntigravityWindows(quotas = {}) {
  const entries = Array.isArray(quotas)
    ? quotas.filter((q) => q && typeof q === 'object').map((q, idx) => [q.modelId || q.name || q.displayName || `quota_${idx}`, q])
    : Object.entries(quotas).filter(([, q]) => q && typeof q === 'object');

  const geminiModels = [];
  const claudeModels = [];
  const gptModels = [];
  const weeklyModels = [];
  const imageModels = [];
  const otherModels = [];

  for (const entry of entries) {
    const [key, q] = entry;
    const k = String(key || '').toLowerCase();
    const d = String(q?.displayName || q?.name || '').toLowerCase();
    const m = String(q?.modelId || '').toLowerCase();
    const c = `${k} ${d} ${m}`;

    if (k === 'gemini_weekly' || (c.includes('weekly') && c.includes('gemini'))) {
      weeklyModels.push(['gemini_weekly', q, 'Gemini Weekly']);
    } else if (
      k === 'claude_gpt_weekly' ||
      (c.includes('weekly') && (c.includes('claude') || c.includes('gpt')))
    ) {
      weeklyModels.push(['claude_gpt_weekly', q, 'Claude & GPT Weekly']);
    } else if (c.includes('weekly')) {
      weeklyModels.push([key, q, q?.displayName || key]);
    } else if (c.includes('image')) {
      imageModels.push([key, q, q?.displayName || 'Image Generation']);
    } else if (c.includes('gemini')) {
      geminiModels.push(entry);
    } else if (c.includes('claude')) {
      claudeModels.push(entry);
    } else if (c.includes('gpt')) {
      gptModels.push(entry);
    } else {
      otherModels.push(entry);
    }
  }

  // ponytail: fixed families gemini/claude/gpt/weekly/image; add dynamic family registry when provider extends buckets
  const windows = [];

  if (geminiModels.length > 0) {
    windows.push(buildGroupWindow('gemini', 'Gemini (Flash / Pro)', geminiModels));
  }
  if (claudeModels.length > 0) {
    windows.push(buildGroupWindow('claude', 'Claude (Sonnet / Opus)', claudeModels));
  }
  if (gptModels.length > 0) {
    const firstRep = gptModels[0][1];
    const gptLabel = firstRep?.displayName || 'GPT-OSS (120B)';
    windows.push(buildGroupWindow('gpt', gptLabel, gptModels));
  }

  for (const [k, q, label] of weeklyModels) {
    windows.push(buildSingleWindow(k, q, label));
  }
  for (const [k, q, label] of imageModels) {
    windows.push(buildSingleWindow(k, q, label));
  }
  for (const [k, q] of otherModels) {
    windows.push(buildSingleWindow(k, q, k));
  }

  return windows.filter(Boolean);
}
