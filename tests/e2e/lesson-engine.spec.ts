import { test, expect, type Page } from '@playwright/test';
async function launch(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Start Teaching' }).click();
  await page.getByRole('button', { name: /Demo class/ }).click();
  await page.getByRole('button', { name: /Visual exploration/ }).click();
  await page.getByRole('button', { name: /Observe and describe/ }).click();
  await expect(page.getByText('Shapes and patterns', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start Teaching' }).click();
  await expect(page.getByRole('button', { name: 'Activity outline' })).toContainText('1 of 3');
}
const surface = (page: Page, whiteboard = false) => page.getByRole('region', { name: whiteboard ? 'Whiteboard drawing surface' : 'Content annotation surface' });
async function dot(page: Page, whiteboard = false) {
  const box = await surface(page, whiteboard).boundingBox(); if (!box) throw new Error('Surface missing');
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .5);
}
test('catalog journey, activity navigation, independent ink/history, runtime and reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await launch(page);
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Reveal next' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await dot(page);
  const firstId = await surface(page).getAttribute('data-document-id');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
  await page.getByRole('button', { name: 'Triangle', exact: true }).click();
  await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await dot(page);
  const secondId = await surface(page).getAttribute('data-document-id'); expect(secondId).not.toBe(firstId);
  await expect(page.locator('.content-layer')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-document-id', firstId!);
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Triangle', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await dot(page, true);
  const boardId = await surface(page, true).getAttribute('data-document-id');
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal next' }).click(); await page.getByRole('button', { name: 'Reveal next' }).click();
  await expect(page.getByText('2 of 3 prompts revealed')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Saved on this device'); const url = page.url();
  await page.reload(); expect(page.url()).toBe(url);
  await expect(page.getByRole('button', { name: 'Activity outline' })).toContainText('3 of 3');
  await expect(page.getByText('2 of 3 prompts revealed')).toBeVisible();
  await page.getByRole('button', { name: 'Whiteboard', exact: true }).click();
  await expect(surface(page, true)).toHaveAttribute('data-document-id', boardId!); await expect(surface(page, true)).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-document-id', secondId!); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  await expect(page.getByRole('button', { name: 'Triangle', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-document-id', firstId!); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  expect(errors).toEqual([]);
});
test('outline supports direct navigation, Escape and focus return; reveal/reset are bounded', async ({ page }) => {
  await launch(page); const outline = page.getByRole('button', { name: 'Activity outline' }); await outline.click();
  await expect(page.getByRole('button', { name: 'Close outline' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(outline).toBeFocused(); await outline.click();
  await page.getByRole('button', { name: '3. Build an observation' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset activity' })).toBeDisabled();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Reveal next' }).click();
  await expect(page.getByRole('button', { name: 'Reveal next' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reset activity' }).click();
  await expect(page.getByText('0 of 3 prompts revealed')).toBeVisible();
});
test('Clear only affects the current activity, and Undo Clear restores it', async ({ page }) => {
  await launch(page);
  await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await dot(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await dot(page);
  await page.getByRole('button', { name: 'Clear ink', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear ink', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Annotate', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(surface(page)).toHaveAttribute('data-ink-count', '1');
});
test('failed activity module leaves navigation and Whiteboard usable', async ({ page }) => {
  await page.route('**/src/activities/kinds/Explore.tsx*', route => route.abort('failed'));
  await launch(page); await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Activity unavailable');
  await page.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await dot(page, true);
  await expect(surface(page, true)).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal next' }).click();
  await expect(page.getByText('1 of 3 prompts revealed')).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByRole('button', { name: 'Quick Workspace' })).toBeVisible();
});
for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`lesson controls fit and ink stays aligned at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await launch(page); await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await dot(page);
    await page.setViewportSize(viewport);
    for (const name of ['Previous', 'Next', 'Activity outline', 'Whiteboard', 'Content', 'Annotate', 'Pen', 'Eraser', 'Ink settings', 'Undo', 'Redo', 'Clear ink']) {
      const control = page.getByRole('button', { name, exact: true }); const box = await control.boundingBox();
      expect(box).not.toBeNull(); expect(box!.height).toBeGreaterThanOrEqual(56);
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    const box = await surface(page).boundingBox(); expect(box!.height).toBeGreaterThan(280);
    await expect.poll(() => surface(page).locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.getContext('2d')!.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3])).toBeGreaterThan(0);
    await page.screenshot({ path: `test-results/phase-4-${viewport.width}.png` });
  });
}
