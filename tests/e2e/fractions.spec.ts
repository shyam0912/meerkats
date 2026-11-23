import { test, expect } from '@playwright/test';
import { fractionDrag, fractionPoint, fractionRecord, fractionSaved, launchFractions, savedFractions } from '../helpers/fractions';
const button = (page: import('@playwright/test').Page, name: string) => page.getByRole('button', { name, exact: true });

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`fraction teaching, proportions, bilingual controls and recovery ${viewport.width}`, async ({ page }, info) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize(viewport); await launchFractions(page); await fractionSaved(page);
    const initial = await savedFractions(page);
    await page.screenshot({ path: info.outputPath('empty.png') });
    await fractionDrag(page, 1, 260, 128);
    await page.getByTestId('fraction-piece-3').click(); await page.getByTestId('fraction-target-bottom-0').click();
    await page.getByTestId('fraction-piece-4').press('Enter'); await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('fraction-target-top-0')).toBeFocused();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
    await expect(page.getByTestId('fraction-piece-4')).toHaveAttribute('data-start', '1');
    await fractionSaved(page); const arranged = await savedFractions(page);
    expect(arranged.revision).toBe(initial.revision + 3);
    expect(arranged.state.pieces.map(p => p.id)).toEqual(initial.state.pieces.map(p => p.id));
    expect(arranged.state.pieces.map(p => p.placement)).toEqual([{ lane: 'top', start: 0 }, null, { lane: 'bottom', start: 0 }, { lane: 'bottom', start: 1 }, null, null]);
    const top = (await page.getByTestId('fraction-lane-top').boundingBox())!, bottom = (await page.getByTestId('fraction-lane-bottom').boundingBox())!;
    const half = (await page.getByTestId('fraction-piece-1').boundingBox())!;
    expect(top.width).toBeCloseTo(bottom.width, 3); expect(top.height).toBeCloseTo(bottom.height, 3);
    // Compare mathematical rectangles, excluding the selection/border stroke.
    const widths = await page.locator('.fraction-piece-body').evaluateAll(nodes => nodes.map(n => {
      const rect = n as SVGRectElement; return rect.getBBox().width * rect.getScreenCTM()!.a;
    }));
    const wholeWidth = await page.getByTestId('fraction-lane-top').evaluate(node => {
      const rect = node as SVGRectElement; return rect.getBBox().width * rect.getScreenCTM()!.a;
    });
    expect(widths[0]).toBeCloseTo(widths[2]! * 2, 3); expect(widths[0]! * 2).toBeCloseTo(wholeWidth, 3);
    expect(half.height).toBeGreaterThanOrEqual(56);
    await button(page, 'Fraction labels').click(); await button(page, 'Alignment guides').click();
    await expect(page.locator('.fraction-number')).toHaveCount(6); await expect(page.getByTestId('fraction-guides')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('comparison.png') });
    await button(page, 'More fraction controls').click(); await button(page, 'Change fraction language').click();
    await page.screenshot({ path: info.outputPath('settings-malayalam.png') }); await button(page, 'Close fraction settings').click();
    await expect(page.locator('.fraction-title')).toHaveText('ഒരേ മുഴുവന്റെ ഭാഗങ്ങൾ');
    for (const control of await page.locator('.fraction-controls > button').all()) {
      const r = (await control.boundingBox())!; expect(r.height).toBeGreaterThanOrEqual(56);
      expect(r.x + r.width).toBeLessThanOrEqual(viewport.width); expect(r.y + r.height).toBeLessThanOrEqual(viewport.height);
    }
    await fractionSaved(page); const saved = await savedFractions(page), url = page.url();
    await page.reload(); await fractionSaved(page); expect(await savedFractions(page)).toEqual(saved);
    await page.goto('/'); await page.goto(url); await fractionSaved(page); expect(await savedFractions(page)).toEqual(saved);
    await page.screenshot({ path: info.outputPath('malayalam-recovered.png') });
    await button(page, 'Focus').click(); await page.screenshot({ path: info.outputPath('focus.png') }); await button(page, 'Leave focus').click();
    expect(await page.evaluate(() => ({ x: document.documentElement.scrollWidth > innerWidth, y: document.documentElement.scrollHeight > innerHeight }))).toEqual({ x: false, y: false });
    for (const control of await page.locator('.fraction-controls > button').all()) {
      const r = (await control.boundingBox())!; expect(r.height).toBeGreaterThanOrEqual(56); expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(viewport.width); expect(r.y + r.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(errors).toEqual([]);
  });
}

test('invalid placements, preview-only gestures, Escape, pointer cancellation and outside release', async ({ page }) => {
  await launchFractions(page); await fractionSaved(page); const initial = await savedFractions(page);
  const r = (await page.getByTestId('fraction-piece-1').boundingBox())!, target = await fractionPoint(page, 460, 178);
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.mouse.move(target.x, target.y);
  await expect(page.getByTestId('fraction-snap-preview')).toBeVisible(); expect(await savedFractions(page)).toEqual(initial);
  await page.keyboard.press('Escape'); await page.mouse.up(); await fractionSaved(page); expect(await savedFractions(page)).toEqual(initial);
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.mouse.move(target.x, target.y);
  await page.getByTestId('fraction-piece-1').dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' }); await page.mouse.up();
  await fractionSaved(page); expect(await savedFractions(page)).toEqual(initial);
  await fractionDrag(page, 1, 860, 128); await fractionSaved(page); expect(await savedFractions(page)).toEqual(initial);
  await expect(page.locator('.fraction-announcement')).toContainText('does not fit');
  await fractionDrag(page, 1, 1250, 700); await fractionSaved(page); expect(await savedFractions(page)).toEqual(initial);
  await fractionDrag(page, 1, 260, 128); await fractionSaved(page); const placed = await savedFractions(page);
  await fractionDrag(page, 2, 460, 128); await fractionSaved(page); expect(await savedFractions(page)).toEqual(placed);
  await fractionDrag(page, 2, 660, 128); await fractionSaved(page); expect((await savedFractions(page)).revision).toBe(placed.revision + 1);
});

