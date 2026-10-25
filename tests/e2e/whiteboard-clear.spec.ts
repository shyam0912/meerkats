import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const surface = (page: Page) => page.getByRole('region', { name: 'Whiteboard drawing surface' });
async function drag(page: Page, x: number, y: number, endX: number, endY: number) {
  const box = (await surface(page).boundingBox())!;
  await page.mouse.move(box.x + x * box.width / 1200, box.y + y * box.height / 675); await page.mouse.down();
  await page.mouse.move(box.x + endX * box.width / 1200, box.y + endY * box.height / 675, { steps: 12 }); await page.mouse.up();
}
async function shape(page: Page, name: string, x = 100) {
  await button(page, 'Shapes').click(); await button(page, name).click(); await button(page, 'Close shapes').click();
  await drag(page, x, 200, x + 130, 350);
}
async function exported(page: Page) {
  const download = page.waitForEvent('download'); await button(page, 'Export PNG').click();
  const bytes = await readFile((await (await download).path())!); await button(page, 'Dismiss export message').click(); return bytes;
}
async function thumbnail(page: Page) {
  await page.getByRole('button', { name: /^Pages ·/ }).click();
  const preview = button(page, 'Open page 1').locator('img'); await expect(preview).toBeVisible();
  const pixels = await preview.evaluate(async (img: HTMLImageElement) => {
    await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0); return canvas.toDataURL();
  });
  await button(page, 'Close pages').click(); return pixels;
}
async function openPage(page: Page, n: number) {
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Open page ' + n).click();
}

test('Clear atomically removes mixed page content, updates previews/export and survives reload and Recent Boards', async ({ page }, info) => {
  await page.goto('/'); await button(page, 'Whiteboard').click();
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Square grid').click(); await button(page, 'Close pages').click();
  const emptyPng = await exported(page); const emptyThumbnail = await thumbnail(page);
  for (const [i, name] of ['Line', 'Arrow', 'Rectangle', 'Circle', 'Triangle'].entries()) await shape(page, name, 60 + i * 220);
  await button(page, 'Pen').click(); await drag(page, 150, 450, 650, 450);
  await button(page, 'Eraser').click(); await drag(page, 300, 400, 300, 500);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '2'); await expect(surface(page)).toHaveAttribute('data-shape-count', '5');
  const firstPage = await surface(page).getAttribute('data-page-id'); const documentId = await surface(page).getAttribute('data-document-id');
  const fullPng = await exported(page); const fullThumbnail = await thumbnail(page);
  expect(fullPng.equals(emptyPng)).toBe(false); expect(fullThumbnail).not.toBe(emptyThumbnail);
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Add page').click(); await button(page, 'Close pages').click();
  await shape(page, 'Circle'); await button(page, 'Pen').click(); await drag(page, 200, 450, 400, 450);
  const secondPage = await surface(page).getAttribute('data-page-id'); await openPage(page, 1);
  await button(page, 'Clear').click(); const dialog = page.getByRole('dialog', { name: 'Clear everything on this page?' });
  await expect(dialog).toBeVisible(); await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.screenshot({ path: info.outputPath('clear-confirmation.png') }); await button(page, 'Cancel').click();
  expect((await exported(page)).equals(fullPng)).toBe(true); await expect(button(page, 'Clear')).toBeEnabled();
  await button(page, 'Clear').click(); await dialog.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0'); await expect(surface(page)).toHaveAttribute('data-shape-count', '0');
  await expect(surface(page)).toHaveAttribute('data-page-id', firstPage!); await expect(surface(page)).toHaveAttribute('data-document-id', documentId!);
  await expect(surface(page)).toHaveAttribute('data-background', 'grid'); await expect(button(page, 'Clear')).toBeDisabled();
  expect((await exported(page)).equals(emptyPng)).toBe(true); expect(await thumbnail(page)).toBe(emptyThumbnail);
  await button(page, 'Undo').click(); expect((await exported(page)).equals(fullPng)).toBe(true); expect(await thumbnail(page)).toBe(fullThumbnail);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '2'); await expect(surface(page)).toHaveAttribute('data-shape-count', '5');
  await button(page, 'Redo').click(); expect((await exported(page)).equals(emptyPng)).toBe(true);
  await openPage(page, 2); await expect(surface(page)).toHaveAttribute('data-page-id', secondPage!);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1'); await expect(surface(page)).toHaveAttribute('data-shape-count', '1');
  await openPage(page, 1); await expect(page.getByRole('status')).toHaveText('Saved on this device'); const url = page.url();
  await page.reload(); await expect(surface(page)).toHaveAttribute('data-shape-count', '0'); await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
  await expect(surface(page)).toHaveAttribute('data-background', 'grid'); await expect(button(page, 'Undo')).toBeDisabled();
  await button(page, '← Back').click(); await button(page, 'Whiteboard').click(); await button(page, 'Recent boards').click();
  await page.getByRole('button').filter({ hasText: 'Board ' + new URL(url).searchParams.get('session')!.slice(0, 8) }).click();
  await expect(surface(page)).toHaveAttribute('data-page-id', firstPage!); expect((await exported(page)).equals(emptyPng)).toBe(true);
  await openPage(page, 2); await expect(surface(page)).toHaveAttribute('data-shape-count', '1'); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
});

test('a shape-only page enables Clear and restores all its shapes in one Undo', async ({ page }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click();
  await shape(page, 'Triangle'); await shape(page, 'Arrow', 500);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0'); await expect(button(page, 'Clear')).toBeEnabled();
  await button(page, 'Clear').click(); await page.getByRole('dialog').getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-shape-count', '0'); await expect(button(page, 'Clear')).toBeDisabled();
  await button(page, 'Undo').click(); await expect(surface(page)).toHaveAttribute('data-shape-count', '2');
  await button(page, 'Redo').click(); await expect(surface(page)).toHaveAttribute('data-shape-count', '0');
});
