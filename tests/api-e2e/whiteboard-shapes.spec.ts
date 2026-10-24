import { test, expect } from '@playwright/test';
import { sessionResponseSchema } from '../../contracts';

test('v3 shape geometry synchronizes and recovers in a fresh browser without changing annotation versions', async ({ page, browser }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Whiteboard', exact: true }).click();
  await page.getByRole('button', { name: 'Shapes', exact: true }).click(); await page.getByRole('button', { name: 'Circle', exact: true }).click();
  await page.getByRole('button', { name: 'Close shapes' }).click();
  const surface = page.getByRole('region', { name: 'Whiteboard drawing surface' }); const box = (await surface.boundingBox())!;
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
  await expect(surface).toHaveAttribute('data-shape-count', '1');
  await expect(page.getByRole('status')).toHaveText('Ink synced · Context saved on device', { timeout: 20000 });
  const url = page.url(); const id = new URL(url).searchParams.get('session');
  const remote = sessionResponseSchema.parse(await (await page.request.get(`/api/v1/sessions/${id}`)).json());
  const board = remote.documents.find(d => d.document.owner.target.kind === 'whiteboard')!.document;
  expect(board.schemaVersion).toBe(3); if (board.schemaVersion !== 3) throw new Error('Expected v3');
  expect(board.pages[0]!.shapes[0]!.shape).toBe('circle');
  expect(remote.documents.filter(d => d.document.owner.target.kind === 'annotation').every(d => d.document.schemaVersion === 1)).toBe(true);
  const context = await browser.newContext(); const recovered = await context.newPage(); await recovered.goto(url);
  await expect(recovered.getByRole('region', { name: 'Whiteboard drawing surface' })).toHaveAttribute('data-shape-count', '1');
  await expect(recovered.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled(); await context.close();
});
