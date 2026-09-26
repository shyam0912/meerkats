import { test, expect, type Page } from '@playwright/test';
import { sessionResponseSchema } from '../../contracts';
const surface = (page: Page, content = false) => page.getByRole('region', { name: content ? 'Content annotation surface' : 'Whiteboard drawing surface' });
async function dot(page: Page, content = false) {
  const box = await surface(page, content).boundingBox(); if (!box) throw new Error('Surface missing');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
test('real API acknowledgement, retrieval and rendering in an empty browser storage context', async ({ page, browser }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.getByRole('button', { name: 'Quick Workspace' }).click(); await dot(page);
  await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await dot(page, true);
  await expect(page.getByRole('status')).toHaveText('Ink synced · Context saved on device', { timeout: 20000 });
  const url = page.url(); const id = new URL(url).searchParams.get('session');
  const response = await page.request.get(`/api/v1/sessions/${id}`); expect(response.ok()).toBe(true);
  const remote = sessionResponseSchema.parse(await response.json());
  expect(remote.documents).toHaveLength(2);
  expect(remote.documents.every(d => d.serverRevision > 0 && d.document.objects.length === 1)).toBe(true);
  const freshContext = await browser.newContext(); const recovered = await freshContext.newPage();
  await recovered.goto(url);
  await expect(surface(recovered)).toHaveAttribute('data-ink-count', '1');
  await recovered.getByRole('button', { name: 'Annotate', exact: true }).click();
  await expect(surface(recovered, true)).toHaveAttribute('data-ink-count', '1');
  const alpha = await surface(recovered, true).locator('canvas').evaluate((canvas: HTMLCanvasElement) =>
    canvas.getContext('2d')!.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3]);
  expect(alpha).toBeGreaterThan(0); expect(errors).toEqual([]);
  await freshContext.close();
});
test('API outage preserves local drawing and reload; reconnect acknowledges queued ink', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.abort('connectionrefused'));
  await page.goto('/'); await page.getByRole('button', { name: 'Quick Workspace' }).click(); await dot(page);
  await expect(page.getByRole('status')).toHaveText('Saved on this device · Server unavailable');
  await page.reload(); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  await expect(page.getByRole('status')).toHaveText('Saved on this device · Server unavailable');
  await page.unroute('**/api/v1/**');
  await expect(page.getByRole('status')).toHaveText('Ink synced · Context saved on device', { timeout: 20000 });
});
