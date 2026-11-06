import { expect, type Page } from '@playwright/test';
import { test, reloadBoard, openRecentBoard } from '../helpers/board-browser';
import { button, createShape, point, savedRecord, select, surface } from '../helpers/shape-editing';

const entries = [
  { text: 'Matter & motion!', x: 60, y: 65, color: '#114433', fontSize: 32 },
  { text: 'ക്ഷേത്രം, ക്ക, ങ്ങ, ന്ത.', x: 230, y: 160, color: '#884411', fontSize: 24 },
  { text: 'Science — ശാസ്ത്രം\nH₂O + വെള്ളം!', x: 410, y: 260, color: '#225eaf', fontSize: 32 },
  { text: 'വെളിച്ചം', x: 610, y: 380, color: '#872050', fontSize: 40 },
  { text: 'അവസാനം / End', x: 1190, y: 665, color: '#314287', fontSize: 24 },
];

async function openBoard(page: Page) {
  await page.goto('/');
  await button(page, 'Whiteboard').click();
  await createShape(page);
  await select(page);
  const shapeId = await surface(page).getAttribute('data-selected-shape');
  const baseline = (await savedRecord(page)).snapshot.whiteboard;
  if (baseline.schemaVersion !== 3) throw new Error('Expected shape-only board');
  expect(baseline.pages[0]?.shapes.map(s => s.id)).toEqual([shapeId]);
  return baseline;
}

type Baseline = Awaited<ReturnType<typeof openBoard>>;

async function appendText(page: Page, index: number, baseline: Baseline, ids: string[]) {
  const entry = entries[index]!;
  await button(page, 'Text').click();
  const tap = await point(page, entry.x, entry.y);
  await page.mouse.click(tap.x, tap.y);
  await page.getByRole('textbox', { name: 'Board text' }).fill(entry.text);
  await page.getByLabel('Text colour').fill(entry.color);
  await page.getByLabel('Font size').selectOption(String(entry.fontSize));
  await button(page, 'Apply text').click();
  await expect(surface(page)).toHaveAttribute('data-text-count', String(index + 1));
  await expect(surface(page)).toHaveAttribute('data-revision', String(baseline.localRevision + index + 1));
  const id = await surface(page).getAttribute('data-selected-text');
  expect(id).toMatch(/^[a-f\d-]{36}$/i);
  expect(ids).not.toContain(id);
  ids.push(id!);
}

async function durableBoard(page: Page, baseline: Baseline, ids: string[]) {
  const { snapshot } = await savedRecord(page);
  const board = snapshot.whiteboard;
  if (board.schemaVersion !== 4) throw new Error('Expected text document');
  const active = board.pages[0]!;
  expect(board).toEqual({
    ...baseline, schemaVersion: 4, localRevision: baseline.localRevision + ids.length,
    pages: [{ ...baseline.pages[0], texts: active.texts }],
  });
  expect(active.texts.map(text => text.id)).toEqual(ids);
  for (const [index, text] of active.texts.entries()) {
    const intended = entries[index]!;
    expect(text).toMatchObject({ text: intended.text, color: intended.color, fontSize: intended.fontSize, font: 'noto-sans-malayalam' });
    // Mouse coordinates round to display pixels. Edge text is fitted inside the scene.
    expect(Math.abs(text.origin.x - Math.min(intended.x, 1200 - text.size.width))).toBeLessThan(2);
    expect(Math.abs(text.origin.y - Math.min(intended.y, 675 - text.size.height))).toBeLessThan(2);
  }
  return board;
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
  test(`all five intended texts survive reload and Recent boards at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const baseline = await openBoard(page);
    const ids: string[] = [];
    for (let i = 0; i < entries.length; i++) await appendText(page, i, baseline, ids);
    const expected = await durableBoard(page, baseline, ids);
    await reloadBoard(page);
    expect(await durableBoard(page, baseline, ids)).toEqual(expected);
    await button(page, '← Back').click();
    await button(page, 'Whiteboard').click();
    await button(page, 'Recent boards').click();
    await openRecentBoard(page, baseline.owner.sessionId);
    expect(await durableBoard(page, baseline, ids)).toEqual(expected);
    await page.screenshot({ path: info.outputPath('recovered.png') });
    const last = expected.pages[0]!.texts[4]!;
    await button(page, 'Select').click();
    const tap = await point(page, last.origin.x + 12, last.origin.y + 12);
    await page.mouse.click(tap.x, tap.y);
    await expect(surface(page)).toHaveAttribute('data-selected-text', last.id);
    await button(page, 'Edit text').click();
    const field = page.getByRole('textbox', { name: 'Board text' });
    await expect(field).toHaveValue(last.text);
    const replacement = 'End';
    await field.fill(replacement);
    await button(page, 'Apply text').click();
    const edited = (await savedRecord(page)).snapshot.whiteboard;
    if (edited.schemaVersion !== 4) throw new Error('Expected edited text document');
    expect(edited.localRevision).toBe(expected.localRevision + 1);
    expect(edited.pages[0]!.texts.map(t => t.id)).toEqual(ids);
    expect(edited.pages[0]!.texts.slice(0, 4)).toEqual(expected.pages[0]!.texts.slice(0, 4));
    expect(edited.pages[0]!.texts[4]).toMatchObject({ id: last.id, text: replacement, color: last.color, fontSize: last.fontSize });
    await info.attach('durable-board', { body: JSON.stringify(expected), contentType: 'application/json' });
  });
}

for (const decision of ['stay', 'leave'] as const) {
  test(`explicitly ${decision} during the fifth text write`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const baseline = await openBoard(page);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) await appendText(page, i, baseline, ids);
    const prior = await durableBoard(page, baseline, ids);
    await page.evaluate(() => { window.holdBoardWrite = true; });
    await appendText(page, 4, baseline, ids);
    const pending = prior.localRevision + 1;
    await page.waitForFunction(revision => window.heldBoardRevision === revision, pending);
    await expect(page.getByRole('status')).toHaveText('Saving on device');
    await reloadBoard(page, decision);
    if (decision === 'stay') {
      await expect(surface(page)).toHaveAttribute('data-selected-text', ids[4]!);
      await expect(surface(page)).toHaveAttribute('data-text-count', '5');
      await page.evaluate(() => { window.holdBoardWrite = false; });
      const saved = await durableBoard(page, baseline, ids);
      await reloadBoard(page);
      expect(await durableBoard(page, baseline, ids)).toEqual(saved);
    } else {
      expect(await durableBoard(page, baseline, ids.slice(0, 4))).toEqual(prior);
    }
    await info.attach('unload-outcome', { body: JSON.stringify({ decision, ids, previousRevision: prior.localRevision, pendingRevision: pending,
      recovered: (await savedRecord(page)).snapshot.whiteboard }), contentType: 'application/json' });
  });
}
