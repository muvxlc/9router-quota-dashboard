import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeLiveModels,
  sanitizeAccountDisplay,
  parseSseChunks,
} from '../lib/server/liveModels.js';
import { GET } from '../app/api/live-models/route.js';
import { defaultSessionStore } from '../lib/server/session.js';
import { defaultUpstreamClient } from '../lib/server/upstream.js';
import { SESSION_COOKIE_NAME, APP_ORIGIN } from '../lib/server/config.js';

test('sanitizeAccountDisplay masks emails, credentials, and bounds length', () => {
  assert.equal(sanitizeAccountDisplay('user@example.com'), 'us***@example.com');
  assert.equal(sanitizeAccountDisplay('a@b.com'), 'a***@b.com');
  assert.equal(sanitizeAccountDisplay('sk-1234567890abcdef'), '');
  assert.equal(sanitizeAccountDisplay('bearer secret-token-xyz'), '');
  assert.equal(sanitizeAccountDisplay('Account 12345678...'), 'Account 12345678...');
  assert.equal(sanitizeAccountDisplay('My Team Account'), 'My Team Account');
  assert.equal(sanitizeAccountDisplay(''), '');
  assert.equal(sanitizeAccountDisplay(null), '');
  assert.equal(sanitizeAccountDisplay(12345), '');
});

test('sanitizeAccountDisplay omits account on URL userinfo, JWT, or query secret', () => {
  assert.equal(sanitizeAccountDisplay('https://admin:supersecret@example.com/api'), '');
  assert.equal(sanitizeAccountDisplay('http://user:pass@127.0.0.1'), '');
  assert.equal(sanitizeAccountDisplay('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature'), '');
  assert.equal(sanitizeAccountDisplay('account?token=secret123456'), '');
  assert.equal(sanitizeAccountDisplay('account?key=secret123456'), '');
});

test('sanitizeLiveModels preserves long model names and strips secret substrings', () => {
  const payload = {
    activeRequests: [
      {
        model: 'claude-3-7-sonnet-20250219-thinking',
        provider: 'anthropic',
        account: 'dev@company.com',
        count: 1,
      },
      {
        model: 'https://user:password@malicious.com/model',
        provider: 'evil',
        account: 'https://user:password@example.com',
        count: 1,
      },
    ],
  };

  const sanitized = sanitizeLiveModels(payload);
  assert.equal(sanitized.activeModels.length, 2);
  assert.equal(sanitized.activeModels[0].model, 'claude-3-7-sonnet-20250219-thinking');
  assert.equal(sanitized.activeModels[0].account, 'de***@company.com');
  assert.equal(sanitized.activeModels[1].model, 'Unknown');
  assert.equal(sanitized.activeModels[1].account, '');
});

