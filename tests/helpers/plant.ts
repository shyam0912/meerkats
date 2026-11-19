import type { LocalRecord } from '../../src/persistence/database';
import { expect, type Page } from '@playwright/test';
import { PLANT } from '../../contracts/plant-content';
import type { PlantState } from '../../contracts/plant';
export async function launchPlant(page: Page) {
  await page.goto('/catalog');
  for (const name of ['Standard 2','Environmental Studies','Original Demo Concepts','Build a Plant','Start teaching'])
    await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('plant-part-1')).toBeVisible();
}
export async function plantMore(page: Page) { await page.getByRole('button', { name: 'More plant controls' }).click(); }
export async function plantPoint(page: Page, x: number, y: number) {
  const rect = await page.locator('.plant-canvas').boundingBox(); if (!rect) throw new Error('Plant scene missing');
  return { x: rect.x + x * rect.width / 1200, y: rect.y + y * rect.height / 675 };
}
export async function plantDrag(page: Page, from: [number, number], to: [number, number]) {
  const a=await plantPoint(page,...from), b=await plantPoint(page,...to);
  await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.mouse.move(b.x,b.y,{steps:12}); await page.mouse.up();
}
export async function plantRecord(page: Page): Promise<LocalRecord> {
  return page.evaluate(async () => {
    const id=new URL(location.href).searchParams.get('session')!;
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('meerkats-teaching-v1',3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return new Promise((resolve,reject)=>{const tx=db.transaction('sessions'),r=tx.objectStore('sessions').get(id);
      tx.oncomplete=()=>{db.close();resolve(r.result);};tx.onabort=()=>reject(tx.error);
    });
  });
}
export async function plantSaved(page: Page) { await expect(page.locator('.interactive-save')).toHaveText('Saved on this device'); }

export async function savedPlant(page: Page): Promise<{ state: PlantState; revision: number }> {
  const progress=(await plantRecord(page)).snapshot.lesson!.progress;
  const state=progress.states[PLANT.activity]!; if(state.kind!=='plant-builder')throw new Error('Plant state missing');
  return {state, revision:progress.localRevision};
}
