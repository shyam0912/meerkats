import { test, expect } from '@playwright/test';
import { launchPhysics } from '../helpers/physics';
import { PHYSICS } from '../../contracts/physics';
import { drawDot, inkSurface } from '../helpers/chemistry';
test('lens runtime and annotation sync and recover from API on a fresh device', async ({ page, browser }) => {
  await launchPhysics(page); await page.getByRole('button', { name: 'Concave', exact: true }).click();
  await page.getByRole('slider', { name: 'Object position' }).press('Home');
  await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await drawDot(page);
  await expect(page.locator('.interactive-save')).toHaveText('Lesson and ink synced', { timeout: 20000 });
  const url = page.url(); const remote = await (await page.request.get('/api/v1/sessions/' + new URL(url).searchParams.get('session'))).json();
  expect(remote.lessonVersionId).toBe(PHYSICS.version); expect(remote.progress.states[PHYSICS.activity]).toMatchObject({ lens: 'concave', distance: 5 });
  const context = await browser.newContext(); const restored = await context.newPage(); await restored.goto(url);
  await expect(restored.getByRole('button', { name: 'Concave', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(inkSurface(restored)).toHaveAttribute('data-ink-count', '1');
  await expect(restored.getByRole('slider', { name: 'Object position' })).toHaveAttribute('aria-valuenow', '5'); await context.close();
});
