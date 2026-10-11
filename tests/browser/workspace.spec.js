import { test, expect } from '@playwright/test';

// Explicit TEST FIXTURE responses test browser behavior, not upstream availability.
test.beforeEach(async ({ page }) => {
  const now = new Date().toISOString();
  const event = { id: 'fixture-usgs-1', title: 'TEST FIXTURE: observed earthquake', type: 'seismic', severity: 'high', source: 'USGS', url: 'https://earthquake.usgs.gov/', latitude: 5.6, longitude: -0.2, time: Date.now(), publishedAt: now, provenance: 'observed' };
  const citation = { id: event.id, title: event.title, url: event.url, source: event.source };
  const summary = { total: 1, high: 1, critical: 0, sourceCount: 1, hotspotCount: 1, threadCount: 1 };
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const payloads = {
      '/api/events': { events: [event] },
      '/api/providers/health': { providers: [{ name: 'usgs', displayName: 'USGS', status: 'online', configured: true, lastSuccess: now, dataPoints: 1 }] },
      '/api/news': { articles: [{ title: 'TEST FIXTURE: official observation report', source: 'USGS', publishedAt: now, url: event.url }] },
      '/api/intel/briefing': { content: 'TEST FIXTURE local digest [S1]', model: 'local headline digest', fallback: true, method: 'deterministic headline digest', generatedAt: now, citations: [{ ...citation, id: 'S1' }], limitations: ['TEST FIXTURE; not a live briefing.'] },
      '/api/intel/mission': { generatedAt: now, windowHours: 24, summary, priorities: [event], coverage: [{ source: 'USGS', count: 1 }], limitations: ['TEST FIXTURE only.'] },
      '/api/intel/watchroom': { generatedAt: now, windowHours: 24, summary, hotspots: [{ id: 'fixture-cell', label: 'TEST FIXTURE observation cluster', latitude: 5.6, longitude: -0.2, count: 1, sourceCount: 1, severity: 'high', updatedAt: now, eventIds: [event.id] }], timeline: [{ time: now, count: 1, highCount: 1 }], threads: [{ id: 'fixture-thread', title: event.title, summary: 'TEST FIXTURE description', severity: 'high', signals: [event], citations: [citation], method: 'Descriptive geographic grouping' }], coverage: [{ source: 'USGS', count: 1 }], limitations: ['TEST FIXTURE only.'] },
      '/api/intel/ask': { generatedAt: now, question: 'What is happening?', answer: 'TEST FIXTURE analyst response supported by supplied observations.', method: 'deterministic source retrieval', windowHours: 24, matchedCount: 1, citations: [citation], signals: [event], limitations: ['TEST FIXTURE only; no model call.'] },
      '/api/auth/me': { error: 'Not signed in.' },
      '/api/config': { authConfigured: false },
      '/api/media/webcams': { webcams: [] },
    };
    if (pathname === '/api/stream') return route.fulfill({ contentType: 'text/event-stream', body: 'event: connected\ndata: {}\n\n' });
    return route.fulfill({ status: pathname === '/api/auth/me' ? 401 : 200, contentType: 'application/json', body: JSON.stringify(payloads[pathname] ?? []) });
  });
});

test('command palette restores focus and does not throw', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const trigger = page.locator('.command-trigger');
  await trigger.click();
  await expect(page.locator('dialog.palette-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.palette-dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(errors).toEqual([]);
});

test('observed signal opens a source dossier', async ({ page }) => {
  await page.goto('/');
  await page.locator('.event-row').first().click();
  const drawer = page.locator('dialog.event-detail-dialog');
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('TEST FIXTURE: observed earthquake');
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeVisible();
});

test('named monitoring missions persist on this device', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('workspace-watchroom').click();
  await page.getByLabel('Monitoring mission name').fill('TEST FIXTURE seismic mission');
  await page.getByRole('button', { name: /Save current lens/ }).click();
  await expect(page.locator('.saved-mission')).toContainText('TEST FIXTURE seismic mission');
  await page.reload();
  await page.getByTestId('workspace-watchroom').click();
  await expect(page.locator('.saved-mission')).toContainText('TEST FIXTURE seismic mission');
  await page.getByRole('button', { name: /Local inbox/ }).click();
  await expect(page.locator('.local-inbox')).toContainText('TEST FIXTURE: observed earthquake');
});

test('evidence analyst returns a labelled answer with citations', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('workspace-analyst').click();
  await page.getByLabel('Ask the evidence analyst').fill('What is happening?');
  await page.getByRole('button', { name: /Analyze evidence/ }).click();
  await expect(page.locator('.answer-copy')).toContainText('TEST FIXTURE analyst response');
  await expect(page.locator('.citation-card').first()).toContainText('TEST FIXTURE: observed earthquake');
});

test('watchroom surface view and lens fit mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByTestId('workspace-watchroom').click();
  await page.getByRole('button', { name: /Surface/ }).click();
  await page.getByLabel('Watchroom category').selectOption('seismic');
  await expect(page.locator('.watchroom-workspace')).toContainText('TEST FIXTURE: observed earthquake');
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
});

for (const width of [320, 390, 768, 1024, 1440]) test(`monitor fits ${width}px viewport`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await expect(page.locator('.command-trigger')).toBeVisible();
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
});
