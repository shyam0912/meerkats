import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createDrawingSession } from '../../src/drawing/session';
import { serializeSession } from '../../src/persistence/serialization';
import { newRecord } from '../../src/persistence/database';
const surface = (page: Page) => page.getByRole('region', { name: 'Whiteboard drawing surface' });
async function open(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await expect(surface(page)).toBeVisible(); }
async function pages(page: Page) { await page.getByRole('button', { name: /^Pages ·/ }).click(); }
async function dot(page: Page) { const b = (await surface(page).boundingBox())!; await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
async function select(page: Page, n: number) { await pages(page); await page.getByRole('button', { name: `Open page ${n}`, exact: true }).click(); }

test('legacy browser storage migrates without loss and exposes the original recovery snapshot', async ({ page }) => {
  const identity = { id: randomUUID(), context: { classId: null, subjectId: null, classLabel: '', subjectLabel: '' } };
  const session = createDrawingSession({ sessionId: identity.id, classId: null, subjectId: null }, { whiteboard: randomUUID(), annotation: randomUUID() });
  const snapshot = serializeSession(session, identity, null); const board = snapshot.whiteboard;
  const original = newRecord({ ...snapshot, whiteboard: { schemaVersion: 1, id: board.id, owner: board.owner, bounds: board.bounds, localRevision: 2,
    objects: [{ id: randomUUID(), kind: 'ink', tool: 'pen', color: '#000000', width: 10, points: [600, 337] }] } });
  await page.goto('/');
  await page.evaluate(async record => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const req = indexedDB.open('meerkats-teaching-v1', 1); req.onupgradeneeded = () => req.result.createObjectStore('sessions'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('sessions', 'readwrite'); tx.objectStore('sessions').put(record, record.snapshot.identity.id); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); db.close();
  }, original);
  await page.goto(`/workspace?session=${identity.id}`); await expect(surface(page)).toHaveAttribute('data-document-id', board.id);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1'); await pages(page);
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download original v1 backup' }).click();
  expect(JSON.parse(await readFile((await (await downloaded).path())!, 'utf8'))).toEqual(original);
  await page.getByRole('button', { name: 'Recover original as a page' }).click(); await page.keyboard.press('Escape');
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1'); await expect(surface(page)).not.toHaveAttribute('data-page-id', board.id);
  await expect(page.getByRole('status')).toHaveText('Saved on this device'); await page.reload();
  await expect(page.getByRole('button', { name: 'Pages · 2 of 2', exact: true })).toBeVisible(); await select(page, 1);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
});

test('paper survives ink erasing and current-page PNG includes the selected background', async ({ page }) => {
  await open(page); await pages(page); await page.getByRole('button', { name: 'Square grid', exact: true }).click(); await page.keyboard.press('Escape');
  await dot(page); await page.getByRole('button', { name: 'Eraser', exact: true }).click(); await dot(page);
  await expect(surface(page).locator('svg')).toBeVisible();
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export PNG' }).click();
  const bytes = await readFile((await (await downloaded).path())!);
  const pixels = await page.evaluate(async base64 => {
    const image = new Image(); image.src = 'data:image/png;base64,' + base64; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    return [[1200, 675], [1220, 675]].map(([x, y]) => Array.from(ctx.getImageData(x!, y!, 1, 1).data));
  }, bytes.toString('base64'));
  expect(pixels[0]).toEqual([184, 201, 197, 255]); expect(pixels[1]).toEqual([255, 255, 255, 255]);
});

test('pages isolate ink/history, reorder by identity, and recover deletion and backgrounds after reload', async ({ page }) => {
  await open(page); await dot(page); const first = await surface(page).getAttribute('data-page-id'); const board = await surface(page).getAttribute('data-document-id');
  await pages(page); await page.getByRole('button', { name: 'Lined', exact: true }).click(); await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.getByRole('button', { name: 'Square grid', exact: true }).click(); await page.getByRole('button', { name: 'Close pages' }).click();
  const second = await surface(page).getAttribute('data-page-id'); expect(second).not.toBe(first);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0'); await dot(page); await dot(page);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  await select(page, 1); await expect(surface(page)).toHaveAttribute('data-ink-count', '1'); await expect(surface(page)).toHaveAttribute('data-background', 'lined');
  await page.getByRole('button', { name: 'Clear ink', exact: true }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1'); await page.getByRole('button', { name: 'Clear ink', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear ink', exact: true }).click(); await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await select(page, 2);
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(surface(page)).toHaveAttribute('data-ink-count', '2');
  await pages(page); await page.getByRole('button', { name: 'Move page 2 earlier', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open page 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Delete page 1', exact: true }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open page 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete page 1', exact: true }).click(); await page.getByRole('button', { name: 'Delete page', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete page 1', exact: true })).toBeDisabled(); await page.getByRole('button', { name: 'Close pages' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved on this device'); await page.reload();
  await expect(surface(page)).toHaveAttribute('data-page-id', first!); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  await pages(page); await page.getByRole('button', { name: 'Restore deleted page 1', exact: true }).click(); await page.getByRole('button', { name: 'Close pages' }).click();
  await expect(surface(page)).toHaveAttribute('data-page-id', second!); await expect(surface(page)).toHaveAttribute('data-background', 'grid');
  await expect(surface(page)).toHaveAttribute('data-ink-count', '2'); await expect(surface(page)).toHaveAttribute('data-document-id', board!);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`pages and backgrounds remain touchable and bounded at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport); await open(page); await pages(page);
    await page.getByRole('button', { name: 'Add page', exact: true }).click(); await page.getByRole('button', { name: 'Dotted', exact: true }).click();
    for (const name of ['Close pages', 'Add page', 'White', 'Lined', 'Dotted', 'Square grid']) {
      const b = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(56); expect(b.height).toBeGreaterThanOrEqual(56);
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(page.getByRole('button', { name: 'Open page 1', exact: true }).locator('img')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: /^Pages ·/ })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  });
}

for (const pointerType of ['mouse', 'touch']) test(`${pointerType} cancellation leaves no ink and page switching remains safe`, async ({ page }) => {
  await open(page);
  const b = (await surface(page).boundingBox())!; const x = b.x + b.width / 2; const y = b.y + b.height / 2;
  const cdp = await page.context().newCDPSession(page);
  if (pointerType === 'touch') await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 7 }] });
  else { await page.mouse.move(x, y); await page.mouse.down(); }
  await expect(page.getByRole('button', { name: /^Pages ·/ })).toBeDisabled();
  if (pointerType === 'touch') await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  else { await surface(page).dispatchEvent('pointercancel', { pointerId: 1, pointerType }); await page.mouse.up(); }
  await cdp.detach();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0'); await pages(page); await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.keyboard.press('Escape'); await dot(page); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  await select(page, 1); await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
});
