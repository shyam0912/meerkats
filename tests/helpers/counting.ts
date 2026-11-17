import { expect, type Page } from '@playwright/test';
export async function launchCounting(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Classroom', exact: true }).click();
  for (const name of ['Standard 1', 'Mathematics', 'Original Demo Concepts', 'Same Number, Different Arrangements'])
    await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByText('Original Demo Concept — Preview / Teacher Review Pending', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start teaching', exact: true }).click();
  await expect(page.getByTestId('counter-1')).toBeVisible();
}
export async function countingMore(page: Page) { await page.getByRole('button', { name: 'More counting controls' }).click(); }
export async function counterPositions(page: Page) {
  await expect(page.getByTestId('counter-1')).toBeVisible();
  return page.locator('[data-counter-id]').evaluateAll(elements => elements.map(el => ({ id: el.getAttribute('data-counter-id'), x: el.getAttribute('data-x'), y: el.getAttribute('data-y') })));
}
