import { expect, type Page } from '@playwright/test';
export async function launchPhysics(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Classroom', exact: true }).click();
  await page.getByRole('button', { name: 'Standard 10', exact: true }).click();
  await page.getByRole('button', { name: 'Physics', exact: true }).click();
  await page.getByRole('button', { name: 'Chapter 2 · Lenses', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Object position' })).toBeVisible();
  await expect(page).toHaveURL(/\/workspace\?session=/);
}
