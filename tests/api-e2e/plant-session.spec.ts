import { test, expect } from '@playwright/test';
import { launchPlant, plantMore } from '../helpers/plant';
import { PLANT } from '../../contracts/plant-content';
test('plant multilingual state acknowledges and recovers on a fresh browser with malformed state rejected',async({page,browser})=>{
  await launchPlant(page);await plantMore(page);await page.getByRole('button',{name:'Show whole plant'}).click();
  await plantMore(page);await page.getByRole('button',{name:'Change plant language'}).click();await page.getByRole('button',{name:'Close plant settings'}).click();
  await page.getByRole('button',{name:'Water demonstration'}).click();
  await expect(page.locator('.interactive-save')).toHaveText('Lesson and ink synced',{timeout:20000});
  const url=page.url(),id=new URL(url).searchParams.get('session');const remote=await(await page.request.get('/api/v1/sessions/'+id)).json();
  expect(remote.progress.states[PLANT.activity].language).toBe('ml');expect(remote.progress.states[PLANT.activity].parts.every((p:{slot:unknown})=>p.slot!==null)).toBe(true);
  const bad=structuredClone(remote.progress);bad.states[PLANT.activity].parts[0].slot='flower';
  expect((await page.request.put(`/api/v1/sessions/${id}/progress`,{data:{mutationId:crypto.randomUUID(),baseServerRevision:remote.progressServerRevision,progress:bad}})).status()).toBe(400);
  const context=await browser.newContext(),restored=await context.newPage();await restored.goto(url);
  await expect(restored.locator('.plant-title')).toHaveText('ഒരു ചെടി ഉണ്ടാക്കാം');await expect(restored.locator('[data-slot="tray"]')).toHaveCount(0);
  await expect(restored.getByTestId('plant-water-visual')).toBeVisible();await context.close();
});
test('plant API outage preserves local progress and immutable retry across reload',async({page})=>{
  await launchPlant(page);await expect(page.locator('.interactive-save')).toHaveText('Lesson and ink synced',{timeout:20000});
  let outage=true;const payloads:string[]=[];
  await page.route('**/api/v1/sessions/*/progress',route=>{payloads.push(route.request().postData()!);return outage?route.abort():route.continue();});
  await plantMore(page);await page.getByRole('button',{name:'Show whole plant'}).click();
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device · Server unavailable',{timeout:20000});
  await page.reload();await expect(page.locator('[data-slot="tray"]')).toHaveCount(0);
  outage=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect(page.locator('.interactive-save')).toHaveText('Lesson and ink synced',{timeout:20000});
  expect(payloads.length).toBeGreaterThanOrEqual(2);expect(new Set(payloads).size).toBe(1);
});
