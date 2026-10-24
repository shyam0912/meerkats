import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const surface = (page: Page) => page.getByRole('region', { name: 'Whiteboard drawing surface' });
async function open(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await expect(surface(page)).toBeVisible(); }
async function select(page: Page, name: string) {
  await page.getByRole('button', { name: 'Shapes', exact: true }).click(); await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Close shapes', exact: true }).click();
}
async function drag(page: Page, x = 100, y = 100, endX = 300, endY = 250, finish = true) {
  const b = (await surface(page).boundingBox())!;
  await page.mouse.move(b.x + x / 1200 * b.width, b.y + y / 675 * b.height); await page.mouse.down();
  await page.mouse.move(b.x + endX / 1200 * b.width, b.y + endY / 675 * b.height, { steps: 12 }); if (finish) await page.mouse.up();
}
for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`all five shapes, accurate preview and touch controls at ${viewport.width}`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize(viewport); await open(page);
    const names = ['Line', 'Arrow', 'Rectangle', 'Circle', 'Triangle'];
    for (let i = 0; i < names.length; i++) {
      await select(page, names[i]!); await drag(page, 70 + i * 220, 200, 230 + i * 220, 360, false);
      await expect(surface(page)).toHaveAttribute('data-shape-count', String(i));
      await expect(page.getByRole('button', { name: 'Shapes', exact: true })).toBeDisabled();
      expect(await surface(page).locator('canvas').last().evaluate((canvas: HTMLCanvasElement) => canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some((v, n) => n % 4 === 3 && v > 0))).toBe(true);
      await page.mouse.up(); await expect(surface(page)).toHaveAttribute('data-shape-count', String(i + 1));
    }
    await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
    await page.screenshot({ path: info.outputPath(`shapes-${viewport.width}.png`) });
    await page.getByRole('button', { name: 'Shapes', exact: true }).click();
    for (const name of [...names, 'Close shapes']) {
      const b = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(56); expect(b.height).toBeGreaterThanOrEqual(56);
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0); expect(b.x + b.width).toBeLessThanOrEqual(viewport.width); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
    }
    await page.screenshot({ path: info.outputPath(`shape-menu-${viewport.width}.png`) });
    await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Shapes', exact: true })).toBeFocused();
    for (const name of ['Pen', 'Eraser', 'Undo', 'Redo', 'Clear ink', 'Shapes']) {
      const b = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('shape history, page deletion/recovery, Recent boards, ink masks and actual PNG export', async ({ page }) => {
  await open(page); await select(page, 'Rectangle');
  await page.getByRole('button', { name: 'Shapes', exact: true }).click(); await page.getByLabel('Shape colour').fill('#ff0000');
  await page.getByRole('group', { name: 'Shape type' }).getByRole('button', { name: 'Rectangle' }).click();
  await page.getByRole('button', { name: 'Broad', exact: true }).click(); await page.getByRole('button', { name: 'Close shapes' }).click();
  await drag(page); const originalPage = await surface(page).getAttribute('data-page-id');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(surface(page)).toHaveAttribute('data-shape-count', '0');
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(surface(page)).toHaveAttribute('data-shape-count', '1');
  await page.getByRole('button', { name: 'Eraser', exact: true }).click(); await drag(page, 50, 100, 350, 100);
  await expect(surface(page)).toHaveAttribute('data-shape-count', '1');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export PNG' }).click();
  const bytes = await readFile((await (await download).path())!);
  const pixel = await page.evaluate(async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0); return Array.from(context.getImageData(400, 200, 1, 1).data);
  }, bytes.toString('base64')); expect(pixel).toEqual([255, 0, 0, 255]);
  await page.getByRole('button', { name: 'Dismiss export message' }).click();
  await page.getByRole('button', { name: 'Clear ink', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Clear ink', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-shape-count', '1');
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await page.getByRole('button', { name: 'Add page', exact: true }).click(); await page.getByRole('button', { name: 'Close pages' }).click();
  await select(page, 'Circle'); await drag(page); await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(surface(page)).toHaveAttribute('data-shape-count', '0');
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await page.getByRole('button', { name: 'Delete page 1', exact: true }).click();
  await page.getByRole('button', { name: 'Delete page', exact: true }).click(); await page.getByRole('button', { name: 'Close pages' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved on this device'); await page.reload();
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await page.getByRole('button', { name: 'Restore deleted page 1', exact: true }).click(); await page.getByRole('button', { name: 'Close pages' }).click();
  await expect(surface(page)).toHaveAttribute('data-page-id', originalPage!); await expect(surface(page)).toHaveAttribute('data-shape-count', '1');
  const url = page.url(); await page.getByRole('button', { name: '← Back', exact: true }).click(); await page.getByRole('button', { name: 'Whiteboard', exact: true }).click();
  await page.getByRole('button', { name: 'Recent boards' }).click(); await page.getByRole('button').filter({ hasText: 'Board ' + new URL(url).searchParams.get('session')!.slice(0, 8) }).click();
  await expect(surface(page)).toHaveAttribute('data-shape-count', '1'); expect(page.url()).toBe(url);
});

test('Escape, resize, outside release and secondary touch do not leave incomplete shapes', async ({ page }) => {
  await open(page); await select(page, 'Arrow'); await drag(page, 100, 100, 300, 300, false);
  await page.keyboard.press('Escape'); await page.mouse.up(); await expect(surface(page)).toHaveAttribute('data-shape-count', '0');
  await drag(page, 100, 100, 300, 300, false); await page.setViewportSize({ width: 1024, height: 600 }); await page.mouse.up();
  await expect(surface(page)).toHaveAttribute('data-shape-count', '0');
  const box = (await surface(page).boundingBox())!; const cdp = await page.context().newCDPSession(page);
  const first = { x: box.x + 80, y: box.y + 80, id: 1 }; const second = { x: box.x + 200, y: box.y + 180, id: 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...first, x: first.x + 100 }, second] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(surface(page)).toHaveAttribute('data-shape-count', '0'); await cdp.detach();
  await drag(page, 100, 100, 300, 300, false); await page.mouse.move(box.x + box.width + 10, box.y + box.height / 2); await page.mouse.up();
  await expect(surface(page)).toHaveAttribute('data-shape-count', '1'); await expect(page.getByRole('button', { name: 'Shapes', exact: true })).toBeEnabled();
  await expect(page.getByRole('status')).toHaveText('Saved on this device'); await page.reload(); await expect(surface(page)).toHaveAttribute('data-shape-count', '1');
});
