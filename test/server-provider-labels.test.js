import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProviderLabelMap,
  resolveProviderLabel,
  createProviderLabelCache,
} from '../lib/server/providerLabels.js';

const ID = 'openai-compatible-chat-c8016b27-204f-480f-83b8-2826703ee737';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('(a) maps node.id to prefix only and leaks nothing else', () => {
  const map = buildProviderLabelMap([
    {
      id: ID,
      prefix: 'mcs',
      name: 'My Compatible Service',
      baseUrl: 'https://secret.example',
      apiType: 'chat',
    },
  ]);
  assert.deepEqual({ ...map }, { [ID]: 'mcs' });
  assert.equal(map[ID], 'mcs');
  const json = JSON.stringify(map);
  assert.equal(json.includes('secret.example'), false);
  assert.equal(json.includes('My Compatible Service'), false);
  assert.equal(json.includes('apiType'), false);
  assert.equal(json.includes('baseUrl'), false);
});

test('(b) skips name-only, prefix-less, and non-object entries', () => {
  const map = buildProviderLabelMap([
    { id: 'name-only', name: 'My Compatible Service' },
    { id: 'empty-prefix', prefix: '   ', name: 'Also Named' },
    { name: 'no-id', prefix: 'ghost' },
    { id: '', prefix: 'ghost' },
    null,
    undefined,
    'string-entry',
    42,
    ['array-entry'],
    { id: 'ok', prefix: ' good ' },
  ]);
  assert.deepEqual({ ...map }, { ok: 'good' });
  assert.equal(resolveProviderLabel('name-only', map), 'name-only');
});

test('(b2) strips control chars, caps label at 32 chars, caps map at 500 entries', () => {
  const map = buildProviderLabelMap([
    { id: 'ctl', prefix: 'a\u0000b\u001fc\u007fd' },
    { id: 'long', prefix: 'x'.repeat(80) },
    { id: '__proto__', prefix: 'proto-label' },
  ]);
  assert.equal(map.ctl, 'abcd');
  assert.equal(map.long, 'x'.repeat(32));
  assert.equal(map.long.length, 32);
  assert.equal(map.__proto__, 'proto-label');

  const many = Array.from({ length: 700 }, (_, i) => ({ id: `id-${i}`, prefix: `p${i}` }));
  const capped = buildProviderLabelMap(many);
  assert.equal(Object.keys(capped).length, 500);
  assert.equal(capped['id-499'], 'p499');
  assert.equal(Object.prototype.hasOwnProperty.call(capped, 'id-500'), false);
});

test('(c) resolve returns mapped label only for owned keys, else the id', () => {
  const map = buildProviderLabelMap([{ id: ID, prefix: 'mcs' }]);
  assert.equal(resolveProviderLabel(ID, map), 'mcs');
  assert.equal(resolveProviderLabel('codex', map), 'codex');
  assert.equal(resolveProviderLabel('toString', map), 'toString');
  assert.equal(resolveProviderLabel('constructor', map), 'constructor');
  assert.equal(resolveProviderLabel('__proto__', map), '__proto__');
  assert.equal(resolveProviderLabel('hasOwnProperty', map), 'hasOwnProperty');
  assert.equal(resolveProviderLabel('codex', null), 'codex');
  assert.equal(resolveProviderLabel('codex', {}), 'codex');
  const sparse = Object.create(null);
  sparse.blank = '';
  sparse.notString = 42;
  assert.equal(resolveProviderLabel('blank', sparse), 'blank');
  assert.equal(resolveProviderLabel('notString', sparse), 'notString');
});

