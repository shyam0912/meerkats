import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { test, reloadBoard, openRecentBoard } from '../helpers/board-browser';
import { button, createShape, drag, point, savedRecord, surface } from '../helpers/shape-editing';

async function contents(page: Page) {
  const board = (await savedRecord(page)).snapshot.whiteboard;
  if (board.schemaVersion !== 4) throw new Error('Expected unchanged document v4');
  return board.pages.find(p => p.id === board.activePageId)!;
}
async function tap(page: Page, x: number, y: number) { const p = await point(page, x, y); await page.mouse.click(p.x, p.y); }
async function setup(page: Page) {
  await page.goto('/'); await button(page, 'Whiteboard').click();
  await button(page, 'Shapes').click(); await button(page, 'Rectangle').click(); await button(page, 'Close shapes').click();
  await drag(page, 180, 180, 380, 330);
  await button(page, 'Shapes').click(); await button(page, 'Triangle').click(); await button(page, 'Close shapes').click();
  await drag(page, 470, 190, 650, 340);
  await button(page, 'Text').click(); await tap(page, 750, 220);
  await page.getByRole('textbox', { name: 'Board text' }).fill('Hello മലയാളം\nLine 2!');
  await button(page, 'Apply text').click(); await surface(page).press('Escape');
  return contents(page);
}
async function marquee(page: Page) {
  await drag(page, 100, 100, 1150, 500); await expect(surface(page)).toHaveAttribute('data-selected-count', '3');
}

