import { expect, type Page } from '@playwright/test';
import { FRACTIONS } from '../../contracts/fractions-content';
import type { FractionState } from '../../contracts/fractions';
import { plantRecord } from './plant';
export async function launchFractions(page: Page) {
  await page.goto('/catalog');
  for (const name of ['Standard 3', 'Mathematics', 'Original Demo Concepts', 'Interactive Fractions', 'Start teaching'])
    await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('fraction-piece-1')).toBeVisible();
}
export async function fractionPoint(page: Page, x: number, y: number) {
  const r = (await page.locator('.fraction-canvas').boundingBox())!;
  return { x: r.x + x * r.width / 1200, y: r.y + y * r.height / 675 };
}
export async function fractionDrag(page: Page, piece: number, x: number, y: number) {
  const r = (await page.getByTestId(`fraction-piece-${piece}`).boundingBox())!;
  const b = await fractionPoint(page, x + (piece <= 2 ? 200 : 100), y + 50);
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up();
}
export async function fractionSaved(page: Page) { await expect(page.locator('.interactive-save')).toHaveText('Saved on this device'); }
export async function savedFractions(page: Page): Promise<{ state: FractionState; revision: number }> {
  const progress = (await plantRecord(page)).snapshot.lesson!.progress;
  const state = progress.states[FRACTIONS.activity]!;
  if (state.kind !== 'fraction-board') throw new Error('Missing fraction state');
  return { state, revision: progress.localRevision };
}
export { plantRecord as fractionRecord } from './plant';
