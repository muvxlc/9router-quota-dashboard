import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as getHealth } from '../app/api/health/route.js';

test('GET /api/health returns 200 ok with no-store and no upstream/auth dependency', async () => {
  const req = new Request('http://127.0.0.1:20130/api/health');
  const res = await getHealth(req);

  assert.equal(res.status, 200);

  const contentType = res.headers.get('content-type') || '';
  assert.ok(contentType.includes('application/json'), `Expected json content-type, got: ${contentType}`);

  const cacheControl = res.headers.get('cache-control') || '';
  assert.ok(cacheControl.includes('no-store'), `Expected no-store cache-control, got: ${cacheControl}`);

  const body = await res.json();
  assert.deepEqual(body, { status: 'ok' });
});
