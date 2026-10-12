export const DASHBOARD_LAYOUT_STORAGE_KEY = 'worldgpz:dashboard-layout:v1';

export const PANEL_GROUPS = [
  { id: 'left', label: 'Intelligence rail' },
  { id: 'right', label: 'Live reports' },
  { id: 'analytics', label: 'Data and analysis strip' },
];

export const DASHBOARD_PANELS = [
  { id: 'briefing', label: 'World brief', group: 'left' },
  { id: 'countryRisk', label: 'Country risk', group: 'left' },
  { id: 'chokepoints', label: 'Strategic chokepoints', group: 'left' },
  { id: 'markets', label: 'Market pulse', group: 'left' },
  { id: 'predictions', label: 'Prediction markets', group: 'left' },
  { id: 'watchlist', label: 'Local watchlist', group: 'left' },
  { id: 'events', label: 'Event stream', group: 'right' },
  { id: 'news', label: 'Latest reporting', group: 'right' },
  { id: 'velocity', label: 'Signal velocity', group: 'analytics' },
  { id: 'health', label: 'Provider health', group: 'analytics' },
  { id: 'energy', label: 'Energy', group: 'analytics' },
  { id: 'economics', label: 'Economics', group: 'analytics' },
  { id: 'outbreaks', label: 'Outbreak monitor', group: 'analytics' },
  { id: 'launches', label: 'Launch schedule', group: 'analytics' },
  { id: 'weather', label: 'Weather', group: 'analytics' },
  { id: 'webcams', label: 'Webcams', group: 'analytics' },
];

const PANEL_IDS = new Set(DASHBOARD_PANELS.map((panel) => panel.id));
const PANEL_BY_ID = new Map(DASHBOARD_PANELS.map((panel) => [panel.id, panel]));
const GROUP_IDS = new Set(PANEL_GROUPS.map((group) => group.id));
const ALL_PANEL_IDS = DASHBOARD_PANELS.map((panel) => panel.id);

export const WORKSPACE_PRESETS = [
  { id: 'world', label: 'World', description: 'All available panels', visible: ALL_PANEL_IDS },
  { id: 'finance', label: 'Finance', description: 'Markets, forecasts, energy and economic context', visible: ['briefing', 'markets', 'predictions', 'news', 'events', 'velocity', 'health', 'energy', 'economics'] },
  { id: 'crisis', label: 'Crisis', description: 'Events, risk, humanitarian and weather signals', visible: ['briefing', 'countryRisk', 'chokepoints', 'watchlist', 'events', 'news', 'velocity', 'health', 'energy', 'outbreaks', 'weather'] },
  { id: 'infrastructure', label: 'Infrastructure', description: 'Chokepoints, markets, energy and source health', visible: ['briefing', 'chokepoints', 'markets', 'watchlist', 'events', 'news', 'velocity', 'health', 'energy', 'economics'] },
  { id: 'space', label: 'Space & environment', description: 'Launches, weather, outbreaks and event context', visible: ['briefing', 'countryRisk', 'events', 'news', 'health', 'outbreaks', 'launches', 'weather', 'webcams'] },
];

export function createDefaultDashboardLayout() {
  return {
    preset: 'world',
    visible: [...ALL_PANEL_IDS],
    order: Object.fromEntries(PANEL_GROUPS.map(({ id }) => [id, DASHBOARD_PANELS.filter((panel) => panel.group === id).map((panel) => panel.id)])),
    sizes: {},
  };
}

function normalizeOrder(value) {
  const order = {};
  for (const { id: groupId } of PANEL_GROUPS) {
    const validInGroup = new Set(DASHBOARD_PANELS.filter((panel) => panel.group === groupId).map((panel) => panel.id));
    const candidate = Array.isArray(value?.[groupId]) ? value[groupId] : [];
    order[groupId] = [...new Set(candidate.filter((id) => typeof id === 'string' && validInGroup.has(id)))];
    for (const id of validInGroup) if (!order[groupId].includes(id)) order[groupId].push(id);
  }
  return order;
}

