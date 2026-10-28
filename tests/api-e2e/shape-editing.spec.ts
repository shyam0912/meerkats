import { test, expect } from '@playwright/test';
import { sessionResponseSchema } from '../../contracts';
import { button, surface, createShape, select, drag, handleDrag, currentShapes } from '../helpers/shape-editing';

test('transform/delete history synchronizes v3 geometry and recovers on a fresh device', async ({ page, browser }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click(); await createShape(page); await select(page);
  await drag(page, 400, 320, 600, 320); await handleDrag(page, 'Resize shape se', 60, 40); await handleDrag(page, 'Rotate shape', 90, 35);
  const shapes = await currentShapes(page); const url = page.url(); const sessionId = new URL(url).searchParams.get('session');
  const synced = () => expect(page.getByRole('status')).toHaveText('Ink synced · Context saved on device', { timeout: 20000 });
  const remote = async () => {
    await synced(); const session = sessionResponseSchema.parse(await (await page.request.get(`/api/v1/sessions/${sessionId}`)).json());
    const document = session.documents.find(d => d.document.owner.target.kind === 'whiteboard')!.document;
    if (document.schemaVersion !== 3) throw new Error('Expected v3'); return document;
  };
  const before = await remote(); expect(before.pages[0]!.shapes).toEqual(shapes);
  await button(page, 'Delete shape').click(); expect((await remote()).pages[0]!.shapes).toEqual([]);
  await button(page, 'Undo').click(); expect((await remote()).pages[0]!.shapes).toEqual(shapes);
  await button(page, 'Redo').click(); expect((await remote()).pages[0]!.shapes).toEqual([]);
  await button(page, 'Undo').click(); const restored = await remote(); expect(restored.pages[0]!.shapes).toEqual(shapes);
  const context = await browser.newContext(); const fresh = await context.newPage(); await fresh.goto(url);
  await expect(surface(fresh)).toHaveAttribute('data-shape-count', '1'); expect(await currentShapes(fresh)).toEqual(shapes);
  await expect(surface(fresh)).toHaveAttribute('data-selected-shape', ''); await expect(button(fresh, 'Undo')).toBeDisabled();
  await context.close();
});