test('sanitizeLiveModels strips all secret, cost, token, and unapproved fields', () => {
  const dirtyPayload = {
    totalRequests: 50,
    totalCost: 12.34,
    totalPromptTokens: 5000,
    totalCompletionTokens: 2000,
    apiKey: 'sk-secret-key-leaked',
    prompts: ['What is the secret?'],
    endpoint: '/v1/chat/completions',
    recentRequests: [
      { model: 'gpt-4', tokens: { prompt_tokens: 100 } },
    ],
    errorProvider: 'openai',
    byProvider: { openai: { requests: 5 } },
    activeRequests: [
      {
        model: 'claude-3-7-sonnet',
        provider: 'anthropic',
        account: 'developer@company.com',
        count: 2,
        cost: 0.05,
        tokens: 1200,
        apiKey: 'secret',
      },
      {
        model: 'deepseek-r1',
        provider: 'deepseek',
        account: 'Account 98765432...',
        count: '3', // string number
      },
      {
        model: 'invalid-zero-count',
        provider: 'test',
        account: 'test',
        count: 0,
      },
      {
        model: '', // empty model
        provider: 'test',
        account: 'test',
        count: 1,
      },
    ],
  };

  const sanitized = sanitizeLiveModels(dirtyPayload);

  // Must only have activeModels and receivedAt
  assert.deepEqual(Object.keys(sanitized).sort(), ['activeModels', 'receivedAt']);
  assert.equal(typeof sanitized.receivedAt, 'string');
  assert.ok(!Number.isNaN(new Date(sanitized.receivedAt).getTime()));

  // Active models content
  assert.equal(sanitized.activeModels.length, 2);
  assert.deepEqual(sanitized.activeModels[0], {
    model: 'claude-3-7-sonnet',
    provider: 'anthropic',
    account: 'de***@company.com',
    count: 2,
  });
  assert.deepEqual(sanitized.activeModels[1], {
    model: 'deepseek-r1',
    provider: 'deepseek',
    account: 'Account 98765432...',
    count: 3,
  });

  // Zero-count and empty models omitted
  assert.ok(!sanitized.activeModels.some((m) => m.model === 'invalid-zero-count'));
  assert.ok(!sanitized.activeModels.some((m) => m.model === ''));

  // Ensure no forbidden keys anywhere in stringified output
  const str = JSON.stringify(sanitized);
  assert.ok(!str.includes('totalRequests'));
  assert.ok(!str.includes('totalCost'));
  assert.ok(!str.includes('totalPromptTokens'));
  assert.ok(!str.includes('recentRequests'));
  assert.ok(!str.includes('errorProvider'));
  assert.ok(!str.includes('developer@company.com'));
  assert.ok(!str.includes('sk-secret'));
});

test('sanitizeLiveModels handles null, undefined, empty, or malformed input safely', () => {
  const empty1 = sanitizeLiveModels(null);
  assert.deepEqual(empty1.activeModels, []);
  assert.ok(empty1.receivedAt);

  const empty2 = sanitizeLiveModels({});
  assert.deepEqual(empty2.activeModels, []);

  const empty3 = sanitizeLiveModels({ activeRequests: 'not-an-array' });
  assert.deepEqual(empty3.activeModels, []);
});