test('return to tray, confirmed reset, annotation isolation and independent whiteboard', async ({ page }) => {
  await launchFractions(page); await fractionDrag(page, 1, 260, 128);
  await button(page, 'Return selected piece to tray').click(); await expect(page.getByTestId('fraction-piece-1')).toHaveAttribute('data-lane', 'tray');
  await fractionDrag(page, 1, 260, 128); await fractionDrag(page, 3, 260, 252); await fractionSaved(page); const before = await savedFractions(page);
  await button(page, 'Annotate').click();
  const a = await fractionPoint(page, 400, 160), b = await fractionPoint(page, 600, 160);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
  await page.setViewportSize({ width: 1024, height: 600 });
  const sceneBox = (await page.locator('.fraction-canvas').boundingBox())!;
  const inkBox = (await page.getByRole('region', { name: 'Content annotation surface' }).boundingBox())!;
  for (const key of ['x', 'y', 'width', 'height'] as const) expect(inkBox[key]).toBeCloseTo(sceneBox[key], 1);
  await button(page, 'Explore').click(); await fractionSaved(page); expect(await savedFractions(page)).toEqual(before);
  const annotated = await fractionRecord(page); expect(Object.values(annotated.snapshot.annotations).reduce((n, d) => n + d.objects.length, 0)).toBe(1);
  await button(page, 'Whiteboard').click(); const board = page.getByRole('region', { name: 'Whiteboard drawing surface' }); await board.click();
  await button(page, 'Explore').click(); await fractionSaved(page); expect(await savedFractions(page)).toEqual(before);
  expect((await fractionRecord(page)).snapshot.annotations).toEqual(annotated.snapshot.annotations);
  await button(page, 'More fraction controls').click(); await button(page, 'Reset arrangement').click();
  await expect(page.getByRole('dialog')).toBeVisible(); await button(page, 'Keep arrangement').click();
  await fractionSaved(page); expect(await savedFractions(page)).toEqual(before);
  await button(page, 'Reset arrangement').click(); await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible();
  await button(page, 'Reset arrangement').click(); await button(page, 'Reset').click();
  await fractionSaved(page); const reset = await savedFractions(page); expect(reset.state.pieces.every(p => p.placement === null)).toBe(true);
  expect(reset.revision).toBe(before.revision + 1); expect(reset.state.pieces.map(p => p.id)).toEqual(before.state.pieces.map(p => p.id));
});

test('simulated touch, secondary-pointer rejection, resizing and lost capture preserve committed state', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 600 } }), page = await context.newPage();
  await launchFractions(page); await fractionSaved(page); const initial = await savedFractions(page);
  await page.getByTestId('fraction-piece-1').dispatchEvent('pointerdown', { pointerId: 32, pointerType: 'touch', isPrimary: false, button: 0 });
  const client = await context.newCDPSession(page), a = await fractionPoint(page, 300, 472), b = await fractionPoint(page, 460, 178);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...a, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...b, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await fractionSaved(page); expect(await savedFractions(page)).toEqual(initial);
  await page.getByTestId('fraction-piece-1').tap(); await page.getByTestId('fraction-target-top-0').tap();
  await fractionSaved(page); const placed = await savedFractions(page); expect(placed.revision).toBe(initial.revision + 1);
  for (const interruption of ['resize', 'lostpointercapture']) {
    const r = (await page.getByTestId('fraction-piece-2').boundingBox())!;
    await page.mouse.move(r.x + 20, r.y + 20); await page.mouse.down(); await page.mouse.move(r.x + 50, r.y - 50);
    if (interruption === 'resize') await page.setViewportSize({ width: 1280, height: 720 });
    else await page.getByTestId('fraction-piece-2').dispatchEvent('lostpointercapture', { pointerId: 1 });
    await page.mouse.up(); await fractionSaved(page); expect(await savedFractions(page)).toEqual(placed);
  }
  await context.close();
});

test('all six pieces fill two equal wholes, then separate freely without losing identities', async ({ page }) => {
  await launchFractions(page); await fractionSaved(page); const initial = await savedFractions(page);
  for (const [piece, x, y] of [[1, 260, 128], [2, 660, 128], [3, 260, 252], [4, 460, 252], [5, 660, 252], [6, 860, 252]])
    await fractionDrag(page, piece!, x!, y!);
  await fractionSaved(page); const full = await savedFractions(page);
  expect(full.revision).toBe(initial.revision + 6); expect(full.state.pieces.every(p => p.placement !== null)).toBe(true);
  expect(full.state.pieces.map(p => p.id)).toEqual(initial.state.pieces.map(p => p.id));
  // Move an existing half back to its tray, then move a quarter into the vacated lane.
  await fractionDrag(page, 1, 100, 422); await fractionDrag(page, 3, 260, 128); await fractionSaved(page);
  const separated = await savedFractions(page);
  expect(separated.state.pieces[0]!.placement).toBeNull(); expect(separated.state.pieces[2]!.placement).toEqual({ lane: 'top', start: 0 });
  expect(separated.revision).toBe(full.revision + 2);
  await page.getByTestId('fraction-piece-1').press('Enter'); await page.getByTestId('fraction-target-top-0').press('Enter');
  await fractionSaved(page); expect(await savedFractions(page)).toEqual(separated);
  await expect(page.locator('.fraction-announcement')).toContainText('does not fit');
});