for (const [width, height] of [[1920, 1080], [1280, 720], [1024, 600]]) {
  test(`mixed selection batch history, PNG and recovery at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width: width!, height: height! }); const original = await setup(page);
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await button(page, 'Select multiple').click();
    await tap(page, 250, 240); await tap(page, 560, 280); await tap(page, 800, 250);
    await expect(surface(page)).toHaveAttribute('data-selected-count', '3');
    await tap(page, 250, 240); await expect(surface(page)).toHaveAttribute('data-selected-count', '2');
    await tap(page, 250, 240); await button(page, 'Select multiple').click();
    const rev = Number(await surface(page).getAttribute('data-revision'));
    await drag(page, 250, 240, 280, 260); const moved = await contents(page);
    expect(moved.shapes[0]).toMatchObject({ ...original.shapes[0], origin: { x: expect.closeTo(210, 3), y: expect.closeTo(200, 3) } });
    expect(moved.texts[0]).toEqual({ ...original.texts[0], origin: { x: expect.closeTo(original.texts[0]!.origin.x + 30, 3), y: expect.closeTo(original.texts[0]!.origin.y + 20, 3) } });
    await expect(surface(page)).toHaveAttribute('data-revision', String(rev + 1));
    await button(page, 'Undo').click(); expect(await contents(page)).toEqual(original);
    await button(page, 'Redo').click(); expect(await contents(page)).toEqual(moved);
    await button(page, 'Duplicate').click(); const copied = await contents(page);
    expect(copied.shapes).toHaveLength(4); expect(copied.texts).toHaveLength(2);
    expect(new Set([...copied.shapes, ...copied.texts].map(o => o.id)).size).toBe(6);
    await button(page, 'Undo').click(); expect(await contents(page)).toEqual(moved);
    await button(page, 'Redo').click(); expect(await contents(page)).toEqual(copied);
    await surface(page).press('Escape'); await drag(page, 100, 100, 1180, 550);
    await expect(surface(page)).toHaveAttribute('data-selected-count', '6');
    const canvas = (await surface(page).boundingBox())!;
    const controls = (await page.getByRole('group', { name: 'Selected object actions' }).boundingBox())!;
    expect(controls.y).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
    for (const name of ['Select multiple', 'Duplicate', 'Delete selected', 'Undo', 'Redo']) {
      const b = (await button(page, name).boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(56); expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(width!); expect(b.y + b.height).toBeLessThanOrEqual(height!);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`multi-${width}.png`) });
    async function png(name: string) {
      const pending = page.waitForEvent('download'); await button(page, 'Export PNG').click(); const download = await pending;
      const path = info.outputPath(name); await download.saveAs(path); await button(page, 'Dismiss export message').click(); return readFile(path);
    }
    const selectedPng = await png('selected.png'); await surface(page).press('Escape');
    expect((await png('without-controls.png')).equals(selectedPng)).toBe(true);
    await drag(page, 100, 100, 1180, 550); await button(page, 'Delete selected').click();
    expect((await contents(page)).shapes).toEqual([]); expect((await contents(page)).texts).toEqual([]);
    await button(page, 'Undo').click(); expect(await contents(page)).toEqual(copied);
    await button(page, 'Clear').click(); await page.getByRole('dialog').getByRole('button', { name: 'Clear', exact: true }).click();
    expect((await contents(page)).shapes).toEqual([]); await button(page, 'Undo').click(); expect(await contents(page)).toEqual(copied);
    await page.getByRole('button', { name: /^Pages ·/ }).click(); await expect(button(page, 'Open page 1').locator('img')).toBeVisible();
    await button(page, 'Add page').click(); await button(page, 'Open page 2').click();
    await expect(surface(page)).toHaveAttribute('data-selected-count', '0'); expect((await contents(page)).shapes).toEqual([]);
    await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Open page 1').click(); expect(await contents(page)).toEqual(copied);
    await reloadBoard(page); expect(await contents(page)).toEqual(copied); await expect(surface(page)).toHaveAttribute('data-selected-count', '0');
    const sessionId = new URL(page.url()).searchParams.get('session')!;
    await button(page, '← Back').click(); await button(page, 'Whiteboard').click(); await button(page, 'Recent boards').click();
    await openRecentBoard(page, sessionId); expect(await contents(page)).toEqual(copied); expect(errors).toEqual([]);
  });
}
test('marquee containment, overlap cycling, cancellation, keyboard and simulated touch', async ({ page, context }) => {
  const original = await setup(page);
  await drag(page, 100, 100, 379, 400); await expect(surface(page)).toHaveAttribute('data-selected-count', '0');
  await marquee(page);
  const beforeRevision = await surface(page).getAttribute('data-revision');
  for (const cancel of ['Escape', 'pointercancel']) {
    const a = await point(page, 250, 240); const b = await point(page, 300, 290);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 });
    if (cancel === 'Escape') await page.keyboard.press('Escape');
    else await surface(page).dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true });
    await page.mouse.up(); expect(await contents(page)).toEqual(original);
    await expect(surface(page)).toHaveAttribute('data-revision', beforeRevision!);
    await surface(page).press('Escape'); await marquee(page);
  }
  await surface(page).press('ArrowRight'); const moved = await contents(page);
  expect(moved.texts[0]!.origin.x).toBe(original.texts[0]!.origin.x + 10);
  await button(page, 'Undo').click(); expect(await contents(page)).toEqual(original);
  const cdp = await context.newCDPSession(page); const a = await point(page, 250, 240); const b = await point(page, 280, 260);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x, y: b.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await contents(page)).toEqual(original);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }, { x: b.x + 150, y: b.y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x, y: b.y, id: 1 }, { x: b.x + 150, y: b.y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const touched = await contents(page); expect(touched.texts[0]!.origin.x).toBeCloseTo(original.texts[0]!.origin.x + 30, 2);
  await button(page, 'Undo').click(); expect(await contents(page)).toEqual(original);
  await surface(page).press('Escape'); await button(page, 'Select multiple').click();
  await button(page, 'Next shape').click(); await button(page, 'Next shape').click(); await button(page, 'Next text').click();
  await expect(surface(page)).toHaveAttribute('data-selected-count', '3');
  await button(page, 'Select multiple').click(); await drag(page, 250, 240, 2000, 1500);
  const edge = await contents(page); expect(edge.shapes[0]).not.toEqual(original.shapes[0]);
  await button(page, 'Undo').click(); expect(await contents(page)).toEqual(original);
});

test('all five overlapping shapes and multilingual text can be selected and duplicated together', async ({ page }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click();
  for (const kind of ['Line', 'Arrow', 'Rectangle', 'Circle', 'Triangle']) await createShape(page, kind);
  await button(page, 'Select').click(); await button(page, 'Next shape').click(); await button(page, 'Next shape').click();
  await button(page, 'Next shape').click(); await button(page, 'Rotate shape').press('ArrowRight');
  await button(page, 'Text').click(); await tap(page, 300, 220);
  await page.getByRole('textbox', { name: 'Board text' }).fill('Overlap മലയാളം'); await button(page, 'Apply text').click();
  const original = await contents(page); await surface(page).press('Escape'); await button(page, 'Select multiple').click();
  for (let i = 0; i < 5; i++) await button(page, 'Next shape').click();
  await button(page, 'Next text').click(); await expect(surface(page)).toHaveAttribute('data-selected-count', '6');
  await button(page, 'Select multiple').click();
  const a = await point(page, 30, 30); const b = await point(page, 1100, 600);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y);
  await surface(page).dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true }); await page.mouse.up();
  await expect(surface(page)).toHaveAttribute('data-selected-count', '6'); expect(await contents(page)).toEqual(original);
  await button(page, 'Duplicate').click(); const after = await contents(page);
  expect(after.shapes).toHaveLength(10); expect(after.texts).toHaveLength(2);
  expect(new Set([...after.shapes, ...after.texts].map(o => o.id)).size).toBe(12);
  expect(after.shapes.slice(0, 5)).toEqual(original.shapes);
  expect(after.shapes.slice(5).map(o => o.shape)).toEqual(original.shapes.map(o => o.shape));
  await button(page, 'Undo').click(); expect(await contents(page)).toEqual(original);
  await button(page, 'Redo').click(); expect(await contents(page)).toEqual(after);
  await button(page, 'Text').click(); await tap(page, 310, 230);
  await expect(page.getByRole('textbox', { name: 'Board text' })).toHaveValue('Overlap മലയാളം');
  await button(page, 'Cancel text').click(); expect(await contents(page)).toEqual(after);
});