test('parseSseChunks parses single and fragmented SSE messages and ignores comments', () => {
  const events = [];
  const parse = parseSseChunks((ev) => events.push(ev));

  parse(': ping\n\ndata: {"activeRe');
  assert.equal(events.length, 0);

  parse('quests":[{"model":"m1","provider":"p1","account":"a1","count":1}]}\n\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].data.includes('m1'), true);

  parse('data: {"activeRequests":[]}\n\n: ping\n\ndata: {"activeRequests":[{"model":"m2","provider":"p2","account":"a2","count":4}]}\n\n');
  assert.equal(events.length, 3);
});

test('parseSseChunks preserves data when comment precedes data in same frame', () => {
  const events = [];
  const parse = parseSseChunks((ev) => events.push(ev));

  parse(': keepalive comment\ndata: {"activeRequests":[{"model":"m1","provider":"p1","account":"a1","count":1}]}\n\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].data.includes('m1'), true);
});

test('parseSseChunks enforces 256KiB buffer limit and resets on overflow', () => {
  const events = [];
  const parse = parseSseChunks((ev) => events.push(ev));

  const hugeChunk = 'x'.repeat(260 * 1024);
  parse(hugeChunk);

  parse('data: {"activeRequests":[{"model":"recovered","provider":"p","account":"a","count":1}]}\n\n');
  assert.equal(events.length, 1);
  assert.equal(events[0].data.includes('recovered'), true);
});

test('GET /api/live-models rejects unauthenticated requests with 401', async () => {
  const req = new Request('http://localhost/api/live-models', {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
  });

  const res = await GET(req);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, 'SESSION_REQUIRED');
});

test('GET /api/live-models rejects invalid query parameters with 400', async () => {
  const { token } = defaultSessionStore.createSession('mock-upstream-token');
  defaultUpstreamClient.revalidateAuth = async () => true;

  try {
    const req = new Request('http://localhost/api/live-models?foo=bar', {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await GET(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error.code, 'INVALID_REQUEST');
  } finally {
    defaultSessionStore.destroySession(token);
  }
});

test('GET /api/live-models connects upstream SSE, sets correct headers, and streams sanitized events', async () => {
  const { token } = defaultSessionStore.createSession('mock-upstream-token');
  defaultUpstreamClient.revalidateAuth = async () => true;

  const originalRequest = defaultUpstreamClient.request;
  try {
    // Mock upstream SSE stream
    defaultUpstreamClient.request = async (path, init, upstreamToken) => {
      assert.equal(path, '/api/usage/stream');
      assert.equal(upstreamToken, 'mock-upstream-token');

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                totalCost: 99.9,
                recentRequests: [{ secret: true }],
                activeRequests: [
                  { model: 'claude-3-5-sonnet', provider: 'anthropic', account: 'dev@test.com', count: 1 },
                ],
              })}\n\n`
            )
          );
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    };

    const req = new Request('http://localhost/api/live-models', {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await GET(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'text/event-stream');
    assert.equal(res.headers.get('Cache-Control'), 'no-store, no-transform');
    assert.equal(res.headers.get('X-Accel-Buffering'), 'no');

    // Read first event from stream
    const reader = res.body.getReader();
    const { value } = await reader.read();
    await reader.cancel();

    const text = new TextDecoder().decode(value);
    assert.ok(text.startsWith('data: '));
    assert.ok(text.includes('claude-3-5-sonnet'));
    assert.ok(text.includes('de***@test.com'));
    assert.ok(!text.includes('totalCost'));
    assert.ok(!text.includes('recentRequests'));
    assert.ok(!text.includes('dev@test.com'));
  } finally {
    defaultUpstreamClient.request = originalRequest;
    defaultSessionStore.destroySession(token);
  }
});

test('GET /api/live-models handles upstream connection error gracefully', async () => {
  const { token } = defaultSessionStore.createSession('mock-upstream-token');
  defaultUpstreamClient.revalidateAuth = async () => true;

  const originalRequest = defaultUpstreamClient.request;
  try {
    defaultUpstreamClient.request = async () => {
      const err = new Error('Upstream unavailable');
      err.status = 503;
      err.code = 'UPSTREAM_UNAVAILABLE';
      throw err;
    };

    const req = new Request('http://localhost/api/live-models', {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await GET(req);
    // Either returns 503 upfront or status: error event
    if (res.status === 200) {
      const reader = res.body.getReader();
      const { value } = await reader.read();
      await reader.cancel();
      const text = new TextDecoder().decode(value);
      assert.ok(text.includes('"status":"error"'));
    } else {
      assert.equal(res.status, 503);
      const data = await res.json();
      assert.equal(data.error.code, 'UPSTREAM_UNAVAILABLE');
    }
  } finally {
    defaultUpstreamClient.request = originalRequest;
    defaultSessionStore.destroySession(token);
  }
});

test('GET /api/live-models terminates and emits unauthenticated when session is revoked midstream', async () => {
  const { token } = defaultSessionStore.createSession('mock-upstream-token');
  defaultUpstreamClient.revalidateAuth = async () => true;

  const originalRequest = defaultUpstreamClient.request;
  try {
    let upstreamController;
    defaultUpstreamClient.request = async () => {
      const stream = new ReadableStream({
        start(controller) {
          upstreamController = controller;
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    const req = new Request('http://localhost/api/live-models', {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const res = await GET(req);
    assert.equal(res.status, 200);

    const reader = res.body.getReader();

    defaultSessionStore.destroySession(token);

    const encoder = new TextEncoder();
    upstreamController.enqueue(
      encoder.encode('data: {"activeRequests":[{"model":"m","provider":"p","account":"a","count":1}]}\n\n')
    );

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    assert.ok(text.includes('"status":"unauthenticated"'));

    const next = await reader.read();
    assert.equal(next.done, true);
  } finally {
    defaultUpstreamClient.request = originalRequest;
    defaultSessionStore.destroySession(token);
  }
});
