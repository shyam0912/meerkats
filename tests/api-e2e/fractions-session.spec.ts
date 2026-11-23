import { test, expect } from '@playwright/test';
import { launchFractions, fractionDrag } from '../helpers/fractions';
import { FRACTIONS } from '../../contracts/fractions-content';

test('fraction placements and Malayalam recover from the API in a fresh browser; overlaps are rejected', async ({ page, browser }) => {
  await launchFractions(page); await fractionDrag(page, 1, 260, 128); await fractionDrag(page, 3, 260, 252);
  await page.getByRole('button', { name: 'More fraction controls' }).click();
  await page.getByRole('button', { name: 'Change fraction language' }).click();
  await page.getByRole('button', { name: 'Close fraction settings' }).click();
  await expect(page.locator('.interactive-save')).toHaveText('Lesson and ink synced', { timeout: 20000 });
  const url = page.url(), id = new URL(url).searchParams.get('session');
  const remote = await (await page.request.get('/api/v1/sessions/' + id)).json();
  const state = remote.progress.states[FRACTIONS.activity];
  expect(state.language).toBe('ml'); expect(state.pieces[0].placement).toEqual({ lane: 'top', start: 0 });
  const bad = structuredClone(remote.progress); bad.states[FRACTIONS.activity].pieces[1].placement = { lane: 'top', start: 1 };
  expect((await page.request.put(`/api/v1/sessions/${id}/progress`, { data: { mutationId: crypto.randomUUID(), baseServerRevision: remote.progressServerRevision, progress: bad } })).status()).toBe(400);
  expect((await (await page.request.get('/api/v1/sessions/' + id)).json()).progress).toEqual(remote.progress);
  const context = await browser.newContext(), restored = await context.newPage(); await restored.goto(url);
  await expect(restored.locator('.fraction-title')).toHaveText('ഒരേ മുഴുവന്റെ ഭാഗങ്ങൾ');
  await expect(restored.getByTestId('fraction-piece-1')).toHaveAttribute('data-lane', 'top');
  await expect(restored.getByTestId('fraction-piece-3')).toHaveAttribute('data-lane', 'bottom'); await context.close();
});

test('fraction API outage preserves local placements and immutable pending mutation through reload', async ({ page }) => {
  await launchFractions(page); await expect(page.locator('.interactive-save')).toHaveText('Lesson and ink synced', { timeout: 20000 });
  let outage = true; const payloads: string[] = [];
  await page.route('**/api/v1/sessions/*/progress', route => { payloads.push(route.request().postData()!); return outage ? route.abort() : route.continue(); });
  await fractionDrag(page, 1, 260, 128);
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device · Server unavailable', { timeout: 20000 });
  await page.reload(); await expect(page.getByTestId('fraction-piece-1')).toHaveAttribute('data-lane', 'top');
  outage = false; await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('.interactive-save')).toHaveText('Lesson and ink synced', { timeout: 20000 });
  expect(payloads.length).toBeGreaterThanOrEqual(2); expect(new Set(payloads).size).toBe(1);
});
