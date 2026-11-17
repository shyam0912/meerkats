import { test, expect } from '@playwright/test';
import { launchCounting, countingMore, counterPositions } from '../helpers/counting';
import { drawDot, inkSurface } from '../helpers/chemistry';

test('quantity, teacher-paced counting, labels and confirmed recovery', async ({ page }) => {
  await launchCounting(page); const ids = (await counterPositions(page)).map(c => c.id);
  await expect(page.getByTestId('counting-total')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show count' }).click(); await expect(page.getByTestId('counting-total')).toContainText('5');
  await page.getByRole('button', { name: 'Quantity', exact: true }).click(); await page.getByRole('button', { name: 'Use 10 counters', exact: true }).click();
  await expect(page.locator('[data-counter-id]')).toHaveCount(10); expect((await counterPositions(page)).slice(0, 5).map(c => c.id)).toEqual(ids);
  await countingMore(page); await page.getByRole('button', { name: 'Count together', exact: true }).click();
  await page.getByRole('button', { name: 'Change label language' }).click(); await page.getByRole('button', { name: 'Close counting settings' }).click();
  for (let i = 1; i <= 10; i++) { await page.getByRole('button', { name: 'Next counter', exact: true }).click(); await expect(page.locator('.counting-counter.counted')).toHaveCount(i); }
  await expect(page.locator('.counting-title')).toHaveText('എണ്ണം അതേ. ക്രമം വേറെ.');
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device'); const before = await counterPositions(page);
  await page.reload(); expect(await counterPositions(page)).toEqual(before); await expect(page.locator('.counting-counter.counted')).toHaveCount(10);
  await page.getByRole('button', { name: 'Count again', exact: true }).click(); await expect(page.locator('.counting-counter.counted')).toHaveCount(0);
});

test('mouse, tap, keyboard, cancellation, outside release and reset preserve quantity', async ({ page }) => {
  await launchCounting(page); const counter = page.getByTestId('counter-1'); const before = await counterPositions(page);
  const box = await counter.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2); await page.mouse.down(); await page.mouse.move(box!.x + box!.width / 2, box!.y - 80);
  await expect(counter).not.toHaveAttribute('data-y', before[0]!.y!); await page.keyboard.press('Escape'); await page.mouse.up();
  expect(await counterPositions(page)).toEqual(before);
  await counter.press('Enter'); await counter.press('ArrowUp'); await counter.press('Enter'); await expect(counter).toHaveAttribute('data-y', '348');
  await counter.press('Enter'); await counter.press('ArrowUp'); await counter.press('Escape'); await expect(counter).toHaveAttribute('data-y', '348');
  await counter.click(); const scene = await page.locator('.counting-canvas').boundingBox();
  await page.mouse.click(scene!.x + 250 / 1200 * scene!.width, scene!.y + 180 / 675 * scene!.height); expect(Math.abs(Number(await counter.getAttribute('data-y')) - 180)).toBeLessThanOrEqual(2);
  const moved = await counter.boundingBox(); await page.mouse.move(moved!.x + moved!.width / 2, moved!.y + moved!.height / 2); await page.mouse.down(); await page.mouse.move(0, 0); await page.mouse.up();
  await expect(counter).toHaveAttribute('data-x', '72'); await expect(counter).toHaveAttribute('data-y', '132');
  expect((await counterPositions(page)).slice(1)).toEqual(before.slice(1));
  await countingMore(page); await page.getByRole('button', { name: 'Reset arrangement' }).click(); expect(await counterPositions(page)).toEqual(before);
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device'); await page.reload(); expect(await counterPositions(page)).toEqual(before);
});

test('simulated touch, secondary pointer and interruption do not commit draft', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true }); const page = await context.newPage(); await launchCounting(page);
  const before = await counterPositions(page); const box = await page.getByTestId('counter-1').boundingBox();
  const x = box!.x + box!.width / 2, y = box!.y + box!.height / 2; const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 60, id: 1 }] });
  const draft = await counterPositions(page); expect(draft).not.toEqual(before);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y - 60, id: 1 }, { x: x + 100, y, id: 2 }] });
  expect((await counterPositions(page)).slice(1)).toEqual(before.slice(1));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); expect(await counterPositions(page)).toEqual(before);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 60, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); expect(await counterPositions(page)).toEqual(draft);
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device'); await page.reload(); expect(await counterPositions(page)).toEqual(draft); await context.close();
});

