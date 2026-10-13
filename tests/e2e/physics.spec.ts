import { test, expect } from '@playwright/test';
import { launchPhysics } from '../helpers/physics';
import { drawDot, inkSurface } from '../helpers/chemistry';

test('direct launch, continuous mouse drag, outside release, reset and reload', async ({ page }) => {
  await launchPhysics(page);
  const object = page.getByRole('slider', { name: 'Object position' });
  const rect = await object.boundingBox(); const scene = await page.getByTestId('fitted-scene').boundingBox();
  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2); await page.mouse.down();
  await page.mouse.move(rect!.x + rect!.width / 2 + scene!.width / 1200 * 200, rect!.y + rect!.height / 2, { steps: 30 });
  await expect(object).toHaveAttribute('aria-valuenow', '25');
  await expect(page.getByTestId('lens-result')).toContainText('Image at infinity'); await page.mouse.up();
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device');
  await page.reload(); await expect(object).toHaveAttribute('aria-valuenow', '25');
  const next = await object.boundingBox();
  await page.mouse.move(next!.x + next!.width / 2, next!.y + next!.height / 2); await page.mouse.down();
  await page.mouse.move(1, 1, { steps: 15 }); await page.mouse.up();
  await expect(object).toHaveAttribute('aria-valuenow', '120');
  await page.getByRole('button', { name: 'Reset activity' }).click(); await expect(object).toHaveAttribute('aria-valuenow', '75');
});
test('keyboard and focal controls, convex/concave and navigation recovery', async ({ page }) => {
  await launchPhysics(page); const object = page.getByRole('slider', { name: 'Object position' });
  await object.press('Home'); await expect(object).toHaveAttribute('aria-valuenow', '5');
  await expect(page.getByTestId('lens-result')).toContainText('Virtual · Upright · Magnified');
  await object.press('ArrowLeft'); await expect(object).toHaveAttribute('aria-valuenow', '6');
  const focal = page.getByRole('slider', { name: 'Focal length' }); await focal.press('End'); await expect(focal).toHaveValue('50');
  await page.getByRole('button', { name: 'Concave', exact: true }).click();
  await expect(page.getByTestId('lens-result')).toHaveText('Virtual · Upright · Diminished');
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device'); await page.reload();
  await expect(focal).toHaveValue('50'); await expect(object).toHaveAttribute('aria-valuenow', '6');
  await expect(page.getByRole('button', { name: 'Concave', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '← Classroom' }).click();
  await expect(page.getByRole('button', { name: 'Chapter 2 · Lenses' })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Where shall we begin?' })).toBeVisible();
});
test('touch previews, cancellation, second-pointer isolation and completed persistence', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true }); const page = await context.newPage(); await launchPhysics(page);
  const object = page.getByRole('slider', { name: 'Object position' }); const rect = await object.boundingBox();
  const x = rect!.x + rect!.width / 2, y = rect!.y + rect!.height / 2; const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 100, y, id: 1 }] });
  await expect(object).not.toHaveAttribute('aria-valuenow', '75'); const draft = await object.getAttribute('aria-valuenow');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + 100, y, id: 1 }, { x: x + 160, y, id: 2 }] });
  await expect(object).toHaveAttribute('aria-valuenow', draft!);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await expect(object).toHaveAttribute('aria-valuenow', '75');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 100, y, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await expect(object).toHaveAttribute('aria-valuenow', draft!);
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device'); await page.reload(); await expect(object).toHaveAttribute('aria-valuenow', draft!); await context.close();
});
test('Escape cancels a drag without saving the draft', async ({ page }) => {
  await launchPhysics(page); const object = page.getByRole('slider', { name: 'Object position' }); const rect = await object.boundingBox();
  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2); await page.mouse.down();
  await page.mouse.move(rect!.x + 150, rect!.y + 20); await expect(object).not.toHaveAttribute('aria-valuenow', '75');
  await page.keyboard.press('Escape'); await page.mouse.up(); await expect(object).toHaveAttribute('aria-valuenow', '75');
  await page.reload(); await expect(object).toHaveAttribute('aria-valuenow', '75');
});
test('property gestures preview locally, cancel on Escape, and commit on release', async ({ page }) => {
  await launchPhysics(page); const slider = page.getByRole('slider', { name: 'Focal length' }); const rect = await slider.boundingBox();
  await page.mouse.move(rect!.x + rect!.width * .375, rect!.y + rect!.height / 2); await page.mouse.down();
  await page.mouse.move(rect!.x + rect!.width * .8, rect!.y + rect!.height / 2, { steps: 12 });
  await expect(slider).not.toHaveValue('25'); await expect(page.getByRole('button', { name: 'Focus', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await page.mouse.up(); await expect(slider).toHaveValue('25');
  await slider.click({ position: { x: rect!.width * .8, y: rect!.height / 2 } });
  const value = await slider.inputValue(); expect(Number(value)).toBeGreaterThan(25);
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device'); await page.reload(); await expect(slider).toHaveValue(value);
});
test('resize cancels only an unfinished object gesture', async ({ page }) => {
  await launchPhysics(page); const object = page.getByRole('slider', { name: 'Object position' }); const rect = await object.boundingBox();
  await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2); await page.mouse.down();
  await page.mouse.move(rect!.x + 150, rect!.y + 20); await expect(object).not.toHaveAttribute('aria-valuenow', '75');
  await expect(page.getByRole('button', { name: 'Annotate', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 1024, height: 600 }); await page.mouse.up(); await expect(object).toHaveAttribute('aria-valuenow', '75');
  await expect(page.getByRole('button', { name: 'Annotate', exact: true })).toBeEnabled();
});
test('annotation isolation, resize, whiteboard independence and Focus', async ({ page }) => {
  await launchPhysics(page); await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await drawDot(page);
  await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1'); await expect(page.locator('.content-layer')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await drawDot(page, true);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(inkSurface(page, true)).toHaveAttribute('data-ink-count', '0');
  await page.getByRole('button', { name: 'Explore', exact: true }).click(); await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Concave', exact: true }).click(); await expect(page.getByTestId('lens-result')).toContainText('Virtual');
  await page.setViewportSize({ width: 1024, height: 600 });
  const surface = await page.getByTestId('fitted-scene').boundingBox(); const content = await page.locator('.content-layer').boundingBox();
  expect(Math.abs(content!.width - surface!.width)).toBeLessThan(2); expect(Math.abs(content!.height - surface!.height)).toBeLessThan(2);
  await page.getByRole('button', { name: 'Focus', exact: true }).click(); await expect(page.getByRole('button', { name: 'Leave focus' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Focus', exact: true })).toBeVisible();
  await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1'); await page.reload(); await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1');
});
for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test('image intersection and truthful offscreen indicators at ' + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport); await launchPhysics(page);
    const object = page.getByRole('slider', { name: 'Object position' });
    const intersection = page.getByTestId('lens-image-intersection');
    await expect(intersection).toHaveAttribute('cx', '750'); await expect(intersection).toHaveAttribute('cy', '260');
    await expect(page.locator('.lens-image-label')).toHaveText('Image');
    // d=40: magnified, finite image tip on both constructed rays.
    for (let i = 0; i < 7; i++) await object.press('Shift+ArrowRight');
    await expect(page.getByTestId('lens-result')).toHaveText('Real · Inverted · Magnified');
    expect(Number(await intersection.getAttribute('cx'))).toBeCloseTo(600 + 4 * 200 / 3);
    expect(Number(await intersection.getAttribute('cy'))).toBeCloseTo(330);
    for (let i = 0; i < 14; i++) await object.press('ArrowRight');
    await expect(object).toHaveAttribute('aria-valuenow', '26');
    await expect(page.getByTestId('lens-offscreen')).toHaveAttribute('aria-label', 'Image beyond view: right and below');
    await expect(page.getByTestId('lens-image')).toHaveCount(0); await expect(intersection).toHaveCount(0);
    await expect(page.locator('.lens-result')).toContainText('v = 650 cm · m = -25');
    const badge = await page.locator('.lens-offscreen text').boundingBox();
    expect(badge!.x).toBeGreaterThanOrEqual(0); expect(badge!.x + badge!.width).toBeLessThanOrEqual(viewport.width);
    await object.press('ArrowRight'); await expect(page.getByTestId('lens-result')).toContainText('Image at infinity');
    await expect(page.getByTestId('lens-offscreen')).toHaveCount(0); await expect(page.getByTestId('lens-image')).toHaveCount(0);
    await object.press('ArrowRight'); await expect(page.getByTestId('lens-offscreen')).toHaveAttribute('aria-label', 'Image beyond view: left and above');
    await page.getByRole('button', { name: 'Concave', exact: true }).click();
    await expect(page.getByTestId('lens-offscreen')).toHaveCount(0); await expect(intersection).toBeVisible();
    await expect(page.getByTestId('lens-result')).toHaveText('Virtual · Upright · Diminished');
    await expect(page.getByTestId('lens-image')).toHaveAttribute('stroke-dasharray', '7 4');
  });
  test('lens teaching layout fits ' + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport); await launchPhysics(page);
    for (const name of ['Explore', 'Annotate', 'Whiteboard', 'Focus', 'Convex', 'Concave']) {
      const rect = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(rect!.height).toBeGreaterThanOrEqual(54); expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Annotate', exact: true }).click();
    for (const name of ['Pen', 'Eraser', 'Undo', 'Redo', 'Clear ink']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  });
}
