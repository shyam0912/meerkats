import { test, expect } from '@playwright/test';
import { CHEMISTRY } from '../../contracts/chemistry';
import { launchChemistry, step, drawDot, inkSurface } from '../helpers/chemistry';

test('chemistry version and runtime recover from API, then survive an API outage locally', async ({ page, browser }) => {
  await launchChemistry(page); await step(page, 5, 'Build the IUPAC name');
  await page.getByRole('button', { name: 'Name part: Branch', exact: true }).click();
  await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await drawDot(page);
  await expect(page.getByRole('status')).toHaveText('Lesson and ink synced', { timeout: 20000 });
  const url = page.url(); const session = new URL(url).searchParams.get('session');
  const remote = await (await page.request.get(`/api/v1/sessions/${session}`)).json();
  expect(remote.lessonVersionId).toBe(CHEMISTRY.version); expect(remote.documents).toHaveLength(8);
  const fresh = await browser.newContext(); const restored = await fresh.newPage(); await restored.goto(url);
  await expect(restored.getByRole('button', { name: 'Activity outline' })).toContainText('5 of 7');
  await expect(restored.getByRole('button', { name: 'Name part: Branch', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(inkSurface(restored)).toHaveAttribute('data-ink-count', '1'); await fresh.close();
  await page.route('**/api/v1/**', route => route.abort('connectionrefused'));
  await page.getByRole('button', { name: 'Content', exact: true }).click(); await page.getByRole('button', { name: 'Name part: Parent root', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Saved on this device · Server unavailable');
  await page.reload(); await expect(page.getByRole('button', { name: 'Name part: Parent root', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1');
  await page.unroute('**/api/v1/**'); await expect(page.getByRole('status')).toHaveText('Lesson and ink synced', { timeout: 20000 });
});
