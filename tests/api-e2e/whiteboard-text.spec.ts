import { test, expect } from '@playwright/test';
import { sessionResponseSchema } from '../../contracts';
import { button, surface, point } from '../helpers/shape-editing';

test('v4 Unicode text edits sync and stay editable after fresh-browser recovery', async ({ page, browser }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click(); await button(page, 'Text').click();
  const p = await point(page, 100, 100); await page.mouse.click(p.x, p.y);
  const value = 'English മലയാളം\nക്ഷേത്രം — H₂O'; await page.getByRole('textbox', { name: 'Board text' }).fill(value); await button(page, 'Apply text').click();
  const url = page.url(); const sessionId = new URL(url).searchParams.get('session');
  const remote = async (current = page) => {
    await expect(current.getByRole('status')).toHaveText('Ink synced · Context saved on device', { timeout: 20000 });
    const session = sessionResponseSchema.parse(await (await current.request.get(`/api/v1/sessions/${sessionId}`)).json());
    const doc = session.documents.find(d => d.document.owner.target.kind === 'whiteboard')!.document;
    if (doc.schemaVersion !== 4) throw new Error('Expected v4'); return doc.pages[0]!.texts;
  };
  const original = await remote(); expect(original[0]!.text).toBe(value);
  const context = await browser.newContext(); const fresh = await context.newPage(); await fresh.goto(url);
  await expect(surface(fresh)).toHaveAttribute('data-text-count', '1'); await button(fresh, 'Select').click(); await button(fresh, 'Next text').click(); await button(fresh, 'Edit text').click();
  await fresh.getByRole('textbox', { name: 'Board text' }).fill(value + '\nEdited'); await button(fresh, 'Apply text').click();
  const edited = await remote(fresh); expect(edited[0]!.id).toBe(original[0]!.id); expect(edited[0]!.text).toBe(value + '\nEdited');
  await button(fresh, 'Undo').click(); expect(await remote(fresh)).toEqual(original); await button(fresh, 'Redo').click(); expect(await remote(fresh)).toEqual(edited);
  await context.close();
});
