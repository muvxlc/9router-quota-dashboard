import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregateLiveModels, createLiveModelsSubscription } from '../lib/client/liveModels.js';

const RAW_PROVIDER = 'openai-compatible-chat-c8016b27-204f-480f-83b8-2826703ee737';

test('aggregateLiveModels keeps raw provider and carries providerLabel', () => {
  const result = aggregateLiveModels([
    { model: 'gpt-4o', provider: RAW_PROVIDER, providerLabel: 'mcs', count: 2 },
  ]);

  assert.equal(result.models.length, 1);
  const [entry] = result.models;
  assert.equal(entry.provider, RAW_PROVIDER);
  assert.equal(entry.providerLabel, 'mcs');

  const dropped = aggregateLiveModels([
    { model: 'a', provider: 'codex', providerLabel: '', count: 1 },
    { model: 'b', provider: 'codex', providerLabel: 42, count: 1 },
  ]);
  for (const entry of dropped.models) {
    assert.equal(Object.prototype.hasOwnProperty.call(entry, 'providerLabel'), false);
  }
});

test('aggregateLiveModels omits providerLabel key when input has none', () => {
  const result = aggregateLiveModels([{ model: 'gpt-4o', provider: 'codex', count: 1 }]);

  assert.equal(result.models.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(result.models[0], 'providerLabel'), false);
});

test('aggregateLiveModels never passes through unrelated fields', () => {
  const result = aggregateLiveModels([
    {
      model: 'gpt-4o',
      provider: RAW_PROVIDER,
      providerLabel: 'mcs',
      count: 1,
      baseUrl: 'https://secret.example',
    },
  ]);

  assert.equal(result.models.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(result.models[0], 'baseUrl'), false);
  assert.equal(JSON.stringify(result).includes('secret.example'), false);
});

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
  }

  simulateMessage(data, eventType = 'message') {
    const event = { data: typeof data === 'string' ? data : JSON.stringify(data), type: eventType };
    if (eventType === 'message' && this.onmessage) this.onmessage(event);
    if (this.listeners[eventType]) {
      for (const fn of this.listeners[eventType]) fn(event);
    }
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }
}

test('createLiveModelsSubscription delivers providerLabel with raw provider to onUpdate', () => {
  MockEventSource.instances = [];
  const stateUpdates = [];

  const sub = createLiveModelsSubscription({
    url: '/api/live-models',
    EventSourceClass: MockEventSource,
    onUpdate: (state) => stateUpdates.push(state),
  });

  const es = MockEventSource.instances[0];
  es.simulateOpen();

  es.simulateMessage({
    activeModels: [
      { model: 'gpt-4o', provider: RAW_PROVIDER, providerLabel: 'mcs', account: 'a***@example.com', count: 2 },
      { model: 'claude-3-5-sonnet', provider: 'codex', count: 1 },
    ],
    recentRequests: [],
  });

  const state = stateUpdates[stateUpdates.length - 1];
  assert.equal(state.status, 'live');
  assert.equal(state.activeModels.length, 2);

  const mapped = state.activeModels.find((m) => m.model === 'gpt-4o');
  assert.equal(mapped.provider, RAW_PROVIDER);
  assert.equal(mapped.providerLabel, 'mcs');

  const plain = state.activeModels.find((m) => m.model === 'claude-3-5-sonnet');
  assert.equal(plain.provider, 'codex');
  assert.equal(Object.prototype.hasOwnProperty.call(plain, 'providerLabel'), false);

  sub.unsubscribe();
});
