import { test, expect } from '@playwright/test';
import { launchCounting, countingMore, counterPositions } from '../helpers/counting';
import { COUNTING } from '../../contracts/counting-content';

test('counting state synchronizes, rejects malformed geometry and recovers on a fresh profile', async ({ page, browser }) => {
  await launchCounting(page); const counter = page.getByTestId('counter-1');
  await counter.press('Enter'); await counter.press('ArrowUp'); await counter.press('Enter');
  await countingMore(page); await page.getByRole('button', { name: 'Change label language' }).click(); await page.getByRole('button', { name: 'Close counting settings' }).click();
  await expect(page.locator('.interactive-save')).toHaveText('Lesson and ink synced', { timeout: 20000 });
  const url = page.url(), id = new URL(url).searchParams.get('session'); const expected = await counterPositions(page);
  const remote = await (await page.request.get('/api/v1/sessions/' + id)).json();
  expect(remote.lessonVersionId).toBe(COUNTING.version); expect(remote.progress.states[COUNTING.activity].language).toBe('ml');
  const invalid = structuredClone(remote.progress); invalid.states[COUNTING.activity].counters[0].id = invalid.states[COUNTING.activity].counters[1].id;
  const rejected = await page.request.put(`/api/v1/sessions/${id}/progress`, { data: { mutationId: crypto.randomUUID(), baseServerRevision: remote.progressServerRevision, progress: invalid } });
  expect(rejected.status()).toBe(400);
  const context = await browser.newContext(), restored = await context.newPage(); await restored.goto(url);
  await expect(restored.getByTestId('counter-1')).toHaveAttribute('data-y', '348'); expect(await counterPositions(restored)).toEqual(expected);
  await expect(restored.locator('.counting-title')).toHaveText('എണ്ണം അതേ. ക്രമം വേറെ.'); await context.close();
});

test('API outage retains locally saved counting state and exact retry until acknowledgement', async ({ page }) => {
  await launchCounting(page); await expect(page.locator('.interactive-save')).toHaveText('Lesson and ink synced', { timeout: 20000 });
  let outage = true; const mutations: string[] = [];
  await page.route('**/api/v1/sessions/*/progress', route => {
    mutations.push(route.request().postData()!); return outage ? route.abort() : route.continue();
  });
  await page.getByRole('button', { name: 'Show count' }).click();
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device · Server unavailable', { timeout: 20000 });
  await page.reload(); await expect(page.getByTestId('counting-total')).toContainText('5');
  outage = false; await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('.interactive-save')).toHaveText('Lesson and ink synced', { timeout: 20000 });
  expect(mutations.length).toBeGreaterThanOrEqual(2); expect(new Set(mutations).size).toBe(1);
});
