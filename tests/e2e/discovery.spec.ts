import { test, expect } from '@playwright/test';
import { CHEMISTRY } from '../../contracts/chemistry';

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test('discovery progression fits ' + viewport.width + 'x' + viewport.height, async ({ page }) => {
    await page.setViewportSize(viewport); await page.goto('/');
    await page.getByRole('button', { name: 'Classroom', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Which class are you teaching?');
    await expect(page.locator('.discovery-standard')).toHaveCount(10);
    for (const [name, id] of [['Standard 10', CHEMISTRY.class], ['Chemistry', CHEMISTRY.subject],
      ['Unit 1 · Nomenclature of Organic Compounds and Isomerism', CHEMISTRY.chapter], ['One branch. Two structures.', CHEMISTRY.topic]]) {
      for (const button of await page.getByRole('button').all()) {
        const box = await button.boundingBox(); expect(box).not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(60);
        expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      }
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page).toHaveURL('/catalog?parent=' + id);
    }
    await expect(page.getByText('Academic teacher review pending', { exact: false })).toBeVisible();
    const start = page.getByRole('button', { name: 'Start teaching', exact: true });
    await expect(start).toBeVisible();
    const box = await start.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(60);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await start.click(); await expect(page.getByRole('button', { name: 'Activity outline' })).toContainText('1 of 7');
    const url = page.url();
    // A just-launched lesson can still be saving. Exercise the deliberate Stay
    // guard rather than letting Playwright silently dismiss it and abort reload.
    let stayed = false;
    page.once('dialog', async dialog => { expect(dialog.type()).toBe('beforeunload'); stayed = true; await dialog.dismiss(); });
    await page.reload({ timeout: 5000 }).catch(error => { if (!stayed) throw error; });
    if (stayed) {
      await expect(page.getByRole('status')).toHaveText('Saved on this device');
      await page.reload();
    }
    await expect(page.getByRole('button', { name: 'Activity outline' })).toContainText('1 of 7');
    expect(page.url()).toBe(url);
  });
}
test('keyboard selection, Back focus, browser history, reload and Home preserve context', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/catalog');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const standard = page.getByRole('button', { name: 'Standard 10', exact: true });
  for (let number = 1; number <= 10; number++) {
    await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Standard ' + number, exact: true })).toBeFocused();
  }
  await expect(standard).toHaveCSS('outline-width', '4px'); await expect(standard).toHaveCSS('transition-duration', '0s');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Chemistry', exact: true }).press('Enter');
  await page.getByRole('button', { name: /Unit 1/ }).press('Enter');
  await page.getByRole('button', { name: 'One branch. Two structures.', exact: true }).press('Enter');
  await page.reload(); await expect(page.getByRole('button', { name: 'Start teaching' })).toBeVisible();
  for (const [name, parent] of [['One branch. Two structures.', CHEMISTRY.chapter], ['Unit 1 · Nomenclature of Organic Compounds and Isomerism', CHEMISTRY.subject],
    ['Chemistry', CHEMISTRY.class], ['Standard 10', null]] as const) {
    await page.getByRole('button', { name: '← Back', exact: true }).click();
    await expect(page).toHaveURL(parent ? '/catalog?parent=' + parent : '/catalog');
    await expect(page.getByRole('button', { name, exact: true })).toBeFocused();
  }
  await page.goBack(); await expect(page.getByText('Standard 10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where shall we begin?');
});
test('invalid stable ID does not silently select another class', async ({ page }) => {
  await page.goto('/catalog?parent=missing'); await expect(page.getByText('This selection is unavailable')).toBeVisible();
  await expect(page.locator('[data-catalog-id]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Choose a class' }).click();
  await expect(page.locator('.discovery-standard')).toHaveCount(10);
});

test('all nine planned standards are truthful, reloadable and restore selection focus', async ({ page }) => {
  await page.goto('/catalog');
  for (let number = 1; number <= 9; number++) {
    const label = 'Standard ' + number;
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page).toHaveURL('/catalog?standard=' + number);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    await expect(page.getByText('Planned', { exact: true })).toBeVisible();
    await expect(page.getByText('No verified subjects, chapters or lessons are available for this standard yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start teaching' })).toHaveCount(0);
    await page.getByRole('button', { name: '← Back', exact: true }).click();
    await expect(page.getByRole('button', { name: label, exact: true })).toBeFocused();
  }
});
test('school flow hides internal fixtures including direct demo links', async ({ page }) => {
  await page.goto('/catalog');
  await expect(page.getByRole('button', { name: 'Demo class' })).toHaveCount(0);
  await expect(page.getByText('Bundled catalog')).toHaveCount(0);
  await expect(page.getByText('Catalog from the school API')).toHaveCount(0);
  await page.goto('/catalog?parent=40000000-0000-4000-8000-000000000005');
  await expect(page.getByText('This selection is unavailable')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start teaching' })).toHaveCount(0);
  await page.goto('/catalog?internal=demo');
  await expect(page.getByRole('button', { name: 'Demo class', exact: true })).toBeVisible();
});
test('Chemistry preview uses published objectives and clearly identifies the prototype', async ({ page }) => {
  await page.goto('/catalog?parent=' + CHEMISTRY.topic);
  await expect(page.locator('.discovery-preview .discovery-badge')).toHaveText('Preview');
  await expect(page.getByText('Prototype lesson · Academic teacher review pending')).toBeVisible();
  await expect(page.getByText('7 interactive steps')).toBeVisible();
  await expect(page.locator('.discovery-outcomes li')).toHaveText(['Compare continuous carbon chains.', 'Name an alkane with one methyl branch.', 'Relate different carbon connections to chain isomerism.']);
  await expect(page.locator('.discovery-context')).toHaveText('Standard 10 / Chemistry / Unit 1');
  await expect(page.getByText('Ready', { exact: true })).toHaveCount(0);
});
test('invalid planned routes never display fabricated standards', async ({ page }) => {
  for (const suffix of ['standard=11', 'standard=0', 'standard=01', 'standard=abc', 'parent=' + CHEMISTRY.class + '&standard=1']) {
    await page.goto('/catalog?' + suffix);
    await expect(page.getByText('This selection is unavailable')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start teaching' })).toHaveCount(0);
  }
});
