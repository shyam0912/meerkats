import type { Page } from '@playwright/test';
/** The neutral composition fixture belongs to a teaching context, not standalone Whiteboard. */
export async function launchNeutralWorkspace(page: Page) {
  await page.goto('/classes');
  await page.getByRole('button', { name: 'STD 1', exact: true }).click();
  await page.getByRole('button', { name: '🔬 Science', exact: true }).click();
}
