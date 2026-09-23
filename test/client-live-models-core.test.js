import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateLiveModels,
  formatLiveStatusLabel,
  formatLiveTimestamp,
  createLiveModelsSubscription,
  getLiveStatusMeta,
} from '../lib/client/liveModels.js';

class MockEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = {};
    this.closed = false;
    MockEventSource.instances.push(this);
  }

  addEventListener(type, listener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type, listener) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  simulateOpen() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
    if (this.listeners.open) {
      for (const fn of this.listeners.open) fn({ type: 'open' });
    }
  }

  simulateMessage(data, eventType = 'message') {
    const event = { data: typeof data === 'string' ? data : JSON.stringify(data), type: eventType };
    if (eventType === 'message' && this.onmessage) this.onmessage(event);
    if (this.listeners[eventType]) {
      for (const fn of this.listeners[eventType]) fn(event);
    }
  }

  simulateError(err = new Error('SSE error')) {
    this.readyState = 2;
    if (this.onerror) this.onerror(err);
    if (this.listeners.error) {
      for (const fn of this.listeners.error) fn(err);
    }
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }
}

test('aggregateLiveModels aggregates count and sorts by count descending then model', () => {
  const models = [
    { model: 'claude-3-5-sonnet', provider: 'codex', account: 'team@test.com', count: 2 },
    { model: 'gemini-2.0-flash', provider: 'antigravity', account: 'dev@test.com', count: 5 },
    { model: 'gpt-4o', provider: 'openai', account: 'admin@test.com', count: 1 },
  ];

  const result = aggregateLiveModels(models);
  assert.equal(result.totalCount, 8);
  assert.equal(result.models.length, 3);
  assert.equal(result.models[0].model, 'gemini-2.0-flash');
  assert.equal(result.models[0].count, 5);
  assert.equal(result.models[1].model, 'claude-3-5-sonnet');
  assert.equal(result.models[1].count, 2);
  assert.equal(result.models[2].model, 'gpt-4o');
  assert.equal(result.models[2].count, 1);

  const empty = aggregateLiveModels([]);
  assert.equal(empty.totalCount, 0);
  assert.deepEqual(empty.models, []);

  const nil = aggregateLiveModels(null);
  assert.equal(nil.totalCount, 0);
  assert.deepEqual(nil.models, []);
});

test('formatLiveStatusLabel returns exact accessible status copy', () => {
  assert.equal(formatLiveStatusLabel('connecting'), 'Connecting…');
  assert.equal(formatLiveStatusLabel('live'), 'Live');
  assert.equal(formatLiveStatusLabel('idle'), 'No active requests');
  assert.equal(formatLiveStatusLabel('disconnected'), 'Connection paused');
  assert.equal(formatLiveStatusLabel('unauthenticated'), 'Session expired');
  assert.equal(formatLiveStatusLabel('error'), 'Live updates unavailable');
  assert.equal(formatLiveStatusLabel('unknown'), 'Live updates unavailable');
});

test('formatLiveTimestamp formats timestamp with Updated prefix', () => {
  assert.equal(formatLiveTimestamp(null), '—');
  assert.equal(formatLiveTimestamp(''), '—');
  const d = new Date('2026-09-21T12:30:45Z');
  const formatted = formatLiveTimestamp(d.toISOString());
  assert.match(formatted, /^Updated\s+\d{2}:\d{2}:\d{2}/);
});

