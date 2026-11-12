import { test, expect } from '@playwright/test';
import { sessionResponseSchema } from '../../contracts';
import { button, createShape, drag, point, surface } from '../helpers/shape-editing';

test('atomic mixed batches remain ordinary v4 documents and recover in a fresh profile', async ({ page, browser }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click(); await createShape(page);
  await button(page, 'Text').click(); const p = await point(page, 700, 230); await page.mouse.click(p.x, p.y);
  await page.getByRole('textbox', { name: 'Board text' }).fill('English മലയാളം\nTogether'); await button(page, 'Apply text').click();
  const url = page.url(); const sessionId = new URL(url).searchParams.get('session');
  async function remote() {
    await expect(page.getByRole('status')).toHaveText('Ink synced · Context saved on device', { timeout: 20000 });
    const session = sessionResponseSchema.parse(await (await page.request.get(`/api/v1/sessions/${sessionId}`)).json());
    const doc = session.documents.find(d => d.document.owner.target.kind === 'whiteboard')!.document;
    if (doc.schemaVersion !== 4) throw new Error('Expected v4'); return doc;
  }
  const original = await remote(); await surface(page).press('Escape'); await drag(page, 200, 150, 1150, 500);
  await expect(surface(page)).toHaveAttribute('data-selected-count', '2'); await drag(page, 400, 320, 440, 340);
  const moved = await remote(); expect(moved.localRevision).toBe(original.localRevision + 1);
  expect(moved.pages[0]!.texts[0]!.origin.x).toBeCloseTo(original.pages[0]!.texts[0]!.origin.x + 40, 3);
  await button(page, 'Duplicate').click(); const copies = await remote();
  expect(copies.pages[0]!.shapes).toHaveLength(2); expect(copies.pages[0]!.texts).toHaveLength(2);
  await button(page, 'Delete selected').click(); expect((await remote()).pages).toEqual(moved.pages);
  await button(page, 'Undo').click(); expect((await remote()).pages).toEqual(copies.pages);
  await button(page, 'Redo').click(); expect((await remote()).pages).toEqual(moved.pages);
  const context = await browser.newContext();
  try {
    const fresh = await context.newPage(); await fresh.goto(url);
    await expect(surface(fresh)).toHaveAttribute('data-shape-count', '1');
    await expect(surface(fresh)).toHaveAttribute('data-text-count', '1');
    await expect(surface(fresh)).toHaveAttribute('data-selected-count', '0');
    await button(fresh, 'Select').click(); await button(fresh, 'Next text').click(); await button(fresh, 'Edit text').click();
    await expect(fresh.getByRole('textbox', { name: 'Board text' })).toHaveValue('English മലയാളം\nTogether');
  } finally { await context.close(); }
});
