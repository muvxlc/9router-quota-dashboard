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

test('LiveModelsView wires the three summary cards and a 60s attempt-based refresh', () => {
  const viewSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsView.js'), 'utf8');

  assert.match(viewSrc, /import \{[^}]*fetchLiveModelsSummary[^}]*\} from '\.\.\/\.\.\/lib\/client\/api\.js'/s);
  assert.match(viewSrc, /import \{[^}]*deriveSummaryCards[^}]*\} from '\.\.\/\.\.\/lib\/client\/maxplusSummary\.js'/s);

  const refreshCall = viewSrc.match(/useAutoRefresh\(\{[\s\S]*?\}\);/);
  assert.ok(refreshCall, 'LiveModelsView must call useAutoRefresh');
  assert.match(refreshCall[0], /intervalSec:\s*60/);
  assert.match(refreshCall[0], /lastSyncAt:\s*lastAttemptAt/);
  assert.match(refreshCall[0], /enabled:\s*true/);
  assert.doesNotMatch(refreshCall[0], /lastSyncAt:\s*summary\.usageReceivedAt/);

  assert.match(viewSrc, /fetchLiveModelsSummary\(fetch, controller\.signal, summaryPeriod\)/);
  assert.match(viewSrc, /const \[summaryPeriod, setSummaryPeriod\] = useState\(SUMMARY_PERIODS\[0\]\.value\)/);
  for (const period of ['1d', '7d', '30d', 'all']) {
    assert.ok(viewSrc.includes(`value: '${period}'`), `period option ${period} must exist`);
  }
  assert.ok(viewSrc.includes('setSummaryPeriod(p.value)'), 'period buttons must switch the period');

  const gridStart = viewSrc.indexOf('live-models-kpi-grid');
  const gridEnd = viewSrc.indexOf('<QuotaCards');
  assert.ok(gridStart > 0 && gridEnd > gridStart, 'KPI grid must precede the quota cards');
  const grid = viewSrc.slice(gridStart, gridEnd);
  assert.equal((grid.match(/className="pp-card"/g) || []).length, 7, 'KPI grid must render seven cards');
  for (const card of ['periodCard', 'costCard', 'creditCard']) {
    assert.ok(grid.includes(`{${card}.hint}`), `${card} hint must render as subtext`);
    assert.ok(grid.includes(`{${card}.value}`), `${card} value must render`);
  }

  assert.match(viewSrc, /finally\s*\{[\s\S]*?setLastAttemptAt\(new Date\(\)\.toISOString\(\)\)[\s\S]*?\}/);
  assert.match(viewSrc, /deriveSummaryCards\(summary, \{[\s\S]*?failedKeys[\s\S]*?\}\)/);
});

test('Recently completed rows are a single line with truncated fields', () => {
  const viewSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsView.js'), 'utf8');

  const start = viewSrc.indexOf('filteredRecent.map(');
  const end = viewSrc.indexOf('live-models-footer');
  assert.ok(start > 0 && end > start, 'completed-row block must exist');
  const block = viewSrc.slice(start, end);

  assert.match(block, /flexWrap:\s*'nowrap'/, 'completed rows must not wrap');
  assert.match(block, /textOverflow:\s*'ellipsis'/, 'completed row fields must ellipsize');
  assert.doesNotMatch(block, /marginTop:\s*2/, 'completed rows must not stack a second line');
  assert.doesNotMatch(block, /flexDirection:\s*'column'/, 'completed rows must stay one flex line');
  assert.ok(!viewSrc.includes('ponytail: fixed two-line row'), 'two-line row marker must be gone');
  assert.match(block, /title=\{item\.model\}/, 'model keeps its full text in the title');
});

test('Provider display text uses providerLabel while identity keeps the raw provider', () => {
  const viewSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsView.js'), 'utf8');
  const stripSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsStrip.js'), 'utf8');
  const modalSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsModal.js'), 'utf8');

  assert.match(viewSrc, /item\.providerLabel \|\| item\.provider/);
  assert.match(stripSrc, /item\.providerLabel \|\|/);
  assert.match(modalSrc, /item\.providerLabel \|\| item\.provider/);

  // Dedup key, React keys and filters keep the raw id.
  assert.match(viewSrc, /const key = `\$\{item\.timestamp \|\| ''\}-\$\{item\.model\}-\$\{item\.provider\}-/);
  assert.match(viewSrc, /key={`active-view-\$\{item\.model\}-\$\{item\.provider\}-/);
  assert.match(viewSrc, /key={`recent-view-\$\{item\.model\}-\$\{item\.provider\}-/);
  assert.match(viewSrc, /item\.provider \|\| ''\)\.toLowerCase\(\) !== providerFilter/);
  assert.doesNotMatch(viewSrc, /providerLabel[^\n]*providerFilter/);
});

test('Live models page renders compact codex quota cards from page state', () => {
  const pageSrc = fs.readFileSync(path.join(projectRoot, 'app/page.js'), 'utf8');
  assert.match(pageSrc, /const codexAccounts = useMemo\(/);
  assert.match(pageSrc, /provider \|\| ''\)\.toLowerCase\(\) === 'codex'/);
  assert.match(pageSrc, /<LiveModelsView[^>]*accounts=\{codexAccounts\}/s);

  const viewSrc = fs.readFileSync(path.join(projectRoot, 'app/components/LiveModelsView.js'), 'utf8');
  assert.match(viewSrc, /import QuotaCards from '\.\/QuotaCards\.js'/);
  assert.match(viewSrc, /<QuotaCards accounts=\{accounts\} onSelectAccount=\{onSelectAccount\} \/>/);

  const cardsSrc = fs.readFileSync(path.join(projectRoot, 'app/components/QuotaCards.js'), 'utf8');
  assert.ok(cardsSrc.includes('QuotaWindowCell'));
  assert.ok(cardsSrc.includes('calculateDepletionVelocity'));
  assert.match(cardsSrc, /onSelectAccount\(acc\)/);
});


