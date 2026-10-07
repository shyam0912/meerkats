import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`Home destinations fit at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where shall we begin?');
    for (const name of ['Classroom', 'Whiteboard', 'Labs']) {
      const control = page.getByRole('button', { name, exact: true });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(60);
      expect(box!.height).toBeGreaterThanOrEqual(60);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    await expect(page.getByRole('button', { name: 'Labs', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('In development', { exact: true })).toBeVisible();
    for (const name of ['Chemistry', 'Physics', 'Mathematics', 'Biology', 'Social Science']) {
      const marker = page.getByText(name, { exact: true });
      await expect(marker).toBeVisible();
      const box = await marker.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    await expect(page.locator('.lab-subject button, .lab-subject a, .lab-subject [tabindex]')).toHaveCount(0);
  });
}

test('keyboard destinations have visible focus; Labs truthfully remains unavailable', async ({ page }) => {
  await page.goto('/');
  const classroom = page.getByRole('button', { name: 'Classroom', exact: true });
  const whiteboard = page.getByRole('button', { name: 'Whiteboard', exact: true });
  const labs = page.getByRole('button', { name: 'Labs', exact: true });
  await page.keyboard.press('Tab');
  await expect(classroom).toBeFocused();
  await expect(classroom).toHaveCSS('outline-style', 'solid');
  await expect(classroom).toHaveCSS('outline-width', '4px');
  await page.keyboard.press('Tab'); await expect(whiteboard).toBeFocused();
  await page.keyboard.press('Tab'); await expect(labs).toBeFocused();
  await page.keyboard.press('Enter'); await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\/$/);
  // Pointer input must not expose a fake Lab route either.
  const box = await labs.boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page).toHaveURL(/\/$/);
  await page.keyboard.press('Shift+Tab'); await expect(whiteboard).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Whiteboard drawing surface' })).toBeVisible();
  await expect(page).toHaveURL(/\/workspace\?session=/);
  await page.goto('/'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/catalog$/);
  await expect(page.getByRole('heading', { name: 'Select Class' })).toBeVisible();
});

test('reduced motion removes transitions and retains destination navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const classroom = page.getByRole('button', { name: 'Classroom', exact: true });
  await expect(classroom).toHaveCSS('transition-duration', '0s');
  const box = await classroom.boundingBox();
  await page.mouse.move(box!.x + 30, box!.y + 30); await page.mouse.down();
  await expect(classroom).toHaveCSS('transform', 'none');
  await page.mouse.up(); await expect(page).toHaveURL(/\/catalog$/);
  await page.goto('/'); await page.getByRole('button', { name: 'Whiteboard', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Whiteboard drawing surface' })).toBeVisible();
});

test('existing catalog, class, subject and workspace routes remain directly available', async ({ page }) => {
  for (const [path, heading] of [['/catalog', 'Select Class'], ['/classes', 'Select Class'], ['/subjects', 'Select Subject']]) {
    await page.goto(path!); await expect(page.getByRole('heading', { name: heading!, exact: true })).toBeVisible();
  }
  await page.goto('/workspace');
  await expect(page.getByRole('region', { name: 'Whiteboard drawing surface' })).toBeVisible();
});