test('createLiveModelsSubscription connects, handles live & idle events, and cleans up', () => {
  MockEventSource.instances = [];
  const stateUpdates = [];

  const sub = createLiveModelsSubscription({
    url: '/api/live-models',
    EventSourceClass: MockEventSource,
    onUpdate: (state) => stateUpdates.push(state),
  });

  assert.equal(stateUpdates.length, 1);
  assert.equal(stateUpdates[0].status, 'connecting');

  assert.equal(MockEventSource.instances.length, 1);
  const es = MockEventSource.instances[0];
  assert.equal(es.url, '/api/live-models');

  es.simulateOpen();
  es.simulateMessage({
    activeModels: [
      { model: 'claude-3-7-sonnet', provider: 'codex', count: 1 },
    ],
    receivedAt: '2026-09-21T10:00:00.000Z',
  });

  const latest = stateUpdates[stateUpdates.length - 1];
  assert.equal(latest.status, 'live');
  assert.equal(latest.totalCount, 1);
  assert.equal(latest.activeModels[0].model, 'claude-3-7-sonnet');
  assert.equal(latest.receivedAt, '2026-09-21T10:00:00.000Z');

  es.simulateMessage({
    activeModels: [],
    receivedAt: '2026-09-21T10:01:00.000Z',
  });
  const idleState = stateUpdates[stateUpdates.length - 1];
  assert.equal(idleState.status, 'idle');
  assert.equal(idleState.totalCount, 0);

  sub.unsubscribe();
});

test('createLiveModelsSubscription handles status events directly', () => {
  MockEventSource.instances = [];
  const stateUpdates = [];

  const sub = createLiveModelsSubscription({
    url: '/api/live-models',
    EventSourceClass: MockEventSource,
    onUpdate: (state) => stateUpdates.push(state),
  });

  const es = MockEventSource.instances[0];
  es.simulateOpen();

  es.simulateMessage({ status: 'idle', receivedAt: '2026-09-21T10:02:00.000Z' }, 'status');
  assert.equal(stateUpdates[stateUpdates.length - 1].status, 'idle');

  es.simulateMessage({ status: 'disconnected', receivedAt: '2026-09-21T10:03:00.000Z' }, 'status');
  assert.equal(stateUpdates[stateUpdates.length - 1].status, 'disconnected');

  sub.unsubscribe();
});

test('aggregateLiveModels handles equal counts, zero/negative counts, and missing names', () => {
  const models = [
    { model: 'zebra-v1', provider: 'other', count: 3 },
    { model: 'alpha-v1', provider: 'other', count: 3 },
    { count: 0 },
    { model: 'broken-count', count: -2 },
    null,
  ];

  const res = aggregateLiveModels(models);
  assert.equal(res.totalCount, 6);
  assert.equal(res.models.length, 4);
  assert.equal(res.models[0].model, 'alpha-v1');
  assert.equal(res.models[1].model, 'zebra-v1');
  assert.equal(res.models[2].model, 'broken-count');
  assert.equal(res.models[2].count, 0);
  assert.equal(res.models[3].model, 'Unknown');
  assert.equal(res.models[3].count, 0);
});

test('getLiveStatusMeta exported from liveModels returns correct metadata', () => {
  assert.deepEqual(getLiveStatusMeta('connecting'), {
    text: 'CONNECTING',
    pillClass: 'connecting',
    dotColor: 'var(--theme-amber)',
    pulse: false,
  });
  assert.deepEqual(getLiveStatusMeta('live', 3), {
    text: 'CONNECTED',
    pillClass: 'connected',
    dotColor: 'var(--theme-green)',
    pulse: true,
  });
  assert.deepEqual(getLiveStatusMeta('live', 0), {
    text: 'CONNECTED',
    pillClass: 'connected',
    dotColor: 'var(--theme-green)',
    pulse: false,
  });
  assert.deepEqual(getLiveStatusMeta('idle'), {
    text: 'IDLE',
    pillClass: 'idle',
    dotColor: 'var(--theme-text-muted)',
    pulse: false,
  });
  assert.deepEqual(getLiveStatusMeta('disconnected'), {
    text: 'DISCONNECTED',
    pillClass: 'disconnected',
    dotColor: 'var(--theme-red)',
    pulse: false,
  });
  assert.deepEqual(getLiveStatusMeta('error'), {
    text: 'UNAVAILABLE',
    pillClass: 'unavailable',
    dotColor: 'var(--theme-red)',
    pulse: false,
  });
});

