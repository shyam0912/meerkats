import { test, expect } from '@playwright/test';
import { capacityRecord } from '../helpers/capacity';

test('immediate Redo reload either recovers or offers Stay until durable', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Whiteboard', exact: true }).click();
  const surface = page.getByRole('region', { name: 'Whiteboard drawing surface' });
  await expect(surface).toBeVisible();
  await page.getByRole('button', { name: /^Pages/ }).click();
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.getByRole('button', { name: 'Close pages' }).click();
  const b = (await surface.boundingBox())!;
  for (const x of [.3, .6]) await page.mouse.click(b.x + b.width * x, b.y + b.height / 2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(surface).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  let guarded = false;
  page.on('dialog', async dialog => { expect(dialog.type()).toBe('beforeunload'); guarded = true; await dialog.dismiss(); });
  // A cancelled navigation has no load event; bound the navigation wait, not the durability assertion.
  await page.reload({ timeout: 5000 }).catch(error => { if (!guarded) throw error; });
  console.log('Immediate reload beforeunload guard:', guarded);
  await expect(surface).toHaveAttribute('data-ink-count', '2');
  await expect(page.getByRole('status')).toHaveText('Saved on this device');
  await page.reload();
  await expect(surface).toHaveAttribute('data-ink-count', '2');
  await expect(page.getByRole('button', { name: 'Pages · 2 of 2', exact: true })).toBeVisible();
});

for (const bytes of [2096000, 2097152]) test(`capacity ${bytes} bytes rejects excess ink without damaging recovery`, async ({ page }) => {
  const record = capacityRecord(bytes);
  await page.goto('/');
  await page.evaluate(async record => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('meerkats-teaching-v1', 2);
      r.onupgradeneeded = () => { r.result.createObjectStore('sessions'); r.result.createObjectStore('migrationBackups'); };
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put(record, record.snapshot.identity.id); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
    db.close();
  }, record);
  await page.goto(`/workspace?session=${record.snapshot.identity.id}`);
  const surface = page.getByRole('region', { name: 'Whiteboard drawing surface' });
  await expect(surface).toHaveAttribute('data-ink-count', '1');
  await expect(page.getByRole('status')).toHaveText('Saved on this device');
  const b = (await surface.boundingBox())!;
  await page.mouse.move(b.x + b.width * .2, b.y + b.height * .3); await page.mouse.down();
  await page.mouse.move(b.x + b.width * .8, b.y + b.height * .7, { steps: 100 }); await page.mouse.up();
  await expect(page.getByRole('alert').filter({ hasText: 'Board capacity reached' })).toBeVisible();
  await expect(surface).toHaveAttribute('data-ink-count', '1');
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('status')).toHaveText('Saved on this device');
  await page.screenshot({ path: test.info().outputPath(`capacity-${bytes}.png`) });
  await page.reload(); await expect(surface).toHaveAttribute('data-ink-count', '1');
  const recovered = await page.evaluate(async id => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('meerkats-teaching-v1', 2); r.onsuccess = () => resolve(r.result); });
    const result = await new Promise<unknown>(resolve => { const r = db.transaction('sessions').objectStore('sessions').get(id); r.onsuccess = () => resolve(r.result.snapshot.whiteboard); });
    db.close(); return result;
  }, record.snapshot.identity.id);
  expect(recovered).toEqual(record.snapshot.whiteboard);
});
