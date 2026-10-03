import { expect, type Page } from '@playwright/test';
export async function launchChemistry(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Start Teaching' }).click();
  await page.getByRole('button', { name: /Standard X/ }).click();
  await page.getByRole('button', { name: /Chemistry · English Medium/ }).click();
  await page.getByRole('button', { name: /Unit 1 · Nomenclature/ }).click();
  await expect(page.getByText('Academic teacher review pending', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Start Teaching' }).click();
  await expect(page.getByRole('button', { name: 'Activity outline' })).toContainText('1 of 7');
}
export async function step(page: Page, number: number, title: string) {
  await page.getByRole('button', { name: 'Activity outline' }).click();
  await page.getByRole('button', { name: `${number}. ${title}`, exact: true }).click();
}
export const inkSurface = (page: Page, board = false) => page.getByRole('region', { name: board ? 'Whiteboard drawing surface' : 'Content annotation surface' });
export async function drawDot(page: Page, board = false) {
  const box = await inkSurface(page, board).boundingBox(); if (!box) throw new Error('Missing teaching surface');
  await page.mouse.click(box.x + box.width * .5, box.y + box.height * .5);
}