test('(d) cache reuses within TTL and refreshes once past TTL', async () => {
  let clock = 1000;
  let calls = 0;
  const gate = deferred();
  const cache = createProviderLabelCache({
    now: () => clock,
    ttlMs: 1000,
    fetchNodes: async () => {
      calls += 1;
      if (calls === 1) return { a: 'A' };
      await gate.promise;
      return { a: 'A2', b: 'B' };
    },
  });

  await cache.refresh();
  assert.equal(calls, 1);
  assert.deepEqual({ ...cache.getLabels() }, { a: 'A' });

  clock += 500;
  await cache.refresh();
  assert.equal(calls, 1);
  assert.deepEqual({ ...cache.getLabels() }, { a: 'A' });

  clock += 501;
  const stale = cache.getLabels();
  assert.deepEqual({ ...stale }, { a: 'A' });
  assert.equal(calls, 2);
  const first = cache.refresh();
  const second = cache.refresh();
  assert.equal(first, second);
  gate.resolve();
  await first;
  assert.equal(calls, 2);
  assert.deepEqual({ ...cache.getLabels() }, { a: 'A2', b: 'B' });
  assert.equal(cache.getLabels().a, 'A2');
  assert.equal(calls, 2);
});

test('(e) sync throw and async rejection keep the previous map without throwing', async () => {
  let clock = 1000;
  let mode = 'ok';
  const failing = deferred();
  const cache = createProviderLabelCache({
    now: () => clock,
    ttlMs: 1000,
    fetchNodes: () => {
      if (mode === 'throw') throw new Error('sync boom');
      if (mode === 'reject') return failing.promise;
      return Promise.resolve({ a: 'A' });
    },
  });

  await cache.refresh();
  assert.deepEqual({ ...cache.getLabels() }, { a: 'A' });

  mode = 'throw';
  clock += 2000;
  await assert.doesNotReject(cache.refresh());
  assert.deepEqual({ ...cache.getLabels() }, { a: 'A' });
  await assert.doesNotReject(cache.refresh());
  assert.deepEqual({ ...cache.getLabels() }, { a: 'A' });

  mode = 'reject';
  clock += 2000;
  assert.doesNotThrow(() => cache.getLabels());
  assert.deepEqual({ ...cache.getLabels() }, { a: 'A' });
  failing.reject(new Error('async boom'));
  await assert.doesNotReject(cache.refresh());
  assert.deepEqual({ ...cache.getLabels() }, { a: 'A' });
  await assert.doesNotReject(cache.refresh());
  assert.deepEqual({ ...cache.getLabels() }, { a: 'A' });
});

test('(f) a failing lookup backs off one TTL instead of retrying on every frame', async () => {
  let clock = 1000;
  let calls = 0;
  const cache = createProviderLabelCache({
    now: () => clock,
    ttlMs: 60000,
    fetchNodes: async () => {
      calls += 1;
      throw new Error('provider nodes unavailable');
    },
  });

  await cache.refresh();
  assert.equal(calls, 1);

  // 30 inbound frames inside one TTL must not fire 30 upstream lookups.
  for (let frame = 0; frame < 30; frame += 1) {
    clock += 1000;
    cache.getLabels();
    // Each frame arrives after the previous lookup attempt settled.
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.equal(calls, 1, 'a failing lookup must not be retried per frame');

  // Past the TTL the cache tries again, once.
  clock += 60000;
  cache.getLabels();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  cache.getLabels();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
});

test('(c2) resolve does not inherit keys from a prototype', () => {
  const inherited = Object.create({ toString: 'inherited', [ID]: 'inherited-label' });
  assert.equal(resolveProviderLabel('toString', inherited), 'toString');
  assert.equal(resolveProviderLabel(ID, inherited), ID);
  inherited[ID] = 'mcs';
  assert.equal(resolveProviderLabel(ID, inherited), 'mcs');
});

test('(e2) failing first fetch leaves an empty map and never rejects getLabels', async () => {
  let mode = 'throw';
  let clock = 0;
  const cache = createProviderLabelCache({
    now: () => clock,
    ttlMs: 1000,
    fetchNodes: async () => {
      if (mode === 'throw') throw new Error('boom');
      return { a: 'A' };
    },
  });
  await assert.doesNotReject(cache.refresh());
  assert.deepEqual({ ...cache.getLabels() }, {});

  // The failure backs off one TTL, so an immediate retry does nothing...
  await assert.doesNotReject(cache.refresh());
  assert.deepEqual({ ...cache.getLabels() }, {});

  // ...and once the TTL lapses a healthy fetch populates the map.
  mode = 'ok';
  clock += 1001;
  await assert.doesNotReject(cache.refresh());
  assert.deepEqual({ ...cache.getLabels() }, { a: 'A' });
});
