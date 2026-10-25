import { test, expect, type Page } from '@playwright/test';
import { sessionResponseSchema } from '../../contracts';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const surface = (page: Page) => page.getByRole('region', { name: 'Whiteboard drawing surface' });
test('mixed-content Clear, Undo and Redo sync atomically and preserve another page on fresh-device recovery', async ({ page, browser }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click();
  const drag = async () => {
    const box = (await surface(page).boundingBox())!;
    await page.mouse.move(box.x + box.width * .2, box.y + box.height * .3); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .6, { steps: 12 }); await page.mouse.up();
  };
  await drag(); await button(page, 'Eraser').click(); await drag();
  await button(page, 'Shapes').click(); await button(page, 'Rectangle').click(); await button(page, 'Close shapes').click(); await drag();
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Square grid').click(); await button(page, 'Add page').click(); await button(page, 'Close pages').click(); await drag();
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Open page 1').click();
  const synced = () => expect(page.getByRole('status')).toHaveText('Ink synced · Context saved on device', { timeout: 20000 });
  const url = page.url(); const id = new URL(url).searchParams.get('session');
  const remote = async () => sessionResponseSchema.parse(await (await page.request.get(`/api/v1/sessions/${id}`)).json());
  await synced(); const before = await remote(); const board = before.documents.find(d => d.document.owner.target.kind === 'whiteboard')!.document;
  if (board.schemaVersion !== 3) throw new Error('Expected v3');
  expect(board.pages[0]!.objects).toHaveLength(2); expect(board.pages[0]!.shapes).toHaveLength(1);
  expect(board.pages[1]!.shapes).toHaveLength(1);
  await button(page, 'Clear').click(); await page.getByRole('dialog').getByRole('button', { name: 'Clear', exact: true }).click(); await synced();
  const cleared = await remote(); const clearedBoard = cleared.documents.find(d => d.document.id === board.id)!.document;
  expect(clearedBoard).toEqual({ ...board, localRevision: board.localRevision + 1, pages: [{ ...board.pages[0], objects: [], shapes: [] }, board.pages[1]] });
  expect(cleared.documents.filter(d => d.document.owner.target.kind === 'annotation')).toEqual(before.documents.filter(d => d.document.owner.target.kind === 'annotation'));
  await button(page, 'Undo').click(); await synced();
  expect((await remote()).documents.find(d => d.document.id === board.id)!.document).toEqual({ ...board, localRevision: board.localRevision + 2 });
  await button(page, 'Redo').click(); await synced();
  expect((await remote()).documents.find(d => d.document.id === board.id)!.document).toEqual({ ...clearedBoard, localRevision: board.localRevision + 3 });
  const context = await browser.newContext(); const recovered = await context.newPage(); await recovered.goto(url);
  await expect(surface(recovered)).toHaveAttribute('data-shape-count', '0'); await expect(surface(recovered)).toHaveAttribute('data-ink-count', '0');
  await expect(surface(recovered)).toHaveAttribute('data-background', 'grid'); await expect(button(recovered, 'Clear')).toBeDisabled();
  await recovered.getByRole('button', { name: /^Pages ·/ }).click(); await button(recovered, 'Open page 2').click();
  await expect(surface(recovered)).toHaveAttribute('data-shape-count', '1'); await context.close();
});
