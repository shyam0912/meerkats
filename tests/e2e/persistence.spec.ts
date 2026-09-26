import { test, expect, type Page } from '@playwright/test';
const surface = (page: Page, content = false) => page.getByRole('region', { name: content ? 'Content annotation surface' : 'Whiteboard drawing surface' });
async function dot(page: Page, content = false) {
  const box = await surface(page, content).boundingBox(); if (!box) throw new Error('Missing drawing surface');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function saved(page: Page) { await expect(page.getByRole('status')).toHaveText('Saved on this device'); }
test('an editable new workspace already has a recoverable empty identity', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Quick Workspace' }).click();
  await expect(surface(page)).toBeVisible();
  const id = await surface(page).getAttribute('data-document-id'); const url = page.url();
  // Intentionally do not wait on the save indicator before this immediate reload.
  await page.reload();
  await expect(surface(page)).toHaveAttribute('data-document-id', id!);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0'); expect(page.url()).toBe(url);
});
test('class and subject context, independent ink and current content selection survive reload', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Start Teaching' }).click();
  await page.getByRole('button', { name: 'STD 1', exact: true }).click();
  await page.getByRole('button', { name: '🔬 Science', exact: true }).click();
  await dot(page); const boardId = await surface(page).getAttribute('data-document-id');
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Circle', exact: true }).click();
  await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await dot(page, true); await saved(page);
  const annotationId = await surface(page, true).getAttribute('data-document-id'); const url = page.url();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'STD 1 · Science' })).toBeVisible();
  await expect(surface(page, true)).toHaveAttribute('data-document-id', annotationId!);
  await expect(surface(page, true)).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Circle', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Whiteboard', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-document-id', boardId!);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1'); expect(page.url()).toBe(url);
});
test('reload during a draft restores only completed gestures', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Quick Workspace' }).click();
  await dot(page); await saved(page);
  const box = await surface(page).boundingBox(); if (!box) throw new Error('Missing surface');
  await page.mouse.move(box.x + 50, box.y + 50); await page.mouse.down(); await page.mouse.move(box.x + 300, box.y + 100);
  await page.reload(); await page.mouse.up();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
});
test('new sessions stay separate and the original URL restores its own board', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Quick Workspace' }).click();
  await dot(page); await saved(page); const first = page.url(); const id = await surface(page).getAttribute('data-document-id');
  await page.getByRole('button', { name: '← Back' }).click(); await page.getByRole('button', { name: 'Quick Workspace' }).click();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0'); expect(page.url()).not.toBe(first);
  await saved(page); await page.goto(first);
  await expect(surface(page)).toHaveAttribute('data-document-id', id!);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
});
test('blocked IndexedDB is visible and never claims a save', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw new Error('Storage denied'); } }); });
  await page.goto('/'); await page.getByRole('button', { name: 'Quick Workspace' }).click(); await dot(page);
  await expect(page.getByRole('status')).toHaveText('Needs attention · Device save failed');
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
});
test('another tab cannot silently overwrite the locally saved session', async ({ page, context }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Quick Workspace' }).click(); await dot(page); await saved(page);
  const second = await context.newPage(); await second.goto(page.url()); await saved(second);
  await dot(page);
  await expect(page.getByRole('status')).toHaveText('Needs attention · Session open in another tab');
  await second.reload(); await expect(surface(second)).toHaveAttribute('data-ink-count', '1');
  await second.close();
});
test('browser history reopens the requested saved session rather than relabelling the current board', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Quick Workspace' }).click();
  await dot(page); await saved(page); const first = page.url();
  const id = await surface(page).getAttribute('data-document-id');
  await page.getByRole('button', { name: '← Back' }).click(); await page.getByRole('button', { name: 'Quick Workspace' }).click();
  await saved(page); await page.goBack(); await page.goBack();
  await expect(surface(page)).toHaveAttribute('data-document-id', id!);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1'); expect(page.url()).toBe(first);
});
