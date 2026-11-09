import { expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { test, openRecentBoard, reloadBoard } from '../helpers/board-browser';
import { button, createShape, currentShapes, point, savedRecord, surface } from '../helpers/shape-editing';

for (const shape of ['Line', 'Arrow', 'Rectangle', 'Circle', 'Triangle']) {
  test(`duplicate a ${shape} as one reversible action`, async ({ page }) => {
    await page.goto('/'); await button(page, 'Whiteboard').click(); await createShape(page, shape);
    await button(page, 'Select').click(); await button(page, 'Next shape').click();
    if (shape !== 'Circle') await button(page, 'Rotate shape').press('ArrowRight');
    const [source] = await currentShapes(page);
    const revision = Number(await surface(page).getAttribute('data-revision'));
    await button(page, 'Duplicate').click();
    const copies = await currentShapes(page); expect(copies).toHaveLength(2); expect(copies[0]).toEqual(source);
    const copy = copies[1]!; expect(copy.id).not.toBe(source!.id);
    await expect(surface(page)).toHaveAttribute('data-selected-shape', copy.id);
    await expect(surface(page)).toHaveAttribute('data-revision', String(revision + 1));
    await button(page, 'Undo').click(); expect(await currentShapes(page)).toEqual([source]);
    await button(page, 'Redo').click(); expect(await currentShapes(page)).toEqual(copies);
  });
}

async function currentTexts(page: Page) {
  const doc = (await savedRecord(page)).snapshot.whiteboard;
  if (doc.schemaVersion !== 4) throw new Error('Expected v4 board');
  return doc.pages.find(p => p.id === doc.activePageId)!.texts;
}
async function png(page: Page, path: string) {
  const downloading = page.waitForEvent('download'); await button(page, 'Export PNG').click();
  await (await downloading).saveAs(path); await button(page, 'Dismiss export message').click();
  return readFile(path);
}
async function thumbnail(page: Page) {
  await page.getByRole('button', { name: /^Pages ·/ }).click();
  const image = button(page, 'Open page 1').locator('img'); await expect(image).toBeVisible();
  const pixels = await image.evaluate(async (img: HTMLImageElement) => {
    await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0); return c.toDataURL();
  });
  await button(page, 'Close pages').click(); return pixels;
}

for (const [width, height, value] of [[1920, 1080, 'Parallel lines'], [1280, 720, 'സമാന്തര രേഖകൾ'], [1024, 600, 'A · സമാന്തരം\nLine B']] as const) {
  test(`text duplicate, compact controls and recovery at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height }); await page.goto('/'); await button(page, 'Whiteboard').click();
    await createShape(page); await button(page, 'Text').click();
    const p = await point(page, 665, 280); await page.mouse.click(p.x, p.y);
    await page.getByRole('textbox', { name: 'Board text' }).fill(value);
    await page.getByLabel('Text colour').fill('#225eaf'); await page.getByLabel('Font size').selectOption('40');
    const editor = page.getByRole('region', { name: 'Edit board text' });
    await expect(editor).toBeVisible();
    const editorBox = (await editor.boundingBox())!, editingCanvas = (await surface(page).boundingBox())!;
    expect(editorBox.y).toBeGreaterThanOrEqual(editingCanvas.y + editingCanvas.height - 1);
    expect(editingCanvas.height).toBeGreaterThan(height * .58);
    await page.screenshot({ path: info.outputPath(`editor-${width}.png`) });
    await button(page, 'Apply text').click();
    const [source] = await currentTexts(page);
    const before = await thumbnail(page);
    const originalPng = await png(page, info.outputPath('original.png'));
    await button(page, 'Duplicate').press('Enter');
    const texts = await currentTexts(page); expect(texts).toHaveLength(2); expect(texts[0]).toEqual(source);
    const copy = texts[1]!; expect(copy.id).not.toBe(source!.id);
    expect(copy).toEqual({ ...source, id: copy.id, origin: { x: source!.origin.x + 24, y: source!.origin.y + 24 } });
    await expect(surface(page)).toHaveAttribute('data-selected-text', copy.id);
    const controls = (await page.getByRole('group', { name: 'Selected object actions' }).boundingBox())!;
    const board = (await surface(page).boundingBox())!;
    expect(controls.y).toBeGreaterThanOrEqual(board.y + board.height - 1);
    for (const name of ['Next shape', 'Next text', 'Edit text', 'Duplicate', 'Delete text']) {
      const box = (await button(page, name).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(56); expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    await page.screenshot({ path: info.outputPath(`selection-${width}.png`) });
    expect(await thumbnail(page)).not.toBe(before);
    const selectedPng = await png(page, info.outputPath(`copies-${width}.png`));
    expect(selectedPng.equals(originalPng)).toBe(false);
    await surface(page).press('Escape');
    expect((await png(page, info.outputPath('unselected.png'))).equals(selectedPng)).toBe(true);
    await button(page, 'Undo').click(); expect(await currentTexts(page)).toEqual([source]);
    await button(page, 'Redo').click(); expect(await currentTexts(page)).toEqual(texts);
    await button(page, 'Clear').click(); await page.getByRole('dialog').getByRole('button', { name: 'Clear', exact: true }).click();
    expect(await currentTexts(page)).toEqual([]); await button(page, 'Undo').click(); expect(await currentTexts(page)).toEqual(texts);
    await reloadBoard(page); expect(await currentTexts(page)).toEqual(texts);
    const sessionId = new URL(page.url()).searchParams.get('session')!;
    await button(page, '← Back').click(); await button(page, 'Whiteboard').click(); await button(page, 'Recent boards').click();
    await openRecentBoard(page, sessionId); expect(await currentTexts(page)).toEqual(texts);
  });
}
