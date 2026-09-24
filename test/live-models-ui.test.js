import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('LiveModelsStrip.js defines recentRequests state and passes it to modal', () => {
  const stripSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsStrip.js'), 'utf8');

  assert.match(
    stripSrc,
    /recentRequests:\s*\[\]/,
    'LiveModelsStrip must initialize recentRequests in state'
  );

  assert.match(
    stripSrc,
    /<LiveModelsModal[^>]*recentRequests=\{recentRequests\}/,
    'LiveModelsStrip must pass recentRequests prop to LiveModelsModal'
  );
});

test('LiveModelsStrip.js renders distinct Active and Recently completed labeled sections', () => {
  const stripSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsStrip.js'), 'utf8');

  assert.ok(
    stripSrc.includes('Active'),
    'LiveModelsStrip must render distinct "Active" label for active models'
  );
  assert.ok(
    stripSrc.includes('Recently completed'),
    'LiveModelsStrip must render distinct "Recently completed" label for recent models'
  );
  assert.match(
    stripSrc,
    /recentRequests\.slice\(0,\s*3\)/,
    'LiveModelsStrip must cap displayed recently completed items to maximum 3'
  );
});

test('LiveModelsStrip.js enables modal button when only recent requests exist', () => {
  const stripSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsStrip.js'), 'utf8');

  assert.match(
    stripSrc,
    /\(activeModels\.length\s*>\s*0\s*\|\|\s*recentRequests\.length\s*>\s*0\)/,
    'View all button must be visible when active models or recent requests exist'
  );
});

test('LiveModelsModal.js renders distinct Active and Recently completed sections with safe details', () => {
  const modalSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsModal.js'), 'utf8');

  assert.ok(
    modalSrc.includes('recentRequests'),
    'LiveModelsModal must accept recentRequests prop'
  );
  assert.ok(
    modalSrc.includes('Active'),
    'LiveModelsModal must render distinct Active section heading'
  );
  assert.ok(
    modalSrc.includes('Recently completed'),
    'LiveModelsModal must render distinct Recently completed section heading'
  );
  assert.ok(
    modalSrc.includes('No recently completed requests'),
    'LiveModelsModal must provide empty state for recently completed requests'
  );
});
