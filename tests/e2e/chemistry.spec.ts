import { test, expect } from '@playwright/test';
import { launchChemistry, step, inkSurface, drawDot } from '../helpers/chemistry';

test('source-grounded chemistry journey, every interaction, ink isolation and reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await launchChemistry(page);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Reveal next carbon/ }).click();
  await expect(page.getByText('5 of 5 carbons revealed')).toBeVisible();
  await expect(page.getByRole('button', { name: /Reveal next carbon/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: /Path A/ }).click(); await expect(page.getByText('Path A: 3 connected carbons')).toBeVisible();
  await page.getByRole('button', { name: /Path C/ }).click(); await expect(page.getByText('Path C: 4 connected carbons')).toBeVisible();
  await page.getByRole('button', { name: /Reveal longest/ }).click(); await expect(page.getByText(/Paths B and C are equally long/)).toBeVisible();
  await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await drawDot(page);
  await expect(page.locator('.content-layer')).toHaveAttribute('inert', '');
  const annotationId = await inkSurface(page).getAttribute('data-document-id');
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: /Path B/ }).click(); await expect(page.getByText('Path B: 4 connected carbons')).toBeVisible();
  await page.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await drawDot(page, true);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(inkSurface(page, true)).toHaveAttribute('data-ink-count', '0');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Content', exact: true }).click(); await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '0');
  await page.getByRole('button', { name: /Right → left/ }).click(); await expect(page.getByText('Branch position: 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Left → right/ }).click(); await expect(page.getByText('Branch position: 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Compare positions/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('button', { name: /Reveal branch/ }).click();
  await expect(page.getByText(/One carbon in the branch/)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  for (const part of ['Position', 'Branch', 'Parent root', 'Suffix']) await page.getByRole('button', { name: `Name part: ${part}`, exact: true }).click();
  await expect(page.getByText('2-methylbutane', { exact: true })).toBeVisible();
  await expect(page.locator('.chemical-bond.highlighted')).toHaveCount(4);
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('button', { name: /Branched chain/ }).click();
  await expect(page.locator('.chemistry-scene')).toHaveAttribute('data-structure', 'methylbutane');
  await page.getByRole('button', { name: /Compare formula/ }).click(); await expect(page.getByText(/Same formula: C₅H₁₂/)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('button', { name: /Reveal the relationship/ }).click();
  await expect(page.getByText(/Chain isomers · Same molecular formula/)).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Saved on this device'); const url = page.url();
  await page.reload(); expect(page.url()).toBe(url); await expect(page.getByText(/Chain isomers · Same molecular formula/)).toBeVisible();
  await step(page, 6, 'Rearrange the same atoms'); await expect(page.locator('.chemistry-scene')).toHaveAttribute('data-structure', 'methylbutane');
  await step(page, 5, 'Build the IUPAC name'); await expect(page.getByText('2-methylbutane', { exact: true })).toBeVisible();
  await step(page, 2, 'Find the longest chain'); await expect(page.getByText('Path B: 4 connected carbons')).toBeVisible();
  await expect(inkSurface(page)).toHaveAttribute('data-document-id', annotationId!); await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1');
  await page.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await expect(inkSurface(page, true)).toHaveAttribute('data-ink-count', '1');
  expect(errors).toEqual([]);
});

test('chemistry controls support keyboard, reset and failed-module fallback', async ({ page }) => {
  await launchChemistry(page); const reveal = page.getByRole('button', { name: /Reveal next carbon/ });
  await reveal.focus(); await page.keyboard.press('Enter'); await expect(page.getByText('2 of 5 carbons revealed')).toBeVisible();
  await page.getByRole('button', { name: 'Reset activity' }).click(); await expect(page.getByText('1 of 5 carbons revealed')).toBeVisible();
  await page.route('**/src/activities/kinds/MoleculeBuilder.tsx*', route => route.abort('failed'));
  await page.reload(); await expect(page.getByRole('alert')).toContainText('Activity unavailable');
  await page.getByRole('button', { name: 'Whiteboard', exact: true }).click(); await drawDot(page, true);
  await expect(inkSurface(page, true)).toHaveAttribute('data-ink-count', '1');
});

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`chemistry control targets and annotation alignment at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await launchChemistry(page);
    for (const [i, title] of ['Discover the carbon chain', 'Find the longest chain', 'Number from the correct end', 'Identify the branch', 'Build the IUPAC name', 'Rearrange the same atoms', 'Discover chain isomerism'].entries()) {
      await step(page, i + 1, title);
      for (const button of await page.locator('.chemistry-controls button').all()) {
        const box = await button.boundingBox(); expect(box).not.toBeNull(); expect(box!.height).toBeGreaterThanOrEqual(56);
        expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      }
    }
    await page.getByRole('button', { name: /Reveal the relationship/ }).click();
    await page.screenshot({ path: `test-results/chemistry-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Annotate', exact: true }).click(); await drawDot(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    const layer = await page.locator('.content-layer').boundingBox(); const ink = await inkSurface(page).boundingBox();
    expect(Math.abs(layer!.width - ink!.width)).toBeLessThan(1); expect(Math.abs(layer!.x - ink!.x)).toBeLessThan(1);
    await expect.poll(() => inkSurface(page).locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.getContext('2d')!.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3])).toBeGreaterThan(0);
  });
}
