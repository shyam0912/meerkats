import { test, reloadBoard } from '../helpers/board-browser';
import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { button, surface, point, drag, handleDrag, savedRecord } from '../helpers/shape-editing';

async function content(page: Page) {
  const board = (await savedRecord(page)).snapshot.whiteboard;
  if (board.schemaVersion !== 4) throw new Error('Expected text-capable board');
  return board.pages.find(p => p.id === board.activePageId)!;
}
async function fixture(page: Page) {
  await page.goto('/'); await button(page, 'Whiteboard').click(); await button(page, 'Text').click();
  const p = await point(page, 180, 180); await page.mouse.click(p.x, p.y);
  await page.getByRole('textbox', { name: 'Board text' }).fill('Overlap മലയാളം');
  await page.getByLabel('Font size').selectOption('48'); await button(page, 'Apply text').click();
  await button(page, 'Shapes').click(); await button(page, 'Rectangle').click(); await button(page, 'Close shapes').click();
  await drag(page, 200, 200, 500, 400); await button(page, 'Select').click(); await button(page, 'Next shape').click();
}
for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`selected handles own text overlaps at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await fixture(page);
    const initial = await content(page); const revision = Number(await surface(page).getAttribute('data-revision'));
    await page.screenshot({ path: info.outputPath('before.png') });
    await handleDrag(page, 'Resize shape nw', -40, -30);
    const corrected = await content(page);
    expect(corrected.shapes).not.toEqual(initial.shapes); expect(corrected.texts).toEqual(initial.texts);
    await expect(surface(page)).toHaveAttribute('data-selected-shape', initial.shapes[0]!.id);
    await expect(surface(page)).toHaveAttribute('data-revision', String(revision + 1));
    await page.screenshot({ path: info.outputPath('after.png') });
    await button(page, 'Undo').click(); expect(await content(page)).toEqual(initial);
    await button(page, 'Redo').click(); expect(await content(page)).toEqual(corrected);
    await button(page, 'Undo').click();

    // One large text object covers all corner and rotation handles, not merely glyph pixels.
    await button(page, 'Next text').click(); await button(page, 'Edit text').click();
    await page.getByRole('textbox', { name: 'Board text' }).fill(Array(9).fill('Overlap മലയാളം '.repeat(3)).join('\n'));
    await page.getByLabel('Font size').selectOption('32'); await button(page, 'Apply text').click();
    const t = (await content(page)).texts[0]!;
    await drag(page, t.origin.x + 20, t.origin.y + 20, 100, 40);
    const movedText = (await content(page)).texts[0]!;
    expect(movedText.origin.x).toBeCloseTo(80, 4); expect(movedText.origin.y).toBeCloseTo(20, 4);
    await button(page, 'Shapes').click(); await button(page, 'Triangle').click(); await button(page, 'Close shapes').click();
    await drag(page, 650, 240, 850, 450);
    // A second overlapping shape must not steal the selected rectangle's handles/body either.
    await button(page, 'Shapes').click(); await button(page, 'Rectangle').click(); await button(page, 'Close shapes').click();
    await drag(page, 200, 200, 500, 400); await button(page, 'Select').click(); await button(page, 'Next shape').click();
    for (let index = 0; index < 2; index++) {
      if (index) await button(page, 'Next shape').click();
      for (const name of ['Resize shape nw', 'Resize shape ne', 'Resize shape se', 'Resize shape sw', 'Rotate shape']) {
        const before = await content(page); const rev = Number(await surface(page).getAttribute('data-revision'));
        const handle = (await button(page, name).boundingBox())!; const box = (await surface(page).boundingBox())!;
        const location = { x: (handle.x + handle.width / 2 - box.x) * 1200 / box.width,
          y: (handle.y + handle.height / 2 - box.y) * 675 / box.height };
        const text = before.texts[0]!;
        expect(location.x).toBeGreaterThanOrEqual(text.origin.x); expect(location.x).toBeLessThanOrEqual(text.origin.x + text.size.width);
        expect(location.y).toBeGreaterThanOrEqual(text.origin.y); expect(location.y).toBeLessThanOrEqual(text.origin.y + text.size.height);
        await handleDrag(page, name, name === 'Rotate shape' ? 55 : 20, 15);
        const after = await content(page); expect(after.shapes[index]).not.toEqual(before.shapes[index]);
        expect(after.texts).toEqual(before.texts);
        expect(after.shapes.filter((_, i) => i !== index)).toEqual(before.shapes.filter((_, i) => i !== index));
        await expect(surface(page)).toHaveAttribute('data-selected-shape', before.shapes[index]!.id);
        await expect(surface(page)).toHaveAttribute('data-revision', String(rev + 1));
        await button(page, 'Undo').click(); expect(await content(page)).toEqual(before);
        await button(page, 'Redo').click(); expect(await content(page)).toEqual(after);
        await button(page, 'Undo').click();
      }
    }
    // Next shape cycles back to the first rectangle, whose body also keeps ownership.
    await button(page, 'Next shape').click(); await button(page, 'Next shape').click();
    const beforeMove = await content(page); await drag(page, 350, 300, 380, 320);
    expect((await content(page)).shapes[0]).not.toEqual(beforeMove.shapes[0]);
    expect((await content(page)).texts).toEqual(beforeMove.texts); await button(page, 'Undo').click();
    await surface(page).press('Escape'); const p = await point(page, 350, 300); await page.mouse.click(p.x, p.y);
    await expect(surface(page)).toHaveAttribute('data-selected-text', beforeMove.texts[0]!.id);
    await button(page, 'Edit text').click(); await button(page, 'Cancel text').click();
    await button(page, 'Next shape').click();
    const download = async (name: string) => { const pending = page.waitForEvent('download'); await button(page, 'Export PNG').click();
      const file = await pending; await file.saveAs(info.outputPath(name)); const bytes = await readFile((await file.path())!);
      await button(page, 'Dismiss export message').click(); return bytes; };
    const selected = await download('selected.png'); await surface(page).press('Escape');
    expect((await download('unselected.png')).equals(selected)).toBe(true);
    const final = await content(page); await reloadBoard(page); expect(await content(page)).toEqual(final);
  });
}

test('overlapped handles preserve Escape, pointer cancellation and touch history', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 600 }, hasTouch: true }); const page = await context.newPage();
  await fixture(page); const before = await content(page); const rev = await surface(page).getAttribute('data-revision');
  const h = (await button(page, 'Resize shape nw').boundingBox())!;
  const start = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
  for (const cancel of ['Escape', 'pointercancel']) {
    await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x - 20, start.y - 15);
    if (cancel === 'Escape') await page.keyboard.press('Escape');
    else await surface(page).dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true });
    await page.mouse.up(); expect(await content(page)).toEqual(before); await expect(surface(page)).toHaveAttribute('data-revision', rev!);
    if (cancel === 'Escape') await button(page, 'Next shape').click();
  }
  const cdp = await context.newCDPSession(page);
  for (const cancelled of [true, false]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - 20, y: start.y - 15, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: cancelled ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    const after = await content(page); expect(after.texts).toEqual(before.texts);
    if (cancelled) { expect(after).toEqual(before); await expect(surface(page)).toHaveAttribute('data-revision', rev!); }
    else { expect(after.shapes).not.toEqual(before.shapes); await expect(surface(page)).toHaveAttribute('data-revision', String(Number(rev) + 1));
      await button(page, 'Undo').click(); expect(await content(page)).toEqual(before);
      await button(page, 'Redo').click(); expect(await content(page)).toEqual(after); }
  }
  await context.close();
});