test('annotation ownership, Whiteboard independence, resize cancellation and navigation recovery', async ({ page }) => {
  await launchCounting(page); const before = await counterPositions(page), counter = page.getByTestId('counter-1');
  await counter.press('Enter'); await counter.press('ArrowUp'); await page.setViewportSize({ width: 1024, height: 600 });
  await expect(counter).toHaveAttribute('data-y', before[0]!.y!);
  await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await expect(page.locator('.content-layer')).toHaveAttribute('inert', '');
  await drawDot(page); expect(await counterPositions(page)).toEqual(before); await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await drawDot(page, true);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(inkSurface(page, true)).toHaveAttribute('data-ink-count', '0');
  await page.getByRole('button', { name: 'Explore', exact: true }).click(); await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1');
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device'); const url = page.url();
  await page.getByRole('button', { name: '← Classroom' }).click(); await page.goto(url); await expect(counter).toBeVisible(); expect(await counterPositions(page)).toEqual(before);
});

test('free dragging forms circles, lines and scattered patterns without changing IDs', async ({ page }) => {
  await launchCounting(page);
  await page.getByRole('button', { name: 'Quantity', exact: true }).click(); await page.getByRole('button', { name: 'Use 3 counters', exact: true }).click();
  const ids = (await counterPositions(page)).map(c => c.id);
  const scene = (await page.locator('.counting-canvas').boundingBox())!;
  for (const pattern of [[[600, 180], [400, 490], [800, 490]], [[200, 220], [600, 220], [1000, 220]], [[150, 500], [650, 150], [1050, 440]]]) {
    for (let i = 0; i < 3; i++) {
      const counter = page.getByTestId(`counter-${i + 1}`); const box = (await counter.boundingBox())!; const [x, y] = pattern[i]!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(scene.x + x! * scene.width / 1200, scene.y + y! * scene.height / 675, { steps: 12 }); await page.mouse.up();
      expect(Math.abs(Number(await counter.getAttribute('data-x')) - x!)).toBeLessThanOrEqual(2);
      expect(Math.abs(Number(await counter.getAttribute('data-y')) - y!)).toBeLessThanOrEqual(2);
    }
    expect((await counterPositions(page)).map(c => c.id)).toEqual(ids);
  }
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device');
  const arranged = await counterPositions(page); await page.reload(); expect(await counterPositions(page)).toEqual(arranged);
});

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test('readable counter and control targets, trays and Malayalam at ' + viewport.width, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); await launchCounting(page);
    for (const name of ['Explore', 'Annotate', 'Whiteboard', 'Quantity', 'Show count', 'More counting controls']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(56); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    expect((await page.getByTestId('counter-1').boundingBox())!.width).toBeGreaterThanOrEqual(56);
    await page.screenshot({ path: testInfo.outputPath('counting-normal.png') });
    await page.getByRole('button', { name: 'Quantity', exact: true }).click();
    for (let i = 1; i <= 10; i++) { const box = await page.getByRole('button', { name: `Use ${i} counters`, exact: true }).boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(56); expect(box!.y).toBeGreaterThanOrEqual(0); }
    await page.getByRole('button', { name: 'Use 10 counters', exact: true }).click();
    await countingMore(page); await page.getByRole('button', { name: 'Count together', exact: true }).click(); await page.getByRole('button', { name: 'Change label language' }).click();
    await page.screenshot({ path: testInfo.outputPath('counting-settings.png') }); await page.getByRole('button', { name: 'Close counting settings' }).click();
    await page.getByRole('button', { name: 'Next counter', exact: true }).click();
    await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: testInfo.outputPath('counting-malayalam.png') });
    expect((await page.getByTestId('counter-1').boundingBox())!.width).toBeGreaterThanOrEqual(56);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const scene = await page.getByTestId('fitted-scene').boundingBox(); const content = await page.locator('.content-layer').boundingBox(); expect(content!.width).toBeCloseTo(scene!.width, 0);
  });
}