function normalizeSizes(value) {
  const sizes = {};
  if (!value || typeof value !== 'object') return sizes;
  for (const [panelId, rawHeight] of Object.entries(value)) {
    const panel = PANEL_BY_ID.get(panelId);
    const height = Math.round(Number(rawHeight));
    if (panel && panel.group !== 'analytics' && Number.isFinite(height) && height >= 140 && height <= 1200) sizes[panelId] = height;
  }
  return sizes;
}

export function normalizeDashboardLayout(value) {
  const defaults = createDefaultDashboardLayout();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const visible = Array.isArray(value.visible)
    ? [...new Set(value.visible.filter((id) => typeof id === 'string' && PANEL_IDS.has(id)))]
    : defaults.visible;
  return {
    preset: WORKSPACE_PRESETS.some((preset) => preset.id === value?.preset) ? value.preset : 'custom',
    visible,
    order: normalizeOrder(value?.order),
    sizes: normalizeSizes(value?.sizes),
  };
}

function browserStorage() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function loadDashboardLayout(storage = browserStorage()) {
  try {
    return normalizeDashboardLayout(JSON.parse(storage?.getItem(DASHBOARD_LAYOUT_STORAGE_KEY) || 'null'));
  } catch {
    return createDefaultDashboardLayout();
  }
}

export function saveDashboardLayout(layout, storage = browserStorage()) {
  try {
    storage?.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeDashboardLayout(layout)));
    return true;
  } catch {
    return false;
  }
}

export function applyWorkspacePreset(layout, presetId) {
  const preset = WORKSPACE_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return normalizeDashboardLayout(layout);
  return { ...normalizeDashboardLayout(layout), preset: preset.id, visible: [...preset.visible] };
}

export function toggleDashboardPanel(layout, panelId) {
  if (!PANEL_IDS.has(panelId)) return normalizeDashboardLayout(layout);
  const current = normalizeDashboardLayout(layout);
  const visible = current.visible.includes(panelId)
    ? current.visible.filter((id) => id !== panelId)
    : [...current.visible, panelId];
  return { ...current, preset: 'custom', visible };
}

export function moveDashboardPanel(layout, panelId, direction) {
  const current = normalizeDashboardLayout(layout);
  const panel = DASHBOARD_PANELS.find((entry) => entry.id === panelId);
  if (!panel || !GROUP_IDS.has(panel.group) || ![-1, 1].includes(direction)) return current;
  const order = [...current.order[panel.group]];
  const index = order.indexOf(panelId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return current;
  [order[index], order[target]] = [order[target], order[index]];
  return { ...current, preset: 'custom', order: { ...current.order, [panel.group]: order } };
}

export function reorderDashboardPanel(layout, sourceId, targetId) {
  const current = normalizeDashboardLayout(layout);
  const source = DASHBOARD_PANELS.find((entry) => entry.id === sourceId);
  const target = DASHBOARD_PANELS.find((entry) => entry.id === targetId);
  if (!source || !target || source.group !== target.group || sourceId === targetId) return current;
  const order = [...current.order[source.group]];
  const from = order.indexOf(sourceId);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0) return current;
  order.splice(from, 1);
  order.splice(to, 0, sourceId);
  return { ...current, preset: 'custom', order: { ...current.order, [source.group]: order } };
}

export function setDashboardPanelSize(layout, panelId, height) {
  const panel = PANEL_BY_ID.get(panelId);
  const size = Math.round(Number(height));
  if (!panel || panel.group === 'analytics' || !Number.isFinite(size)) return normalizeDashboardLayout(layout);
  const current = normalizeDashboardLayout(layout);
  return { ...current, preset: 'custom', sizes: { ...current.sizes, [panelId]: Math.max(140, Math.min(1200, size)) } };
}

export function resizeDashboardPanel(layout, panelId, delta) {
  const current = normalizeDashboardLayout(layout);
  const panel = PANEL_BY_ID.get(panelId);
  if (!panel || panel.group === 'analytics' || !Number.isFinite(Number(delta))) return current;
  return setDashboardPanelSize(current, panelId, (current.sizes[panelId] ?? 360) + Number(delta));
}

export function resetDashboardPanelSize(layout, panelId) {
  const current = normalizeDashboardLayout(layout);
  if (!PANEL_BY_ID.has(panelId)) return current;
  const sizes = { ...current.sizes };
  delete sizes[panelId];
  return { ...current, preset: 'custom', sizes };
}
