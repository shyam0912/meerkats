import { test, expect } from '@playwright/test';
import { launchPlant, plantMore, plantPoint, plantDrag, plantSaved, savedPlant, plantRecord } from '../helpers/plant';

for (const viewport of [{width:1920,height:1080},{width:1280,height:720},{width:1024,height:600}]) {
  test(`plant assembly, demonstrations, bilingual recovery and focus ${viewport.width}`,async({page},testInfo)=>{
    await page.setViewportSize(viewport); await launchPlant(page);
    await page.screenshot({path:testInfo.outputPath('empty.png')});
    await plantDrag(page,[200,520],[760,178]); await expect(page.getByTestId('plant-part-5')).toHaveAttribute('data-slot','flower');
    await page.getByTestId('plant-part-1').press('Enter'); await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('plant-target-root')).toBeFocused(); await page.keyboard.press('Enter');
    await plantDrag(page,[280,205],[760,342]);
    await page.getByTestId('plant-part-3').press('Enter'); await page.getByTestId('plant-target-leaf-right').press('Enter');
    await page.getByTestId('plant-part-4').press('Enter'); await page.getByTestId('plant-target-leaf-left').press('Enter');
    await expect(page.locator('[data-slot="tray"]')).toHaveCount(0); await plantSaved(page);
    const original=await savedPlant(page); expect(new Set(original.state.parts.map(p=>p.id)).size).toBe(5);
    await page.screenshot({path:testInfo.outputPath('completed.png')});
    await page.getByRole('button',{name:'Water demonstration'}).click(); await expect(page.getByTestId('plant-water-visual')).toBeVisible();
    await expect(page.locator('.plant-water-path')).toBeVisible(); await page.screenshot({path:testInfo.outputPath('water.png')});
    await page.getByRole('button',{name:'Sunlight demonstration'}).click(); await expect(page.locator('.plant-light-rays')).toBeVisible();
    await page.screenshot({path:testInfo.outputPath('sunlight.png')});
    await page.getByRole('button',{name:'Sunlight demonstration'}).click(); await expect(page.locator('.plant-light-rays')).toHaveCount(0);
    await expect(page.getByTestId('plant-explanation')).toContainText('Night is normal');
    await plantMore(page); await page.getByRole('button',{name:'Change plant language'}).click(); await page.getByRole('button',{name:'Close plant settings'}).click();
    await plantSaved(page); const before=await savedPlant(page); await page.reload();
    await expect(page.locator('.plant-title')).toHaveText('ഒരു ചെടി ഉണ്ടാക്കാം'); await plantSaved(page);
    expect(await savedPlant(page)).toEqual(before); await page.screenshot({path:testInfo.outputPath('malayalam.png')});
    await page.getByRole('button',{name:'Focus',exact:true}).click(); await page.screenshot({path:testInfo.outputPath('focus.png')});
    await page.getByRole('button',{name:'Leave focus'}).click();
    expect(await page.evaluate(()=>({x:document.documentElement.scrollWidth>innerWidth,y:document.documentElement.scrollHeight>innerHeight}))).toEqual({x:false,y:false});
    for(const button of await page.locator('.plant-controls > button').all()){const r=(await button.boundingBox())!;expect(r.height).toBeGreaterThanOrEqual(56);expect(r.x+r.width).toBeLessThanOrEqual(viewport.width);}
    const hit=(await page.locator('.plant-part-hit').first().boundingBox())!;expect(Math.min(hit.width,hit.height)).toBeGreaterThanOrEqual(56);
  });
}
test('invalid drop, Escape, pointer cancellation, outside release and secondary pointers do not commit',async({page})=>{
  await launchPlant(page);await plantSaved(page);const initial=await savedPlant(page);
  await plantDrag(page,[120,205],[1100,160]); await plantSaved(page);expect(await savedPlant(page)).toEqual(initial);
  const a=await plantPoint(page,120,205),b=await plantPoint(page,760,510);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);await page.keyboard.press('Escape');await page.mouse.up();
  await plantSaved(page);expect(await savedPlant(page)).toEqual(initial);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);
  await page.getByTestId('plant-part-1').dispatchEvent('pointercancel',{pointerId:1,pointerType:'mouse'});await page.mouse.up();
  await plantSaved(page);expect(await savedPlant(page)).toEqual(initial);
  await page.getByTestId('plant-part-1').dispatchEvent('pointerdown',{pointerId:32,pointerType:'touch',isPrimary:false,button:0});
  await plantDrag(page,[120,205],[1250,700]);await plantSaved(page);expect(await savedPlant(page)).toEqual(initial);
  await plantDrag(page,[120,205],[760,510]);await plantSaved(page);expect((await savedPlant(page)).revision).toBe(initial.revision+1);
});
test('tap placement, return to tray, reset cancellation and annotation isolation',async({page})=>{
  await launchPlant(page);await page.getByTestId('plant-part-1').click();await page.getByTestId('plant-target-root').click();
  await expect(page.getByTestId('plant-part-1')).toHaveAttribute('data-slot','root');
  await plantMore(page);await page.getByRole('button',{name:'Return selected part to tray'}).click();
  await expect(page.getByTestId('plant-part-1')).toHaveAttribute('data-slot','tray');
  await plantMore(page);await page.getByRole('button',{name:'Show whole plant'}).click();await plantSaved(page);const before=await savedPlant(page);
  await page.getByRole('button',{name:'Annotate',exact:true}).click();await plantDrag(page,[650,300],[500,250]);
  await page.getByRole('button',{name:'Explore',exact:true}).click();await plantSaved(page);expect(await savedPlant(page)).toEqual(before);
  const annotations = Object.values((await plantRecord(page)).snapshot.annotations);
  expect(annotations.reduce((total, document) => total + document.objects.length, 0)).toBe(1);
  await page.getByRole('button',{name:'Whiteboard',exact:true}).click();await page.getByRole('button',{name:'Explore',exact:true}).click();
  await expect(page.locator('[data-slot="tray"]')).toHaveCount(0);
  await plantMore(page);await page.getByRole('button',{name:'Reset plant',exact:true}).click();await page.getByRole('button',{name:'Keep plant'}).click();
  await page.getByRole('button',{name:'Close plant settings'}).click();await plantSaved(page);expect(await savedPlant(page)).toEqual(before);
  await plantMore(page);await page.getByRole('button',{name:'Reset plant',exact:true}).click();await page.getByRole('button',{name:'Confirm reset plant'}).click();
  await expect(page.locator('[data-slot="tray"]')).toHaveCount(5);
});
test('inspection of the same selected part leaves demonstration mode; resize cancels a draft', async ({page}) => {
  await launchPlant(page); await page.getByTestId('plant-part-1').press('Enter');
  await page.getByRole('button',{name:'Water demonstration'}).click();
  await expect(page.getByTestId('plant-water-visual')).toBeVisible();
  await page.getByTestId('plant-part-1').press('Enter');
  await expect(page.getByTestId('plant-water-visual')).toHaveCount(0);
  await expect(page.getByTestId('plant-explanation')).toHaveText('Take in water and hold the plant in the soil.');
  await plantSaved(page); const before = await savedPlant(page);
  const a=await plantPoint(page,120,205),b=await plantPoint(page,760,510);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);
  await page.setViewportSize({width:1024,height:600});await page.mouse.up();
  await plantSaved(page);expect(await savedPlant(page)).toEqual(before);
});
test('touch emulation places a part and cancellation restores the committed scene',async({browser})=>{
  const context=await browser.newContext({hasTouch:true,viewport:{width:1024,height:600}}),page=await context.newPage();await launchPlant(page);
  const client=await context.newCDPSession(page),a=await plantPoint(page,120,205),b=await plantPoint(page,760,510);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(page.getByTestId('plant-part-1')).toHaveAttribute('data-slot','tray');
  await page.getByTestId('plant-part-1').tap();await page.getByTestId('plant-target-root').tap();
  await expect(page.getByTestId('plant-part-1')).toHaveAttribute('data-slot','root');await context.close();
});
