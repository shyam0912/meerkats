import { test, expect } from '@playwright/test';
import { button, surface, drag, point, handleDrag, currentShapes, savedRecord } from '../helpers/shape-editing';

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`selection actions never cover corner handles or the former rotation target at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await page.goto('/'); await button(page, 'Whiteboard').click();
    for (const corner of [
      { x: 20, y: 20, handle: 'nw', dx: 20, dy: 15 },
      { x: 1000, y: 20, handle: 'ne', dx: -20, dy: 15 },
      { x: 1000, y: 555, handle: 'se', dx: -20, dy: -15 },
      { x: 20, y: 555, handle: 'sw', dx: 20, dy: -15 },
    ]) {
      await button(page, 'Shapes').click(); await button(page, 'Rectangle').click(); await button(page, 'Close shapes').click();
      await drag(page, corner.x, corner.y, corner.x + 180, corner.y + 100);
      await button(page, 'Select').click(); const actions = page.getByRole('group', { name: 'Selected object actions' });
      await expect(actions).toBeVisible(); const emptySelectionBounds = await surface(page).boundingBox();
      await button(page, 'Next shape').click(); await expect(surface(page)).not.toHaveAttribute('data-selected-shape', '');
      expect(await surface(page).boundingBox()).toEqual(emptySelectionBounds);
      const canvas = (await surface(page).boundingBox())!; const controls = (await actions.boundingBox())!;
      expect(controls.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
      expect(await surface(page).locator('.wb-selection-actions').count()).toBe(0);
      for (const name of ['Resize shape nw', 'Resize shape ne', 'Resize shape se', 'Resize shape sw', 'Rotate shape']) {
        const handle = button(page, name); const box = (await handle.boundingBox())!;
        expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.hasAttribute('data-handle'),
          { x: box.x + box.width / 2, y: box.y + box.height / 2 })).toBe(true);
      }
      const before = await currentShapes(page); const revision = Number(await surface(page).getAttribute('data-revision'));
      await handleDrag(page, 'Resize shape ' + corner.handle, corner.dx, corner.dy);
      const resized = await currentShapes(page); expect(resized).not.toEqual(before);
      await expect(surface(page)).toHaveAttribute('data-revision', String(revision + 1));
      await button(page, 'Undo').click(); expect(await currentShapes(page)).toEqual(before);
      await button(page, 'Redo').click(); expect(await currentShapes(page)).toEqual(resized);
      await button(page, 'Rotate shape').focus(); await page.keyboard.press('Shift+ArrowRight');
      expect(await currentShapes(page)).not.toEqual(resized); await button(page, 'Undo').click();
      expect(await currentShapes(page)).toEqual(resized);
      await page.screenshot({ path: info.outputPath(`corner-${corner.handle}-${viewport.width}.png`) });
      await button(page, 'Delete shape').click(); await expect(surface(page)).toHaveAttribute('data-shape-count', '0');
      expect(await surface(page).boundingBox()).toEqual(emptySelectionBounds);
    }
    await button(page, 'Shapes').click(); await button(page, 'Rectangle').click(); await button(page, 'Close shapes').click();
    await drag(page, 640, 190, 840, 345); await button(page, 'Select').click(); await button(page, 'Next shape').click();
    const before = await currentShapes(page);
    await handleDrag(page, 'Rotate shape', 60, 25); const rotated = await currentShapes(page);
    expect(rotated).not.toEqual(before);
    await button(page, 'Undo').click(); expect(await currentShapes(page)).toEqual(before);
    await button(page, 'Redo').click(); expect(await currentShapes(page)).toEqual(rotated);
    await page.screenshot({ path: info.outputPath(`rotation-unobstructed-${viewport.width}.png`) });
    for (const name of ['Next shape', 'Delete shape', 'Pen', 'Eraser', 'Select', 'Shapes', 'Undo', 'Redo', 'Clear']) {
      const box = (await button(page, name).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(56); expect(box.width).toBeGreaterThanOrEqual(56);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('bottom selection actions preserve touch cancellation, keyboard focus, page isolation and reload', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 600 }, hasTouch: true }); const page = await context.newPage();
  await page.goto('/'); await button(page, 'Whiteboard').click(); await button(page, 'Shapes').click();
  await button(page, 'Rectangle').click(); await button(page, 'Close shapes').click(); await drag(page, 20, 20, 200, 120);
  await button(page, 'Select').click(); await button(page, 'Next shape').focus(); await page.keyboard.press('Enter');
  await expect(surface(page)).toBeFocused(); const before = await currentShapes(page);
  const handle = (await button(page, 'Resize shape nw').boundingBox())!;
  const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2, id: 1 };
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...start, x: start.x + 15, y: start.y + 10 }] });
  await expect(button(page, 'Next shape')).toBeDisabled(); await expect(button(page, 'Delete shape')).toBeDisabled();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); expect(await currentShapes(page)).toEqual(before);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...start, x: start.x + 15, y: start.y + 10 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const resized = await currentShapes(page); expect(resized).not.toEqual(before);
  await button(page, 'Undo').click(); expect(await currentShapes(page)).toEqual(before);
  await button(page, 'Redo').click(); expect(await currentShapes(page)).toEqual(resized);
  const p = await point(page, 120, 80); await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.mouse.move(p.x + 20, p.y + 20); await page.keyboard.press('Escape'); await page.mouse.up();
  expect(await currentShapes(page)).toEqual(resized);
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Add page').click(); await button(page, 'Close pages').click();
  await expect(button(page, 'Next shape')).toBeDisabled(); await expect(button(page, 'Delete shape')).toHaveCount(0);
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Open page 1').click();
  await button(page, 'Next shape').click(); await expect(surface(page)).not.toHaveAttribute('data-selected-shape', '');
  expect(await currentShapes(page)).toEqual(resized); await savedRecord(page); await page.reload();
  expect(await currentShapes(page)).toEqual(resized); await expect(surface(page)).toHaveAttribute('data-selected-shape', '');
  await context.close();
});
