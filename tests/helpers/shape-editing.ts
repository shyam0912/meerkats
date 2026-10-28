import { expect, type Page } from '@playwright/test';
import type { LocalRecord } from '../../src/persistence/database';
export const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
export const surface = (page: Page) => page.getByRole('region', { name: 'Whiteboard drawing surface' });
export async function point(page: Page, x: number, y: number) {
  const b = (await surface(page).boundingBox())!; return { x: b.x + x * b.width / 1200, y: b.y + y * b.height / 675 };
}
export async function drag(page: Page, x: number, y: number, endX: number, endY: number) {
  const a = await point(page, x, y); const b = await point(page, endX, endY);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up();
}
export async function createShape(page: Page, name = 'Rectangle') {
  await button(page, 'Shapes').click(); await button(page, name).click(); await button(page, 'Close shapes').click();
  await drag(page, 300, 220, 500, 420);
}
export async function select(page: Page, x = 400, y = 320) {
  await button(page, 'Select').click(); const p = await point(page, x, y); await page.mouse.click(p.x, p.y);
  await expect(surface(page)).not.toHaveAttribute('data-selected-shape', '');
}
export async function handleDrag(page: Page, name: string, dx: number, dy: number) {
  const b = (await button(page, name).boundingBox())!; const scene = (await surface(page).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx * scene.width / 1200, b.y + b.height / 2 + dy * scene.height / 675, { steps: 12 }); await page.mouse.up();
}
export async function savedRecord(page: Page): Promise<LocalRecord> {
  await expect(page.getByRole('status')).toHaveText(/Saved on this device|Ink synced/);
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('meerkats-teaching-v1', 3); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { return await new Promise<LocalRecord>((resolve, reject) => { const tx = db.transaction('sessions'); const r = tx.objectStore('sessions').get(new URL(location.href).searchParams.get('session')!);
      tx.oncomplete = () => resolve(r.result as LocalRecord); tx.onabort = () => reject(tx.error); }); } finally { db.close(); }
  });
}
export async function currentShapes(page: Page) {
  const board = (await savedRecord(page)).snapshot.whiteboard;
  if (board.schemaVersion !== 3) throw new Error('Expected v3');
  return board.pages.find(p => p.id === board.activePageId)!.shapes;
}
