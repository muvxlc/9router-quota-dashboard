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

test('LiveModelsStrip shows every active model and keeps recent history in modal', () => {
  const stripSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsStrip.js'), 'utf8');
  assert.match(stripSrc, /activeModels\.map\(/);
  assert.doesNotMatch(stripSrc, /activeModels\.slice\(/);
  assert.doesNotMatch(stripSrc, /visibleRecent|Recently completed/);
  assert.match(stripSrc, /recentRequests=\{recentRequests\}/);
});

test('LiveModelsStrip shortens labels without changing source identifiers', () => {
  const stripSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsStrip.js'), 'utf8');
  assert.match(stripSrc, /antigravity.*agy/);
  assert.match(stripSrc, /gemini-3\.8-flash-high.*Gemini 3\.8 Flash/);
  assert.match(stripSrc, /title=\{`\$\{item\.model\}/);
});

test('Live Models strip bounds overflowing chips inside its container', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'app/styles/live-strip.css'), 'utf8');
  assert.match(css, /\.live-activity-left\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.live-model-chips\s*\{[^}]*overflow-x:\s*auto/s);
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

test('Header.js and page.js support full-screen Live Models navigation tab', () => {
  const headerSrc = fs.readFileSync(path.join(projectRoot, 'app/components/Header.js'), 'utf8');
  assert.match(headerSrc, /activeTab\s*===\s*'live'/);
  assert.match(headerSrc, /Live Models/);

  const pageSrc = fs.readFileSync(path.join(projectRoot, 'app/page.js'), 'utf8');
  assert.match(pageSrc, /import LiveModelsView from '\.\/components\/LiveModelsView\.js'/);
  assert.match(pageSrc, /<LiveModelsView/);
});

test('LiveModelsView.js renders full telemetry dashboard with active and recent sections', () => {
  const viewSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsView.js'), 'utf8');

  assert.ok(viewSrc.includes('In-Flight Requests'));
  assert.ok(viewSrc.includes('Active Models'));
  assert.ok(viewSrc.includes('Recent Completions'));
  assert.ok(viewSrc.includes('Active Models In Flight'));
  assert.ok(viewSrc.includes('Recently Completed Stream'));
  assert.ok(viewSrc.includes('FILTER MODEL OR ACCOUNT'));
  assert.ok(viewSrc.includes('createLiveModelsSubscription'));
  assert.ok(viewSrc.includes('live-models-container'));
  assert.ok(viewSrc.includes('live-models-empty-state'));
  assert.ok(viewSrc.includes('live-models-main-grid'));
});

test('Live models layout classes support desktop fullscreen stretch and responsive mobile', () => {
  const gridCss = fs.readFileSync(path.join(projectRoot, 'app/styles/grid.css'), 'utf8');
  assert.match(gridCss, /\.live-models-container/);
  assert.match(gridCss, /\.live-models-main-grid/);
  assert.match(gridCss, /\.live-models-empty-state/);

  const tabletCss = fs.readFileSync(path.join(projectRoot, 'app/styles/responsive-tablet.css'), 'utf8');
  assert.match(tabletCss, /\.live-models-container\s*\{[^}]*height:\s*100%/s);

  const mobileCss = fs.readFileSync(path.join(projectRoot, 'app/styles/responsive-mobile.css'), 'utf8');
  assert.match(mobileCss, /\.live-models-container\s*\{[^}]*height:\s*auto/s);
});


