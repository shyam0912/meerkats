import { test, reloadBoard, openRecentBoard } from '../helpers/board-browser';
import { expect } from '@playwright/test';
import { button, surface, point, drag, savedRecord, createShape } from '../helpers/shape-editing';

const mixed = 'English + മലയാളം\nക്ഷേത്രം, ക്ക, ങ്ങ, ന്ത — H₂O!';
async function texts(page: import('@playwright/test').Page) {
  const board = (await savedRecord(page)).snapshot.whiteboard;
  if (board.schemaVersion !== 4) throw new Error('Expected text document v4');
  return board.pages.find(p => p.id === board.activePageId)!.texts;
}
async function insert(page: import('@playwright/test').Page, value = mixed) {
  await button(page, 'Text').click(); const p = await point(page, 120, 140); await page.mouse.click(p.x, p.y);
  await page.getByRole('textbox', { name: 'Board text' }).fill(value); await button(page, 'Apply text').click();
  await expect(surface(page)).toHaveAttribute('data-text-count', '1');
}
for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`English/Malayalam editing, movement, recovery and export at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport); await page.goto('/'); await button(page, 'Whiteboard').click();
    await insert(page); await expect(surface(page)).toHaveAttribute('data-text-font-ready', 'true');
    const original = (await texts(page))[0]!; expect(original.text).toBe(mixed);
    await page.screenshot({ path: info.outputPath(`text-${viewport.width}.png`) });
    await button(page, 'Edit text').click();
    await page.getByRole('textbox', { name: 'Board text' }).fill(mixed + '\nScience — ശാസ്ത്രം');
    await page.getByLabel('Text colour').fill('#225eaf'); await page.getByLabel('Font size').selectOption('40');
    await expect(button(page, 'Pen')).toBeDisabled(); await expect(button(page, 'Undo')).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText('Text draft · Apply to save');
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: info.outputPath(`text-editor-${viewport.width}.png`) });
    await button(page, 'Apply text').click(); const edited = (await texts(page))[0]!;
    expect(edited.id).toBe(original.id); expect(edited.color).toBe('#225eaf'); expect(edited.fontSize).toBe(40);
    await button(page, 'Undo').click(); expect(await texts(page)).toEqual([original]); await button(page, 'Redo').click(); expect(await texts(page)).toEqual([edited]);
    const rev = Number(await surface(page).getAttribute('data-revision'));
    await drag(page, edited.origin.x + 30, edited.origin.y + 30, edited.origin.x + 120, edited.origin.y + 80);
    const moved = (await texts(page))[0]!; expect(moved.origin).not.toEqual(edited.origin);
    await expect(surface(page)).toHaveAttribute('data-revision', String(rev + 1));
    await button(page, 'Undo').click(); expect(await texts(page)).toEqual([edited]); await button(page, 'Redo').click();
    const download = page.waitForEvent('download'); await button(page, 'Export PNG').click(); const file = await download;
    await file.saveAs(info.outputPath(`text-export-${viewport.width}.png`));
    await button(page, 'Delete text').click(); expect(await texts(page)).toEqual([]); await button(page, 'Undo').click(); expect(await texts(page)).toEqual([moved]);
    await reloadBoard(page); expect(await texts(page)).toEqual([moved]); await button(page, 'Select').click(); await button(page, 'Next text').click();
    await button(page, 'Edit text').click(); await expect(page.getByRole('textbox', { name: 'Board text' })).toHaveValue(moved.text); await button(page, 'Cancel text').click();
    await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
    const canvas = (await surface(page).boundingBox())!; const actions = (await page.getByRole('group', { name: 'Selected object actions' }).boundingBox())!;
    expect(actions.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
    for (const name of ['Text', 'Edit text', 'Delete text', 'Pen', 'Clear']) { const b = (await button(page, name).boundingBox())!; expect(b.height).toBeGreaterThanOrEqual(56); expect(b.x + b.width).toBeLessThanOrEqual(viewport.width); }
  });
}

test('IME composition, cancelled drafts, text limits and interrupted movement preserve history', async ({ page }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click(); await button(page, 'Text').click();
  const p = await point(page, 120, 140); await page.mouse.click(p.x, p.y); const field = page.getByRole('textbox', { name: 'Board text' });
  await field.dispatchEvent('compositionstart', { data: '' }); await field.fill('ക്');
  await field.dispatchEvent('keydown', { key: 'Escape', isComposing: true }); await expect(field).toBeVisible(); await expect(button(page, 'Apply text')).toBeDisabled();
  await field.fill(mixed); await field.dispatchEvent('compositionend', { data: mixed }); await button(page, 'Apply text').click();
  const original = await texts(page); const revision = await surface(page).getAttribute('data-revision');
  await button(page, 'Edit text').click(); await field.fill('Cancelled'); await field.press('Escape');
  expect(await texts(page)).toEqual(original); await expect(surface(page)).toHaveAttribute('data-revision', revision!);
  await button(page, 'Edit text').click(); await field.fill('മ'.repeat(4097)); await button(page, 'Apply text').click();
  await expect(page.getByRole('alert')).toContainText('Text must fit'); await button(page, 'Cancel text').click();
  expect(await texts(page)).toEqual(original);
  const a = await point(page, 150, 170); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 50, a.y + 20); await page.keyboard.press('Escape'); await page.mouse.up();
  expect(await texts(page)).toEqual(original); await expect(surface(page)).toHaveAttribute('data-revision', revision!);
});

test('text, shapes and ink share atomic Clear and retain page recovery and Recent Boards', async ({ page }) => {
  await page.goto('/'); await button(page, 'Whiteboard').click(); await insert(page); const original = await texts(page); const url = page.url();
  await createShape(page); await button(page, 'Pen').click(); await drag(page, 60, 450, 500, 450);
  await button(page, 'Clear').click(); await button(page, 'Cancel').click(); expect(await texts(page)).toEqual(original);
  await button(page, 'Clear').click(); await page.getByRole('dialog').getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-text-count', '0'); await expect(surface(page)).toHaveAttribute('data-shape-count', '0'); await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
  await button(page, 'Undo').click(); expect(await texts(page)).toEqual(original); await expect(surface(page)).toHaveAttribute('data-shape-count', '1'); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  await button(page, 'Redo').click(); expect(await texts(page)).toEqual([]); await button(page, 'Undo').click();
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Add page').click(); await button(page, 'Close pages').click();
  await expect(surface(page)).toHaveAttribute('data-text-count', '0'); await expect(button(page, 'Undo')).toBeDisabled();
  await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Move page 1 later').click(); await button(page, 'Delete page 2').click();
  await page.getByRole('dialog', { name: 'Delete this page?' }).getByRole('button', { name: 'Delete page', exact: true }).click();
  await button(page, 'Restore deleted page 1').click(); await button(page, 'Open page 2').click(); expect(await texts(page)).toEqual(original);
  await savedRecord(page); await reloadBoard(page); expect(await texts(page)).toEqual(original);
  await button(page, '← Back').click(); await button(page, 'Whiteboard').click(); await button(page, 'Recent boards').click();
  await openRecentBoard(page, new URL(url).searchParams.get('session')!);
  await expect(page).toHaveURL(url); expect(await texts(page)).toEqual(original);
});
