// Compiled old/new/old release acceptance, with one disposable profile per viewport.
// Every HTTP request is fulfilled from local artifacts; the live Worker is never accessed.
// OLD_DEMO_DIR and OLD_DEMO_MANIFEST must identify the archived 75e62033dbbd release.
import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';

const oldRoot = resolve(process.env.OLD_DEMO_DIR || 'test-results/previous-demo');
const manifest = process.env.OLD_DEMO_MANIFEST;
if (!manifest) throw new Error('OLD_DEMO_MANIFEST is required; do not substitute an unverified old build.');
const newRoot = resolve('dist-demo');
const output = resolve(process.env.COMPAT_OUTPUT || 'test-results/plant-public-upgrade');
await mkdir(output, { recursive: true });
async function files(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await files(join(dir, entry.name), path + '/'));
    else result.push(path);
  }
  return result.sort();
}
const entries = (await readFile(manifest, 'utf8')).trim().split(/\r?\n/).map(line => {
  const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
  if (!match) throw new Error('Invalid SHA-256 manifest');
  return { sha256: match[1], path: match[2] };
});
expect(await files(oldRoot)).toEqual(entries.map(e => e.path).sort());
for (const entry of entries) {
  expect(createHash('sha256').update(await readFile(join(oldRoot, entry.path))).digest('hex'), entry.path).toBe(entry.sha256);
}
const origin = 'https://project.meerkats-demo.workers.dev';
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const results = [];
const button = (page, name) => page.getByRole('button', { name, exact: true });
const board = page => page.getByRole('region', { name: 'Whiteboard drawing surface' });
async function tap(page, x, y) {
  const b = await board(page).boundingBox(); await page.mouse.click(b.x + x * b.width / 1200, b.y + y * b.height / 675);
}
async function drag(page, x, y, u, v) {
  const b = await board(page).boundingBox();
  await page.mouse.move(b.x + x * b.width / 1200, b.y + y * b.height / 675); await page.mouse.down();
  await page.mouse.move(b.x + u * b.width / 1200, b.y + v * b.height / 675, { steps: 10 }); await page.mouse.up();
}
async function raw(page, id) {
  return page.evaluate(async id => {
    const db = await new Promise((ok, no) => { const r = indexedDB.open('meerkats-teaching-v1', 3); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
    try { return await new Promise((ok, no) => { const tx = db.transaction('sessions'); const r = tx.objectStore('sessions').get(id); tx.oncomplete = () => ok(r.result); tx.onabort = () => no(tx.error); }); }
    finally { db.close(); }
  }, id);
}
async function saved(page) {
  await expect(page.locator('.interactive-save, [role="status"]').filter({ hasText: /^Saved on this device$/ }).first()).toBeVisible();
  return raw(page, new URL(page.url()).searchParams.get('session'));
}
async function png(page, path) {
  await page.evaluate(() => document.fonts.ready);
  const download = page.waitForEvent('download'); await button(page, 'Export PNG').click(); await (await download).saveAs(path);
  await button(page, 'Dismiss export message').click(); return readFile(path);
}
async function classroom(page, subject) {
  await page.goto(origin + '/catalog'); await button(page, 'Standard 10').click(); await button(page, subject).click();
  if (subject === 'Physics') { await button(page, 'Chapter 2 · Lenses').click(); await expect(page.getByRole('slider', { name: 'Object position' })).toBeVisible(); }
  else {
    await page.getByRole('button', { name: /Unit 1 · Nomenclature/ }).click(); await button(page, 'One branch. Two structures.').click();
    await button(page, 'Start teaching').click(); await expect(page.getByRole('button', { name: 'Activity outline' })).toContainText('1 of 7');
  }
}
try {
  for (const [width, height] of [[1920, 1080], [1280, 720], [1024, 600]]) {
    const dir = join(output, String(width)); await mkdir(dir, { recursive: true });
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    await context.tracing.start({ screenshots: true, snapshots: true });
    let target = oldRoot; const errors = [], requests = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (!/^https?:$/.test(url.protocol)) return route.continue();
      if (url.origin !== origin || /^\/api(?:\/|$)/.test(url.pathname)) {
        requests.push(url.origin + url.pathname); return route.abort();
      }
      let relative = decodeURIComponent(url.pathname).replace(/^\//, '');
      if (!relative || !extname(relative)) relative = 'index.html';
      const file = resolve(target, relative);
      if (!file.startsWith(target + sep)) throw new Error('Invalid artifact path');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.txt': 'text/plain' };
      await route.fulfill({ status: 200, contentType: types[extname(file)] || 'application/octet-stream', body: await readFile(file), headers: { 'Cache-Control': 'no-store' } });
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      await page.goto(origin); await expect(page.getByText('Demo Version · 75e62033dbbd', { exact: true })).toBeVisible();
      await button(page, 'Whiteboard').click(); await expect(board(page)).toBeVisible();
      await drag(page, 80, 100, 600, 100); await button(page, 'Eraser').click(); await drag(page, 300, 70, 300, 120);
      for (const [i, name] of ['Line', 'Arrow', 'Rectangle', 'Circle', 'Triangle'].entries()) {
        await button(page, 'Shapes').click(); await button(page, name).click(); await button(page, 'Close shapes').click();
        await drag(page, 70 + i * 220, 180, 190 + i * 220, 290);
      }
      for (const [i, text] of ['English', 'മലയാളം', 'English + മലയാളം\nSame quantity!'].entries()) {
        await button(page, 'Text').click(); await tap(page, 80 + i * 350, 410);
        await page.getByRole('textbox', { name: 'Board text' }).fill(text); await button(page, 'Apply text').click(); await board(page).press('Escape');
      }
      await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Square grid').click(); await button(page, 'Add page').click();
      await button(page, 'Lined').click(); await button(page, 'Close pages').click(); await button(page, 'Pen').click(); await drag(page, 100, 200, 700, 220);
      await page.getByRole('button', { name: /^Pages ·/ }).click(); await button(page, 'Open page 1').click();
      const boardURL = page.url(), oldBoard = await saved(page); expect(oldBoard.snapshot.whiteboard.schemaVersion).toBe(4);
      const oldPNG = await png(page, join(dir, 'old-board.png'));
      await classroom(page, 'Chemistry'); await page.getByRole('button', { name: /Reveal next carbon/ }).click();
      const chemistryURL = page.url(), oldChemistry = await saved(page);
      await classroom(page, 'Physics'); await button(page, 'Concave').click();
      const physicsURL = page.url(), oldPhysics = await saved(page);
      await page.goto(origin + '/catalog');
      for (const name of ['Standard 1', 'Mathematics', 'Original Demo Concepts', 'Same Number, Different Arrangements', 'Start teaching']) await button(page, name).click();
      const oldCounter = page.getByTestId('counter-1');
      await oldCounter.press('Enter'); await oldCounter.press('ArrowUp'); await oldCounter.press('Enter');
      await button(page, 'More counting controls').click(); await button(page, 'Change label language').click(); await button(page, 'Close counting settings').click();
      const baselineCountingURL = page.url(), baselineCounting = await saved(page);
      await writeFile(join(dir, 'before-upgrade.json'), JSON.stringify({ oldBoard, oldChemistry, oldPhysics, baselineCounting }, null, 2));

      target = newRoot; await page.goto(boardURL); await expect(board(page)).toBeVisible();
      expect((await saved(page)).snapshot.whiteboard).toEqual(oldBoard.snapshot.whiteboard);
      expect((await png(page, join(dir, 'new-board.png'))).equals(oldPNG)).toBe(true);
      await button(page, 'Select').click(); await button(page, 'Next text').click(); await button(page, 'Duplicate').click();
      const editedBoard = await saved(page); expect(editedBoard.snapshot.whiteboard.pages[0].texts).toHaveLength(4);
      await page.reload(); expect((await saved(page)).snapshot.whiteboard).toEqual(editedBoard.snapshot.whiteboard);
      await button(page, '← Back').click(); await button(page, 'Whiteboard').click(); await button(page, 'Recent boards').click();
      await page.getByRole('button', { name: new RegExp('Board ' + oldBoard.snapshot.identity.id.slice(0, 8)) }).click();
      expect((await saved(page)).snapshot.whiteboard).toEqual(editedBoard.snapshot.whiteboard);
      await page.screenshot({ path: join(dir, 'upgraded-board.png') });
      for (const [url, old, selector] of [[chemistryURL, oldChemistry, '.lesson-viewer'], [physicsURL, oldPhysics, '[data-testid="lens-result"]']]) {
        await page.goto(url); await saved(page); expect((await saved(page)).snapshot.lesson).toEqual(old.snapshot.lesson);
        if (selector.includes('lens-result')) await expect(page.locator(selector)).toHaveText('Virtual · Upright · Diminished');
      }
      await page.goto(baselineCountingURL);
      expect((await saved(page)).snapshot.lesson).toEqual(baselineCounting.snapshot.lesson);
      await expect(page.locator('.counting-title')).toHaveText('എണ്ണം അതേ. ക്രമം വേറെ.');
      await page.goto(origin + '/catalog');
      for (const name of ['Standard 2', 'Environmental Studies', 'Original Demo Concepts', 'Build a Plant']) await button(page, name).click();
      await expect(page.getByText('Original Demo Concept — Preview / Teacher Review Pending', { exact: true })).toBeVisible();
      await button(page, 'Start teaching').click(); await expect(page.getByTestId('plant-part-1')).toBeVisible();
      await button(page, 'More plant controls').click(); await button(page, 'Show whole plant').click();
      await button(page, 'Water demonstration').click();
      await button(page, 'More plant controls').click(); await button(page, 'Change plant language').click(); await button(page, 'Close plant settings').click();
      await saved(page); const plantURL = page.url(), plantId = new URL(plantURL).searchParams.get('session');
      await page.goto(origin); // Unmount before adding a disposable pending retry for rollback preservation.
      const pending = await page.evaluate(async id => {
        const db = await new Promise(ok => { const r = indexedDB.open('meerkats-teaching-v1', 3); r.onsuccess = () => ok(r.result); });
        return new Promise((ok, no) => { const tx = db.transaction('sessions', 'readwrite'), store = tx.objectStore('sessions'); let record;
          const r = store.get(id); r.onsuccess = () => { record = r.result; record.progressSync = { serverRevision: 0, acknowledgedLocalRevision: -1,
            pending: { mutationId: crypto.randomUUID(), baseServerRevision: 0, progress: structuredClone(record.snapshot.lesson.progress) } }; store.put(record, id); };
          tx.oncomplete = () => { db.close(); ok(record); }; tx.onabort = () => no(tx.error); });
      }, plantId);
      await writeFile(join(dir, 'plant-before-rollback.json'), JSON.stringify(pending, null, 2));

      target = oldRoot; await page.goto(plantURL);
      await expect(page.getByRole('heading', { name: 'Session recovery needs attention' })).toBeVisible();
      expect(await raw(page, plantId)).toEqual(pending);
      await page.screenshot({ path: join(dir, 'rollback-safe-rejection.png') });
      await page.goto(boardURL); expect((await saved(page)).snapshot.whiteboard).toEqual(editedBoard.snapshot.whiteboard);
      await button(page, '← Back').click(); await button(page, 'Whiteboard').click(); await button(page, 'Recent boards').click();
      expect(await raw(page, plantId)).toEqual(pending);
      for (const [url, old] of [[chemistryURL, oldChemistry], [physicsURL, oldPhysics], [baselineCountingURL, baselineCounting]]) {
        await page.goto(url); expect((await saved(page)).snapshot.lesson).toEqual(old.snapshot.lesson);
      }
      target = newRoot; await page.goto(plantURL); await expect(page.locator('[data-slot="tray"]')).toHaveCount(0);
      await expect(page.locator('.plant-title')).toHaveText('ഒരു ചെടി ഉണ്ടാക്കാം');
      const recovered = await saved(page); expect(recovered.snapshot.lesson).toEqual(pending.snapshot.lesson);
      expect(recovered.progressSync.pending).toEqual(pending.progressSync.pending);
      expect(recovered.snapshot.whiteboard).toEqual(pending.snapshot.whiteboard); expect(recovered.snapshot.annotations).toEqual(pending.snapshot.annotations);
      await page.screenshot({ path: join(dir, 'plant-after-rollback.png') });
      await writeFile(join(dir, 'plant-after-rollback.json'), JSON.stringify(recovered, null, 2));
      expect(errors).toEqual([]); expect(requests).toEqual([]);
      results.push({ width, height, pass: true, verifiedOldFiles: entries.length, boardId: oldBoard.snapshot.identity.id,
        plantId, boardAndClassroomUpgrade: true, oldPNGEqualsNewPNG: true, rollbackRawRecordPreserved: true, pendingMutationPreserved: true, errors, unexpectedRequests: requests });
    } catch (error) {
      await page.screenshot({ path: join(dir, 'failure.png') }); results.push({ width, height, pass: false, error: String(error), errors, requests }); throw error;
    } finally {
      await context.tracing.stop({ path: join(dir, 'trace.zip') }); await context.close();
      await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2));
    }
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
