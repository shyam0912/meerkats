import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const surface = (page: Page) => page.getByRole('region', { name: 'Whiteboard drawing surface' });
async function open(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await expect(surface(page)).toBeVisible(); }
async function dot(page: Page, x = .5, y = .5) { const box = (await surface(page).boundingBox())!; await page.mouse.click(box.x + x * box.width, box.y + y * box.height); }

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`standalone board, settings and Focus fit ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport); await open(page);
    for (const name of ['Content', 'Explore', 'Annotate']) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    for (const name of ['Pen', 'Eraser', 'Undo', 'Redo', 'Ink settings', 'Recent boards', 'Export PNG', 'Focus']) {
      const rect = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(rect.width).toBeGreaterThanOrEqual(56); expect(rect.height).toBeGreaterThanOrEqual(56);
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
    }
    await dot(page); const id = await surface(page).getAttribute('data-document-id');
    await page.getByRole('button', { name: 'Ink settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close drawing options' })).toBeFocused();
    const tray = (await page.getByRole('dialog').boundingBox())!;
    expect(tray.y).toBeGreaterThanOrEqual(0); expect(tray.y + tray.height).toBeLessThanOrEqual(viewport.height);
    await page.getByRole('button', { name: 'Blue ink', exact: true }).click(); await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Ink settings', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Focus', exact: true }).click(); await expect(page.getByRole('button', { name: 'Leave focus' })).toBeVisible();
    await expect(surface(page)).toHaveAttribute('data-document-id', id!); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
    await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Focus', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  });
  test(`save errors stay readable and export remains available at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw new Error('Storage denied'); } }); });
    await open(page); await dot(page); await expect(page.getByRole('status')).toHaveText('Needs attention · Device save failed');
    await expect(page.getByLabel('Save guidance')).toContainText('export a PNG');
    await expect(page.getByRole('button', { name: 'Export PNG' })).toBeEnabled();
    const screenshot = test.info().outputPath(`save-error-${viewport.width}.png`);
    await page.screenshot({ path: screenshot });
    await test.info().attach(`save-error-${viewport.width}`, { path: screenshot, contentType: 'image/png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.getByRole('button', { name: '← Back', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Leave without a confirmed save?');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  });
}
test('pen and eraser sizes are independent and cannot change during a gesture', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: 'Ink settings', exact: true }).click();
  await page.getByRole('button', { name: 'Broad', exact: true }).click(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Eraser', exact: true }).click(); await page.getByRole('button', { name: 'Ink settings', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Eraser size', exact: true })).toHaveValue('18'); await page.getByRole('button', { name: 'Medium', exact: true }).click(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Pen', exact: true }).click(); await page.getByRole('button', { name: 'Ink settings', exact: true }).click();
  await expect(page.getByLabel('Stroke width')).toHaveValue('15'); await page.keyboard.press('Escape');
  const box = (await surface(page).boundingBox())!; await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.down(); await page.mouse.move(box.x + 150, box.y + 150);
  for (const name of ['Focus', 'Recent boards', 'Export PNG', 'Ink settings', 'Eraser']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  await page.mouse.up(); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
});
test('recent boards reopen original identity and committed ink without restored Undo history', async ({ page }) => {
  await open(page); await dot(page); await expect(page.getByRole('status')).toHaveText('Saved on this device');
  const first = page.url(); const id = new URL(first).searchParams.get('session')!;
  await page.getByRole('button', { name: '← Back', exact: true }).click(); await page.getByRole('button', { name: 'Whiteboard', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
  await page.getByRole('button', { name: 'Recent boards' }).click(); await expect(page.getByRole('button', { name: 'Close recent boards' })).toBeFocused();
  await page.getByRole('button', { name: new RegExp('Board ' + id.slice(0, 8)) }).click();
  await expect(page).toHaveURL(first); await expect(surface(page)).toHaveAttribute('data-ink-count', '1'); await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});
test('PNG contains committed ink, white paper and eraser holes, without editor controls', async ({ page }) => {
  await open(page); await dot(page, .25); await dot(page, .5); await page.getByRole('button', { name: 'Eraser', exact: true }).click(); await dot(page, .5);
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export PNG' }).click(); const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^Meerkats-board-.*\.png$/);
  const bytes = await readFile((await download.path())!);
  const pixels = await page.evaluate(async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    return { width: image.width, height: image.height, samples: [[600, 675], [1200, 675], [0, 0]].map(([x, y]) => Array.from(ctx.getImageData(x!, y!, 1, 1).data)) };
  }, bytes.toString('base64'));
  expect(pixels).toEqual({ width: 2400, height: 1350, samples: [[0, 0, 0, 255], [255, 255, 255, 255], [255, 255, 255, 255]] });
  await expect(surface(page)).toHaveAttribute('data-ink-count', '3');
});
