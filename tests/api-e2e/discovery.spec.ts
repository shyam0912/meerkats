import { test, expect } from '@playwright/test';
import { chemistryCatalog, CHEMISTRY } from '../../contracts/chemistry';

for (const [parent, remove, message] of [
  [CHEMISTRY.class, 'subject', 'No subjects available yet'],
  [CHEMISTRY.subject, 'chapter', 'No chapters available yet'],
  [CHEMISTRY.chapter, 'topic', 'No concepts available yet'],
  [CHEMISTRY.topic, 'lesson', 'Lesson not available yet'],
] as const) {
  test('catalog truthfully displays missing ' + remove, async ({ page }) => {
    const data = structuredClone(chemistryCatalog);
    const ranks = ['curriculum', 'class', 'subject', 'chapter', 'topic', 'lesson'];
    data.nodes = data.nodes.filter(n => ranks.indexOf(n.kind) < ranks.indexOf(remove)); data.lessons = [];
    await page.route('**/api/v1/catalog', route => route.fulfill({ json: data }));
    await page.goto('/catalog?parent=' + parent);
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start teaching' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '← Back' })).toBeEnabled();
  });
}
test('loading, catalog failure, retry, and unavailable concept remain truthful', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let fail = true;
  await page.route('**/api/v1/catalog', async route => {
    if (fail) { await gate; await route.fulfill({ status: 503, json: {} }); }
    else { const data = structuredClone(chemistryCatalog); data.lessons = []; await route.fulfill({ json: data }); }
  });
  await page.goto('/catalog?parent=' + CHEMISTRY.chapter);
  await expect(page.getByRole('status')).toHaveText('Loading classroom…');
  release(); await expect(page.getByRole('alert')).toContainText('could not be loaded');
  fail = false; await page.getByRole('button', { name: 'Retry catalog' }).click();
  await expect(page.getByText('Planned · No lesson available yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'One branch. Two structures.' }).click();
  await expect(page.getByText('Lesson not available yet', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start teaching' })).toHaveCount(0);
});
test('failed lesson load allows retry without starting a session', async ({ page }) => {
  let fail = true; let creates = 0;
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/sessions')) creates++; });
  await page.route('**/api/v1/lesson-versions/*', route => fail ? route.fulfill({ status: 503, json: {} }) : route.continue());
  await page.goto('/catalog?parent=' + CHEMISTRY.topic);
  await expect(page.getByRole('alert')).toContainText('No teaching session was started');
  expect(creates).toBe(0); expect(page.url()).toContain('/catalog?parent=' + CHEMISTRY.topic);
  fail = false; await page.getByRole('button', { name: 'Retry lesson' }).click();
  await page.getByRole('button', { name: 'Start teaching' }).click();
  await expect(page.getByRole('button', { name: 'Activity outline' })).toContainText('1 of 7');
});
test('leaving while a lesson loads never launches a late session', async ({ page }) => {
  let release!: () => void; let finished!: () => void; let creates = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const completed = new Promise<void>(resolve => { finished = resolve; });
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/sessions')) creates++; });
  await page.route('**/api/v1/lesson-versions/*', async route => { await gate; await route.continue(); finished(); });
  await page.goto('/catalog?parent=' + CHEMISTRY.topic);
  await expect(page.getByRole('status')).toHaveText('Loading lesson preview…');
  await expect(page.getByRole('button', { name: 'Start teaching' })).toBeDisabled();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const response = page.waitForResponse('**/api/v1/lesson-versions/*'); release(); await completed; await response;
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where shall we begin?');
  expect(creates).toBe(0); await expect(page).toHaveURL('/');
});

test('Ready is shown only for a reviewed version supplied by the catalog API', async ({ page }) => {
  // Test-only response; published database content is never mutated.
  const { chemistryVersion } = await import('../../contracts/chemistry');
  const reviewed = structuredClone(chemistryVersion); reviewed.provenance.reviewStatus = 'reviewed';
  await page.route('**/api/v1/lesson-versions/*', route => route.fulfill({ json: reviewed }));
  await page.goto('/catalog?parent=' + CHEMISTRY.topic);
  await expect(page.locator('.discovery-preview .discovery-badge')).toHaveText('Ready');
  await expect(page.getByText('Reviewed interactive lesson')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start teaching' })).toBeEnabled();
});
test('mismatched version identity cannot be previewed or launched', async ({ page }) => {
  const { chemistryVersion } = await import('../../contracts/chemistry');
  const mismatch = structuredClone(chemistryVersion);
  mismatch.id = '60000000-0000-4000-8000-000000000007';
  await page.route('**/api/v1/lesson-versions/*', route => route.fulfill({ json: mismatch }));
  await page.goto('/catalog?parent=' + CHEMISTRY.topic);
  await expect(page.getByRole('alert')).toContainText('No teaching session was started');
  await expect(page.getByRole('button', { name: 'Start teaching' })).toHaveCount(0);
  await expect(page.getByText('Ready', { exact: true })).toHaveCount(0);
});
