// ponytail: single-scope cache; no eviction beyond the 500-entry map cap.

const MAX_ENTRIES = 500;
const MAX_LABEL_LENGTH = 32;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

export function buildProviderLabelMap(nodes) {
  const map = Object.create(null);
  if (!Array.isArray(nodes)) return map;
  let count = 0;
  for (const node of nodes) {
    if (count >= MAX_ENTRIES) break;
    if (!node || typeof node !== 'object') continue;
    const id = typeof node.id === 'string' ? node.id.trim() : '';
    if (!id) continue;
    if (Object.prototype.hasOwnProperty.call(map, id)) continue;
    // Prefix only - node.name is user prose and never becomes a label.
    const label = String(node.prefix || '')
      .replace(CONTROL_CHARS, '')
      .trim()
      .slice(0, MAX_LABEL_LENGTH);
    if (!label) continue;
    map[id] = label;
    count += 1;
  }
  return map;
}

export function resolveProviderLabel(providerId, map) {
  if (!map || typeof map !== 'object') return providerId;
  if (!Object.prototype.hasOwnProperty.call(map, providerId)) return providerId;
  const label = map[providerId];
  return typeof label === 'string' && label ? label : providerId;
}

export function createProviderLabelCache({ fetchNodes, now = Date.now, ttlMs = 60000 } = {}) {
  let labels = Object.create(null);
  let expiresAt = 0;
  let inflight = null;

  async function load() {
    try {
      const next = await fetchNodes();
      if (next && typeof next === 'object') {
        const copy = Object.create(null);
        for (const key of Object.keys(next)) {
          const value = next[key];
          if (typeof value === 'string' && value) copy[key] = value;
        }
        labels = copy;
      }
      expiresAt = now() + ttlMs;
    } catch {
      // Keep the previous map and back off one TTL: a broken node list must not break the
      // stream, nor turn every inbound frame into a fresh upstream lookup.
      expiresAt = now() + ttlMs;
    }
  }

  function refresh() {
    if (inflight) return inflight;
    if (now() < expiresAt) return Promise.resolve(labels);
    inflight = load().then(() => {
      inflight = null;
    });
    return inflight;
  }

  function getLabels() {
    if (now() >= expiresAt) {
      // Fire-and-forget: load() swallows failures, callers read the stale map.
      refresh();
    }
    return labels;
  }

  return { getLabels, refresh };
}
