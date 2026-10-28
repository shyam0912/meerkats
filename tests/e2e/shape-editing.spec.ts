import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { button, surface, point, drag, createShape, select, handleDrag, savedRecord, currentShapes } from '../helpers/shape-editing';

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`select, move, resize and rotate all shapes at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await page.goto('/'); await button(page, 'Whiteboard').click();
    for (const name of ['Line', 'Arrow', 'Rectangle', 'Circle', 'Triangle']) {
      await createShape(page, name); const original = (await currentShapes(page))[0]!; const revision = await surface(page).getAttribute('data-revision');
      await select(page); await expect(surface(page)).toHaveAttribute('data-revision', revision!);
      await page.screenshot({ path: info.outputPath(`selected-${name}-${viewport.width}.png`) });
      await drag(page, 400, 320, 600, 320); const moved = (await currentShapes(page))[0]!;
      expect(moved.id).toBe(original.id); expect(moved).not.toEqual(original); expect(moved.color).toBe(original.color); expect(moved.width).toBe(original.width);
      await handleDrag(page, name === 'Line' || name === 'Arrow' ? 'Resize shape end' : 'Resize shape se', 70, 50);
      const resized = (await currentShapes(page))[0]!; expect(resized).not.toEqual(moved);
      await page.screenshot({ path: info.outputPath(`resized-${name}-${viewport.width}.png`) });
      await handleDrag(page, 'Rotate shape', 80, 35); const rotated = (await currentShapes(page))[0]!;
      if (name === 'Circle') expect(rotated).toEqual(resized); else expect(rotated).not.toEqual(resized);
      await page.screenshot({ path: info.outputPath(`rotated-${name}-${viewport.width}.png`) });
      for (const label of ['Pen', 'Eraser', 'Select', 'Shapes', 'Undo', 'Redo', 'Clear']) {
        const box = (await button(page, label).boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(56); expect(box.height).toBeGreaterThanOrEqual(56);
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      }
      await button(page, 'Delete shape').click(); await expect(surface(page)).toHaveAttribute('data-shape-count', '0');
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('edit cancellation, outside release and secondary pointers never leave an incomplete edit', async ({ page }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click(); await createShape(page); await select(page);
  const before = await currentShapes(page); const revision = await surface(page).getAttribute('data-revision');
  const a = await point(page, 400, 320); const b = await point(page, 600, 320);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.keyboard.press('Escape'); await page.mouse.up();
  expect(await currentShapes(page)).toEqual(before); await expect(surface(page)).toHaveAttribute('data-revision', revision!);
  await select(page); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y);
  await surface(page).dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true }); await page.mouse.up();
  expect(await currentShapes(page)).toEqual(before);
  await surface(page).dispatchEvent('pointerdown', { pointerId: 99, pointerType: 'touch', isPrimary: false, button: 0, clientX: a.x, clientY: a.y });
  await surface(page).dispatchEvent('pointerup', { pointerId: 99, pointerType: 'touch', isPrimary: false, clientX: b.x, clientY: b.y });
  expect(await currentShapes(page)).toEqual(before);
  await drag(page, 400, 320, 1400, 320); expect(await currentShapes(page)).not.toEqual(before);
  await expect(button(page, 'Undo')).toBeEnabled(); await button(page, 'Undo').click(); expect(await currentShapes(page)).toEqual(before);
  await select(page); await drag(page, 400, 320, 500, 320); expect(await currentShapes(page)).not.toEqual(before);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
});

test('edited shapes retain page history, recovery, Clear-all and control-free PNG export', async ({ page }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click(); await createShape(page); await select(page); await handleDrag(page, 'Rotate shape', 90, 35);
  const edited = await currentShapes(page); const exportPng = async () => {
    const event = page.waitForEvent('download'); await button(page, 'Export PNG').click();
    const bytes = await readFile((await (await event).path())!); await button(page, 'Dismiss export message').click(); return bytes;
  };
  const selectedExport = await exportPng(); const p = await point(page, 1000, 550); await page.mouse.click(p.x, p.y);
  await expect(surface(page)).toHaveAttribute('data-selected-shape', ''); expect((await exportPng()).equals(selectedExport)).toBe(true);
  await button(page, 'Pen').click(); await drag(page, 100, 500, 500, 500);
  const firstId = await surface(page).getAttribute('data-page-id');
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Add page').click(); await button(page, 'Close pages').click(); await createShape(page, 'Triangle');
  await select(page); await button(page, 'Delete shape').click(); await button(page, 'Undo').click(); await expect(surface(page)).toHaveAttribute('data-shape-count', '1');
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Move page 1 later').click();
  await button(page, 'Delete page 2').click(); await page.getByRole('dialog', { name: 'Delete this page?' }).getByRole('button', { name: 'Delete page', exact: true }).click();
  await button(page, 'Restore deleted page 1').click(); await button(page, 'Close pages').click();
  await expect(surface(page)).toHaveAttribute('data-page-id', firstId!); expect(await currentShapes(page)).toEqual(edited);
  await button(page, 'Clear').click(); await button(page, 'Cancel').click(); expect(await currentShapes(page)).toEqual(edited);
  await button(page, 'Clear').click(); await page.getByRole('dialog').getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0'); expect(await currentShapes(page)).toEqual([]);
  await button(page, 'Undo').click(); expect(await currentShapes(page)).toEqual(edited); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  await button(page, 'Redo').click(); expect(await currentShapes(page)).toEqual([]); await button(page, 'Undo').click(); await savedRecord(page);
  const url = page.url(); await page.reload(); expect(await currentShapes(page)).toEqual(edited);
  await button(page, '← Back').click(); await button(page, 'Whiteboard').click(); await button(page, 'Recent boards').click();
  await page.getByRole('button').filter({ hasText: 'Board ' + new URL(url).searchParams.get('session')!.slice(0, 8) }).click(); expect(await currentShapes(page)).toEqual(edited);
});

test('overlapping shapes use stacking order; keyboard selection, editing, deletion and Undo work', async ({ page }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click(); await createShape(page); await createShape(page, 'Circle');
  const shapes = await currentShapes(page); await select(page); await expect(surface(page)).toHaveAttribute('data-selected-shape', shapes[1]!.id);
  await page.keyboard.press('Delete'); expect(await currentShapes(page)).toEqual([shapes[0]]); await button(page, 'Undo').click();
  expect(await currentShapes(page)).toEqual(shapes); await button(page, 'Next shape').click(); await expect(surface(page)).toHaveAttribute('data-selected-shape', shapes[0]!.id);
  await page.keyboard.press('ArrowRight'); expect((await currentShapes(page))[0]).not.toEqual(shapes[0]);
  const handle = button(page, 'Resize shape se'); await handle.focus(); await page.keyboard.press('ArrowRight');
  await button(page, 'Rotate shape').focus(); await page.keyboard.press('ArrowRight');
  const changed = (await currentShapes(page))[0]!; expect('rotation' in changed && changed.rotation).toBe(10);
  await surface(page).focus(); await page.keyboard.press('Backspace'); expect(await currentShapes(page)).toEqual([shapes[1]]);
  await button(page, 'Undo').click(); expect((await currentShapes(page))[0]).toEqual(changed);
});