test('createLiveModelsSubscription ends connecting on onopen even without data frames', () => {
  MockEventSource.instances = [];
  const stateUpdates = [];

  const sub = createLiveModelsSubscription({
    url: '/api/live-models',
    EventSourceClass: MockEventSource,
    onUpdate: (state) => stateUpdates.push(state),
  });

  assert.equal(stateUpdates.length, 1);
  assert.equal(stateUpdates[0].status, 'connecting');

  const es = MockEventSource.instances[0];
  es.simulateOpen();

  assert.equal(stateUpdates.length, 2);
  const openState = stateUpdates[1];
  assert.equal(openState.status, 'idle');
  assert.equal(openState.totalCount, 0);
  assert.equal(openState.receivedAt, null);
  assert.ok(openState.connectedAt);

  sub.unsubscribe();
});

test('formatLiveTimestamp conveys connected state when open without data, and last data on disconnect/error', () => {
  const d = new Date('2026-09-21T10:00:00Z');
  const dIso = d.toISOString();
  const c = new Date('2026-09-21T10:05:00Z');
  const cIso = c.toISOString();

  const connectedTime = formatLiveTimestamp(null, { status: 'idle', connectedAt: cIso });
  assert.match(connectedTime, /^Connected\s+\d{2}:\d{2}:\d{2}/);

  const updatedTime = formatLiveTimestamp(dIso, { status: 'live', connectedAt: cIso });
  assert.match(updatedTime, /^Updated\s+\d{2}:\d{2}:\d{2}/);

  const disconnectedWithData = formatLiveTimestamp(dIso, { status: 'disconnected' });
  assert.match(disconnectedWithData, /^Last data\s+\d{2}:\d{2}:\d{2}/);
  assert.equal(disconnectedWithData.startsWith('Updated'), false);

  const errorWithData = formatLiveTimestamp(dIso, { status: 'error' });
  assert.match(errorWithData, /^Last data\s+\d{2}:\d{2}:\d{2}/);
  assert.equal(errorWithData.startsWith('Updated'), false);

  const reconnectingWithData = formatLiveTimestamp(dIso, { status: 'connecting' });
  assert.match(reconnectingWithData, /^Last data\s+\d{2}:\d{2}:\d{2}/);

  assert.equal(formatLiveTimestamp(null, { status: 'disconnected' }), '—');
  assert.equal(formatLiveTimestamp(null, { status: 'error' }), '—');
});

test('EventSource lifecycle preserves last payload timestamp across idle and error without inventing heartbeat', () => {
  MockEventSource.instances = [];
  const stateUpdates = [];

  const sub = createLiveModelsSubscription({
    url: '/api/live-models',
    EventSourceClass: MockEventSource,
    onUpdate: (state) => stateUpdates.push(state),
  });

  const es = MockEventSource.instances[0];
  es.simulateOpen();

  let latest = stateUpdates[stateUpdates.length - 1];
  assert.equal(latest.status, 'idle');
  assert.equal(latest.receivedAt, null);
  assert.equal(formatLiveTimestamp(latest.receivedAt, { status: latest.status, connectedAt: latest.connectedAt }).startsWith('Connected'), true);

  const payloadTime = '2026-09-21T10:15:00.000Z';
  es.simulateMessage({
    activeModels: [{ model: 'gemini-2.0-flash', provider: 'antigravity', count: 1 }],
    receivedAt: payloadTime,
  });
  latest = stateUpdates[stateUpdates.length - 1];
  assert.equal(latest.status, 'live');
  assert.equal(latest.receivedAt, payloadTime);
  assert.equal(formatLiveTimestamp(latest.receivedAt, { status: latest.status, connectedAt: latest.connectedAt }).startsWith('Updated'), true);

  es.simulateError(new Error('Connection interrupted'));
  latest = stateUpdates[stateUpdates.length - 1];
  assert.equal(latest.status, 'error');
  assert.equal(latest.receivedAt, payloadTime);
  const errorTime = formatLiveTimestamp(latest.receivedAt, { status: latest.status, connectedAt: latest.connectedAt });
  assert.equal(errorTime.startsWith('Last data'), true);
  assert.equal(errorTime.startsWith('Updated'), false);

  sub.unsubscribe();
});
