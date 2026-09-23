import test from 'node:test';
import assert from 'node:assert/strict';

import { createLiveModelsSubscription } from '../lib/client/liveModels.js';

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

test('createLiveModelsSubscription pauses when offline/hidden and reconnects with backoff', () => {
  MockEventSource.instances = [];
  const stateUpdates = [];

  let mockVisible = true;
  let mockOnline = true;
  const mockDoc = {
    get visibilityState() { return mockVisible ? 'visible' : 'hidden'; },
    addEventListener: (type, fn) => { mockDoc[type] = fn; },
    removeEventListener: () => {},
  };
  const mockWin = {
    get navigator() { return { onLine: mockOnline }; },
    addEventListener: (type, fn) => { mockWin[type] = fn; },
    removeEventListener: () => {},
    setTimeout: (fn) => setTimeout(fn, 1),
    clearTimeout: (id) => clearTimeout(id),
  };

  const sub = createLiveModelsSubscription({
    url: '/api/live-models',
    EventSourceClass: MockEventSource,
    documentRef: mockDoc,
    windowRef: mockWin,
    initialBackoffMs: 5,
    maxBackoffMs: 20,
    onUpdate: (state) => stateUpdates.push(state),
  });

  const es1 = MockEventSource.instances[0];
  es1.simulateOpen();

  mockVisible = false;
  if (mockDoc.visibilitychange) mockDoc.visibilitychange();
  assert.equal(es1.closed, true);
  assert.equal(stateUpdates[stateUpdates.length - 1].status, 'disconnected');

  mockVisible = true;
  if (mockDoc.visibilitychange) mockDoc.visibilitychange();
  assert.equal(MockEventSource.instances.length, 2);
  const es2 = MockEventSource.instances[1];
  assert.equal(es2.closed, false);

  sub.unsubscribe();
  assert.equal(es2.closed, true);
});

test('createLiveModelsSubscription gracefully handles malformed JSON and error events', () => {
  MockEventSource.instances = [];
  const stateUpdates = [];

  const sub = createLiveModelsSubscription({
    url: '/api/live-models',
    EventSourceClass: MockEventSource,
    onUpdate: (state) => stateUpdates.push(state),
  });

  const es = MockEventSource.instances[0];
  es.simulateOpen();

  es.simulateMessage('this is not json');
  assert.equal(stateUpdates[stateUpdates.length - 1].status, 'idle');

  es.simulateError(new Error('Network error'));
  assert.equal(stateUpdates[stateUpdates.length - 1].status, 'error');

  sub.unsubscribe();
});

test('createLiveModelsSubscription handles unauthenticated status event and invokes onSessionLoss', () => {
  MockEventSource.instances = [];
  const stateUpdates = [];
  let sessionLost = false;

  const sub = createLiveModelsSubscription({
    url: '/api/live-models',
    EventSourceClass: MockEventSource,
    onSessionLoss: () => { sessionLost = true; },
    onUpdate: (state) => stateUpdates.push(state),
  });

  const es = MockEventSource.instances[0];
  es.simulateOpen();

  es.simulateMessage({
    activeModels: [{ model: 'gpt-4o', provider: 'openai', count: 3 }],
  });
  assert.equal(stateUpdates[stateUpdates.length - 1].activeModels.length, 1);

  es.simulateMessage({ status: 'unauthenticated' }, 'status');

  const finalState = stateUpdates[stateUpdates.length - 1];
  assert.equal(finalState.status, 'unauthenticated');
  assert.equal(finalState.activeModels.length, 0);
  assert.equal(finalState.totalCount, 0);
  assert.equal(sessionLost, true);
  assert.equal(es.closed, true);

  sub.unsubscribe();
});

test('createLiveModelsSubscription probes auth on onerror and stops retries on auth loss', async () => {
  MockEventSource.instances = [];
  const stateUpdates = [];
  let sessionLost = false;
  let probeCalled = 0;

  const mockFetch = async (url, opts) => {
    probeCalled++;
    assert.equal(url, '/api/auth/status');
    assert.ok(opts?.signal);
    return {
      ok: true,
      json: async () => ({ authenticated: false }),
    };
  };

  const sub = createLiveModelsSubscription({
    url: '/api/live-models',
    EventSourceClass: MockEventSource,
    fetchFn: mockFetch,
    onSessionLoss: () => { sessionLost = true; },
    onUpdate: (state) => stateUpdates.push(state),
  });

  const es = MockEventSource.instances[0];
  es.simulateOpen();

  es.simulateMessage({
    activeModels: [{ model: 'claude-3-5-sonnet', provider: 'codex', count: 1 }],
  });

  es.simulateError(new Error('Connection closed by server'));

  await new Promise((r) => setTimeout(r, 10));

  assert.equal(probeCalled, 1);
  assert.equal(sessionLost, true);
  const finalState = stateUpdates[stateUpdates.length - 1];
  assert.equal(finalState.status, 'unauthenticated');
  assert.equal(finalState.activeModels.length, 0);
  assert.equal(finalState.totalCount, 0);

  sub.unsubscribe();
});

test('createLiveModelsSubscription preserves session on 503 probe error and clears active models', async () => {
  MockEventSource.instances = [];
  const stateUpdates = [];
  let sessionLost = false;
  let probeCalled = 0;

  const mockFetch = async () => {
    probeCalled++;
    return {
      ok: false,
      status: 503,
      json: async () => ({ error: 'Service Unavailable' }),
    };
  };

  const sub = createLiveModelsSubscription({
    url: '/api/live-models',
    EventSourceClass: MockEventSource,
    fetchFn: mockFetch,
    onSessionLoss: () => { sessionLost = true; },
    onUpdate: (state) => stateUpdates.push(state),
  });

  const es = MockEventSource.instances[0];
  es.simulateOpen();

  es.simulateMessage({
    activeModels: [{ model: 'gemini-2.5-pro', provider: 'antigravity', count: 4 }],
  });
  assert.equal(stateUpdates[stateUpdates.length - 1].activeModels.length, 1);

  es.simulateError(new Error('Gateway timeout'));

  await new Promise((r) => setTimeout(r, 10));

  assert.equal(probeCalled, 1);
  assert.equal(sessionLost, false);
  const finalState = stateUpdates[stateUpdates.length - 1];
  assert.equal(finalState.status, 'error');
  assert.equal(finalState.activeModels.length, 0);
  assert.equal(finalState.totalCount, 0);

  sub.unsubscribe();
});
