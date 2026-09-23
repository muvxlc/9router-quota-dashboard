import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolveUpstreamBaseUrl } from '../lib/server/configBaseUrl.js';
import { UPSTREAM_BASE_URL } from '../lib/server/config.js';

test('resolveUpstreamBaseUrl defaults to https://9router.bangkhan.com when unset or empty', () => {
  assert.equal(resolveUpstreamBaseUrl(undefined), 'https://9router.bangkhan.com');
  assert.equal(resolveUpstreamBaseUrl(null), 'https://9router.bangkhan.com');
  assert.equal(resolveUpstreamBaseUrl(''), 'https://9router.bangkhan.com');
  assert.equal(resolveUpstreamBaseUrl('   '), 'https://9router.bangkhan.com');
});

test('resolveUpstreamBaseUrl normalizes valid HTTPS URLs and removes trailing slash', () => {
  assert.equal(resolveUpstreamBaseUrl('https://9router.bangkhan.com'), 'https://9router.bangkhan.com');
  assert.equal(resolveUpstreamBaseUrl('https://9router.bangkhan.com/'), 'https://9router.bangkhan.com');
  assert.equal(resolveUpstreamBaseUrl('https://9router.bangkhan.com///'), 'https://9router.bangkhan.com');
  assert.equal(resolveUpstreamBaseUrl('https://router.internal:8443/'), 'https://router.internal:8443');
});

test('resolveUpstreamBaseUrl permits HTTP for loopback development', () => {
  assert.equal(resolveUpstreamBaseUrl('http://127.0.0.1:20128'), 'http://127.0.0.1:20128');
  assert.equal(resolveUpstreamBaseUrl('http://127.0.0.1:20128/'), 'http://127.0.0.1:20128');
  assert.equal(resolveUpstreamBaseUrl('http://localhost:20128'), 'http://localhost:20128');
  assert.equal(resolveUpstreamBaseUrl('http://localhost:20128/'), 'http://localhost:20128');
  assert.equal(resolveUpstreamBaseUrl('http://[::1]:20128'), 'http://[::1]:20128');
  assert.equal(resolveUpstreamBaseUrl('http://[::1]:20128/'), 'http://[::1]:20128');
});

test('resolveUpstreamBaseUrl rejects public plain HTTP', () => {
  assert.throws(
    () => resolveUpstreamBaseUrl('http://9router.bangkhan.com'),
    (err) => {
      assert.equal(err.message, 'Invalid UPSTREAM_BASE_URL: must be HTTPS or loopback HTTP');
      assert.equal(err.message.includes('bangkhan'), false);
      return true;
    }
  );
  assert.throws(
    () => resolveUpstreamBaseUrl('http://192.168.1.50:20128'),
    (err) => err.message === 'Invalid UPSTREAM_BASE_URL: must be HTTPS or loopback HTTP'
  );
});

test('resolveUpstreamBaseUrl rejects credentials, query params, hash, and non-root paths', () => {
  assert.throws(
    () => resolveUpstreamBaseUrl('https://user:secret123@9router.bangkhan.com'),
    (err) => {
      assert.equal(err.message, 'Invalid UPSTREAM_BASE_URL: credentials not permitted');
      assert.equal(err.message.includes('secret123'), false);
      return true;
    }
  );

  assert.throws(
    () => resolveUpstreamBaseUrl('https://9router.bangkhan.com?token=secret123'),
    (err) => {
      assert.equal(err.message, 'Invalid UPSTREAM_BASE_URL: query parameters not permitted');
      assert.equal(err.message.includes('secret123'), false);
      return true;
    }
  );

  assert.throws(
    () => resolveUpstreamBaseUrl('https://9router.bangkhan.com#anchor'),
    (err) => err.message === 'Invalid UPSTREAM_BASE_URL: hash fragment not permitted'
  );

  assert.throws(
    () => resolveUpstreamBaseUrl('https://9router.bangkhan.com/api/v1'),
    (err) => err.message === 'Invalid UPSTREAM_BASE_URL: base path must be empty'
  );
});

test('resolveUpstreamBaseUrl rejects non-http protocols and malformed strings', () => {
  assert.throws(
    () => resolveUpstreamBaseUrl('javascript:alert(1)'),
    (err) => err.message === 'Invalid UPSTREAM_BASE_URL: protocol must be http or https'
  );
  assert.throws(
    () => resolveUpstreamBaseUrl('ftp://9router.bangkhan.com'),
    (err) => err.message === 'Invalid UPSTREAM_BASE_URL: protocol must be http or https'
  );
  assert.throws(
    () => resolveUpstreamBaseUrl('not-a-valid-url'),
    (err) => err.message === 'Invalid UPSTREAM_BASE_URL: malformed URL'
  );
});

test('UPSTREAM_BASE_URL exported constant defaults to https://9router.bangkhan.com', () => {
  assert.equal(UPSTREAM_BASE_URL, 'https://9router.bangkhan.com');
});

test('UPSTREAM_BASE_URL respects process.env.UPSTREAM_BASE_URL override', () => {
  const result = spawnSync(
    process.execPath,
    ['-e', "import('./lib/server/config.js').then(m => console.log(m.UPSTREAM_BASE_URL))"],
    {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, UPSTREAM_BASE_URL: 'https://router.internal:8443/' },
      encoding: 'utf8',
    }
  );
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'https://router.internal:8443');
});
