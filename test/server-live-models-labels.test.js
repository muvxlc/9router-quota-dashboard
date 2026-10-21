import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveModelsStream } from '../lib/server/liveModels.js';
import { defaultSessionStore } from '../lib/server/session.js';
import { defaultUpstreamClient } from '../lib/server/upstream.js';

const PROVIDER_ID = 'openai-compatible-chat-c8016b27-204f-480f-83b8-2826703ee737';
const FRAME = `data: ${JSON.stringify({
  activeRequests: [{ model: 'gpt-4o', provider: PROVIDER_ID, account: 'dev@company.com', count: 1 }],
})}\n\n`;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function drainMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

function nodeResponse(nodes) {
  return {
    ok: true,
    headers: { get: () => null },
    text: async () => JSON.stringify({ nodes }),
  };
}

function setup({ nodesResult }) {
  const token = defaultSessionStore.createSession('mock-upstream-token').token;
  const originalRequest = defaultUpstreamClient.request;
  const nodeRequest = deferred();
  const usageReady = deferred();
  const encoder = new TextEncoder();
  let upstreamController = null;

  defaultUpstreamClient.request = async (path) => {
    if (path === '/api/provider-nodes') {
      nodeRequest.resolve();
      return nodesResult();
    }
    if (path === '/api/usage/stream') {
      const body = new ReadableStream({
        start(controller) {
          upstreamController = controller;
          usageReady.resolve();
        },
      });
      return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
    throw new Error(`unexpected upstream path: ${path}`);
  };

  const liveStream = createLiveModelsStream({
    upstreamToken: 'mock-upstream-token',
    sessionToken: token,
  });
  const reader = liveStream.getReader();

  const feed = () => {
    upstreamController.enqueue(encoder.encode(FRAME));
  };

  const cleanup = async () => {
    await reader.cancel();
    defaultUpstreamClient.request = originalRequest;
    defaultSessionStore.destroySession(token);
  };

  return { reader, feed, nodeRequest, usageReady, cleanup };
}

function readJsonFrame(value) {
  const text = new TextDecoder().decode(value);
  assert.ok(text.startsWith('data: '), `expected a data frame, got: ${text}`);
  return JSON.parse(text.slice('data: '.length));
}

test('(1) node list resolved before first frame -> frame carries providerLabel mcs', async () => {
  const nodeResult = deferred();
  const ctx = setup({ nodesResult: () => nodeResult.promise });

  try {
    await ctx.nodeRequest.promise;
    nodeResult.resolve(nodeResponse([{ id: PROVIDER_ID, prefix: 'mcs' }]));
    await drainMicrotasks();
    await ctx.usageReady.promise;

    ctx.feed();
    const { value, done } = await ctx.reader.read();
    assert.equal(done, false);

    const payload = readJsonFrame(value);
    assert.equal(payload.activeModels.length, 1);
    assert.equal(payload.activeModels[0].provider, PROVIDER_ID);
    assert.equal(payload.activeModels[0].providerLabel, 'mcs');
  } finally {
    await ctx.cleanup();
  }
});

test('(2) node list pending at first frame -> raw provider, label arrives on later frame', async () => {
  const nodeResult = deferred();
  const ctx = setup({ nodesResult: () => nodeResult.promise });

  try {
    await ctx.nodeRequest.promise;
    await ctx.usageReady.promise;

    ctx.feed();
    const first = await ctx.reader.read();
    assert.equal(first.done, false);
    const firstPayload = readJsonFrame(first.value);
    assert.equal(firstPayload.activeModels[0].provider, PROVIDER_ID);
    assert.equal(Object.hasOwn(firstPayload.activeModels[0], 'providerLabel'), false);

    nodeResult.resolve(nodeResponse([{ id: PROVIDER_ID, prefix: 'mcs' }]));
    await drainMicrotasks();

    ctx.feed();
    const second = await ctx.reader.read();
    assert.equal(second.done, false);
    const secondPayload = readJsonFrame(second.value);
    assert.equal(secondPayload.activeModels[0].provider, PROVIDER_ID);
    assert.equal(secondPayload.activeModels[0].providerLabel, 'mcs');
  } finally {
    await ctx.cleanup();
  }
});

test('(3) failing node lookup (401 / malformed JSON) keeps the stream open', async () => {
  const failures = [
    () => ({ ok: false, status: 401, headers: { get: () => null }, text: async () => '' }),
    () => ({ ok: true, headers: { get: () => null }, text: async () => 'not-json{' }),
  ];

  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);

  for (const nodesResult of failures) {
    const ctx = setup({ nodesResult });
    process.on('unhandledRejection', onUnhandled);
    try {
      await ctx.nodeRequest.promise;
      await drainMicrotasks();
      await ctx.usageReady.promise;

      ctx.feed();
      const { value, done } = await ctx.reader.read();
      assert.equal(done, false, 'stream must stay open after a failed label lookup');

      const payload = readJsonFrame(value);
      assert.equal(payload.activeModels[0].provider, PROVIDER_ID);
      assert.equal(Object.hasOwn(payload.activeModels[0], 'providerLabel'), false);

      await drainMicrotasks();
      assert.deepEqual(unhandled, [], 'label lookup failures must not escape as unhandled rejections');
    } finally {
      process.off('unhandledRejection', onUnhandled);
      await ctx.cleanup();
    }
  }
});
