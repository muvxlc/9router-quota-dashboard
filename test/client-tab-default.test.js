import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(projectRoot, rel), 'utf8');

function assertTabDefault(pageSrc, headerSrc) {
  assert.ok(
    pageSrc.includes("useState('live')"),
    "app/page.js must initialize activeTab with useState('live')"
  );
  assert.ok(
    !pageSrc.includes("useState('quotas')"),
    "app/page.js must not default activeTab to 'quotas'"
  );
  const liveIndex = headerSrc.indexOf("activeTab === 'live'");
  const quotasIndex = headerSrc.indexOf("activeTab === 'quotas'");
  assert.ok(liveIndex !== -1, "Header.js must contain activeTab === 'live'");
  assert.ok(quotasIndex !== -1, "Header.js must contain activeTab === 'quotas'");
  assert.ok(
    liveIndex < quotasIndex,
    "Live Models tab must render before Quotas in Header.js"
  );
}

test('dashboard defaults to the live tab and renders it first', () => {
  assertTabDefault(read('app/page.js'), read('app/components/Header.js'));
});
