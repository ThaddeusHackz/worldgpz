import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWorkspacePreset, createDefaultDashboardLayout, loadDashboardLayout, moveDashboardPanel,
  normalizeDashboardLayout, reorderDashboardPanel, resizeDashboardPanel, resetDashboardPanelSize,
  saveDashboardLayout, setDashboardPanelSize, toggleDashboardPanel,
  DASHBOARD_LAYOUT_STORAGE_KEY, DASHBOARD_PANELS,
} from '../src/lib/dashboardLayout.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('dashboard layout defaults to all registered panels and sanitizes invalid persisted data', () => {
  const defaults = createDefaultDashboardLayout();
  assert.equal(defaults.visible.length, DASHBOARD_PANELS.length);
  const sanitized = normalizeDashboardLayout({
    preset: 'unknown', visible: ['news', 'news', 'bogus'],
    order: { left: ['markets', 'unknown', 'markets'], right: ['events'], analytics: [] },
  });
  assert.deepEqual(sanitized.visible, ['news']);
  assert.deepEqual(sanitized.order.left.slice(0, 2), ['markets', 'briefing']);
  assert.equal(sanitized.preset, 'custom');
});

test('dashboard layout persists locally and recovers cleanly from corrupt storage', () => {
  const storage = memoryStorage();
  const layout = toggleDashboardPanel(createDefaultDashboardLayout(), 'webcams');
  assert.equal(saveDashboardLayout(layout, storage), true);
  assert.deepEqual(loadDashboardLayout(storage), layout);
  const corrupt = memoryStorage({ [DASHBOARD_LAYOUT_STORAGE_KEY]: '{not json' });
  assert.equal(loadDashboardLayout(corrupt).visible.length, DASHBOARD_PANELS.length);
});

test('workspace presets change visible panels without discarding panel order', () => {
  const moved = reorderDashboardPanel(createDefaultDashboardLayout(), 'markets', 'briefing');
  const finance = applyWorkspacePreset(moved, 'finance');
  assert.equal(finance.preset, 'finance');
  assert.ok(finance.visible.includes('markets'));
  assert.ok(!finance.visible.includes('outbreaks'));
  assert.equal(finance.order.left[0], 'markets');
});

test('panel visibility and reordering update only known panels in their own rails', () => {
  const base = createDefaultDashboardLayout();
  const hidden = toggleDashboardPanel(base, 'news');
  assert.ok(!hidden.visible.includes('news'));
  assert.ok(base.visible.includes('news'));
  const moved = reorderDashboardPanel(base, 'news', 'events');
  assert.deepEqual(moved.order.right, ['news', 'events']);
  assert.deepEqual(reorderDashboardPanel(base, 'news', 'markets'), base);
  assert.deepEqual(moveDashboardPanel(base, 'briefing', -1), base);
});

test('panel height preferences are bounded, persistent and resettable', () => {
  const base = createDefaultDashboardLayout();
  const taller = resizeDashboardPanel(base, 'briefing', 80);
  assert.equal(taller.sizes.briefing, 440);
  assert.equal(setDashboardPanelSize(taller, 'news', 5000).sizes.news, 1200);
  assert.deepEqual(resetDashboardPanelSize(taller, 'briefing').sizes, {});
  assert.equal(setDashboardPanelSize(base, 'weather', 440).sizes.weather, undefined);
});
