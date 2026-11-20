import { launchPlant, plantMore, plantDrag, plantSaved, savedPlant } from '../helpers/plant';
import { expect, test as base } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { launchChemistry } from '../helpers/chemistry';
import { launchPhysics } from '../helpers/physics';
import { launchCounting, counterPositions, countingMore } from '../helpers/counting';
import { drawDot, inkSurface } from '../helpers/chemistry';
import { button, createShape, currentShapes, point, savedRecord, surface } from '../helpers/shape-editing';

const test = base.extend<{ monitor: void }>({
  monitor: [async ({ page, baseURL }, use) => {
    const problems: string[] = [];
    page.on('pageerror', error => problems.push(error.message));
    page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
    page.on('request', request => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && (url.origin !== baseURL || /^\/api(?:\/|$)/.test(url.pathname))) {
        problems.push(request.method() + ' ' + url.origin + url.pathname);
      }
    });
    page.on('response', response => { if (response.status() >= 400) problems.push(response.status() + ' ' + response.url()); });
    await use();
    expect(problems).toEqual([]);
  }, { auto: true }],
});

test('upload contains only frontend assets and navigations resolve to the SPA', async ({ request }) => {
  const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
  expect(config).toEqual({
    name: 'project', compatibility_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    workers_dev: true, preview_urls: false,
    assets: { directory: './dist-demo', not_found_handling: 'single-page-application' },
  });
  const dir = config.assets.directory;
  expect((await readdir(dir)).sort()).toEqual(['THIRD-PARTY-NOTICES.txt', 'assets', 'favicon.svg', 'fonts', 'index.html']);
  expect((await readdir(dir + '/fonts')).sort()).toEqual(['NotoSansMalayalam.ttf', 'OFL-NotoSansMalayalam.txt']);
  const index = await readFile(dir + '/index.html', 'utf8');
  for (const route of ['/', '/catalog', '/workspace?session=direct-link']) {
    const response = await request.get(route, { headers: { Accept: 'text/html' } });
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe(index);
  }
  const api = await request.get('/api/v1/health', { headers: { Accept: 'application/json' } });
  expect(api.status()).toBe(404);
  for (const file of await readdir(dir + '/assets')) {
    expect(file).toMatch(/^[\w.-]+\.(?:js|css)$/);
    const asset = await request.get('/assets/' + file);
    expect(asset.status()).toBe(200);
    expect(asset.headers()['content-type']).toMatch(file.endsWith('.js') ? /javascript/ : /css/);
    const contents = await asset.text();
    expect(contents.includes('DEP2B_PRIVATE_BUILD_CANARY')).toBe(false);
    expect(contents).not.toMatch(/4[0-4]000000-0000-4000-8000-|engineering fixture|Developer fixtures|internal=demo|A closer look at shapes|10_Chemistry Eng\.pdf|docs\/phase-5-source\.md/i);
    expect(/postgres(?:ql)?:\/\/|DATABASE_URL|CLOUDFLARE_API_TOKEN|\/api\/v1|-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|https?:\/\/(?:localhost|127\.0\.0\.1):3001/i.test(contents)).toBe(false);
  }
  const font = await request.get('/fonts/NotoSansMalayalam.ttf');
  expect((await font.body()).equals(await readFile('public/fonts/NotoSansMalayalam.ttf'))).toBe(true);
});

test('the served favicon renders the Home dot and both arches at tab sizes', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(href).toBe('/favicon.svg');
  const samples = await page.evaluate(async () => {
    const icon = new Image();
    icon.src = '/favicon.svg';
    await icon.decode();
    return [16, 32, 48].map(size => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(icon, 0, 0, size, size);
      return ([[18, 5], [5, 24], [31, 24]] as const).map(([x, y]) => {
        const [r, g, b, a] = ctx.getImageData(Math.floor(x * size / 36), Math.floor(y * size / 36), 1, 1).data;
        return a === 255 && g! > r! && g! > b! && r! < 140;
      });
    });
  });
  expect(samples).toEqual(Array.from({ length: 3 }, () => [true, true, true]));
});

test('public Whiteboard restores a selected shape duplicate through Undo and Redo', async ({ page }) => {
  await page.goto('/');
  await button(page, 'Whiteboard').click();
  await createShape(page, 'Rectangle');
  await button(page, 'Select').click();
  await button(page, 'Next shape').click();
  await button(page, 'Duplicate').click();
  const shapes = await currentShapes(page);
  expect(shapes).toHaveLength(2);
  await button(page, 'Undo').click();
  expect(await currentShapes(page)).toEqual(shapes.slice(0, 1));
  await button(page, 'Redo').click();
  expect(await currentShapes(page)).toEqual(shapes);
});

test('public notices include complete installed licenses for the audited bundle', async ({ request }) => {
  const response = await request.get('/THIRD-PARTY-NOTICES.txt');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/plain');
  const notices = (await response.text()).replaceAll('\r\n', '\n');
  const sections = notices.split(/^## /m).slice(1);
  const packages = ['its-fine', 'konva', 'react', 'react-dom', 'react-konva', 'react-reconciler',
    'react-router', 'rolldown', 'scheduler', 'tailwindcss', 'vite', 'zod'];
  expect(sections.filter(section => section.split('\n')[0]!.includes(' - '))).toHaveLength(packages.length);
  for (const name of packages) {
    const dir = 'node_modules/' + name;
    const { version } = JSON.parse(await readFile(dir + '/package.json', 'utf8'));
    const section = sections.find(text => text.startsWith(`${name} - ${version} (MIT)`));
    expect(section, name).toBeDefined();
    const file = name === 'react-router' || name === 'vite' ? 'LICENSE.md' : 'LICENSE';
    const license = (await readFile(dir + '/' + file, 'utf8')).replaceAll('\r\n', '\n');
    expect(section!.slice(section!.indexOf('\n')).trim()).toBe(license.split('# Licenses of bundled dependencies')[0]!.trim());
  }
  expect(notices).toContain('Copyright (c) 2010 Mario Klingemann');
  expect(notices).toContain('Copyright (c) 2020 Evan Wallace');
  for (const holder of ['Sindre Sorhus', 'Jonathan Neal', 'Nicolas Gallagher']) {
    expect(notices).toContain('Copyright (c) ' + holder);
  }
  expect(notices).toContain('fonts/OFL-NotoSansMalayalam.txt');
  const fontLicense = await request.get('/fonts/OFL-NotoSansMalayalam.txt');
  expect(await fontLicense.text()).toBe(await readFile('public/fonts/OFL-NotoSansMalayalam.txt', 'utf8'));
});

for (const [width, height] of [[1920, 1080], [1280, 720], [1024, 600]] as const) {
  test(`device-local board, PNG and recovery at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const head = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
    await expect(page.getByText(`Demo Version · ${head}${dirty ? '-dirty' : ''}`, { exact: true })).toBeInViewport();
    await expect(page.getByText('Boards are saved only in this browser. Clearing site data erases them.')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: info.outputPath('home.png') });
    await button(page, 'Whiteboard').click();
    await expect(surface(page)).toBeVisible();
    const session = new URL(page.url()).searchParams.get('session')!;
    await button(page, 'Text').click();
    const at = await point(page, 240, 180);
    await page.mouse.click(at.x, at.y);
    const content = 'Meerkats · മലയാളം\nDemo';
    await page.getByRole('textbox', { name: 'Board text' }).fill(content);
    await button(page, 'Apply text').click();
    await button(page, 'Duplicate').click();
    await expect(surface(page)).toHaveAttribute('data-text-count', '2');
    const board = (await savedRecord(page)).snapshot.whiteboard;
    if (board.schemaVersion !== 4) throw new Error('Expected v4 text document');
    expect(board.pages[0]!.texts.map(text => text.text)).toEqual([content, content]);
    await expect(page.getByRole('status')).toHaveText('Saved on this device');
    expect(await page.evaluate(() => [...document.fonts].some(font => font.family.includes('Meerkats Malayalam') && font.status === 'loaded'))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: info.outputPath('board.png') });
    const downloading = page.waitForEvent('download');
    await button(page, 'Export PNG').click();
    const png = info.outputPath('board-export.png');
    await (await downloading).saveAs(png);
    const bytes = await readFile(png);
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([2400, 1350]);
    await page.reload();
    await expect(surface(page)).toHaveAttribute('data-text-count', '2');
    await button(page, '← Back').click();
    await button(page, 'Whiteboard').click();
    await button(page, 'Recent boards').click();
    await page.getByRole('button', { name: new RegExp('Board ' + session.slice(0, 8)) }).click();
    await expect(surface(page)).toHaveAttribute('data-text-count', '2');
    expect((await savedRecord(page)).snapshot.whiteboard).toEqual(board);
  });
}

test('a workspace link cannot recover another browser profile’s board', async ({ browser, baseURL, page }) => {
  const owner = await browser.newPage({ baseURL });
  try {
    await owner.goto('/');
    await button(owner, 'Whiteboard').click();
    const at = await point(owner, 300, 250);
    await owner.mouse.click(at.x, at.y);
    await expect(surface(owner)).toHaveAttribute('data-ink-count', '1');
    await expect(owner.getByRole('status')).toHaveText('Saved on this device');
    await page.goto(owner.url());
    await expect(page.getByRole('heading', { name: 'Session recovery needs attention' })).toBeVisible();
    await expect(surface(page)).toHaveCount(0);
    await page.getByRole('link', { name: 'Start a separate workspace' }).click();
    await button(page, 'Whiteboard').click();
    await expect(surface(page)).toHaveAttribute('data-ink-count', '0');
  } finally {
    await owner.close();
  }
});

test('bundled Classroom lessons run without an API', async ({ page }) => {
  await launchChemistry(page);
  for (let carbon = 1; carbon < 5; carbon++) {
    await page.getByRole('button', { name: /Reveal next carbon/ }).click();
  }
  await expect(page.getByText('5 of 5 carbons revealed')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Saved on this device');
  await page.reload();
  await expect(page.getByText('5 of 5 carbons revealed')).toBeVisible();
  await launchPhysics(page);
  await button(page, 'Concave').click();
  await expect(page.getByTestId('lens-result')).toHaveText('Virtual · Upright · Diminished');
  await expect(page.locator('.interactive-save')).toHaveText('Saved on this device');
  await page.reload();
  await expect(button(page, 'Concave')).toHaveAttribute('aria-pressed', 'true');
});

for (const [width, height] of [[1920, 1080], [1280, 720], [1024, 600]] as const) {
  test(`public Standard 1 preview, interaction and recovery at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await launchCounting(page); // Includes the exact Original Demo Concept / Teacher Review Pending label.
    const before = await counterPositions(page);
    const counter = page.getByTestId('counter-1');
    const box = (await counter.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(56);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 60, { steps: 12 });
    await page.mouse.up();
    const moved = await counterPositions(page);
    expect(moved[0]).not.toEqual(before[0]);
    expect(moved.map(c => c.id)).toEqual(before.map(c => c.id));
    expect(moved.slice(1)).toEqual(before.slice(1));
    await button(page, 'Show count').click();
    await expect(page.getByTestId('counting-total')).toContainText('5');
    await page.screenshot({ path: info.outputPath('counting-english.png') });
    await countingMore(page);
    await button(page, 'Count together').click();
    await button(page, 'Change label language').click();
    await page.screenshot({ path: info.outputPath('counting-settings.png') });
    await button(page, 'Close counting settings').click();
    await button(page, 'Next counter').click();
    await expect(page.locator('.counting-counter.counted')).toHaveCount(1);
    await expect(page.locator('.counting-title')).toHaveText('എണ്ണം അതേ. ക്രമം വേറെ.');
    for (const name of ['Explore', 'Annotate', 'Whiteboard', 'Quantity', 'More counting controls']) {
      const target = (await button(page, name).boundingBox())!;
      expect(target.height).toBeGreaterThanOrEqual(56);
      await expect(button(page, name)).toBeInViewport({ ratio: 1 });
    }
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: info.outputPath('counting-malayalam.png') });
    await button(page, 'Annotate').click();
    await expect(page.locator('.content-layer')).toHaveAttribute('inert', '');
    await drawDot(page);
    expect(await counterPositions(page)).toEqual(moved);
    await button(page, 'Whiteboard').click();
    await drawDot(page, true);
    await expect(inkSurface(page, true)).toHaveAttribute('data-ink-count', '1');
    await button(page, 'Explore').click();
    await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1');
    await expect(page.locator('.interactive-save')).toHaveText('Saved on this device');
    await page.reload();
    expect(await counterPositions(page)).toEqual(moved);
    await expect(page.locator('.counting-counter.counted')).toHaveCount(1);
    await expect(page.locator('.counting-title')).toHaveText('എണ്ണം അതേ. ക്രമം വേറെ.');
    await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1');
    await button(page, 'Whiteboard').click();
    await expect(inkSurface(page, true)).toHaveAttribute('data-ink-count', '1');
  });
}

for (const [width, height] of [[1920, 1080], [1280, 720], [1024, 600]] as const) {
  test(`public Standard 2 assembly, demonstrations and recovery at ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await launchPlant(page);
    await expect(page.getByText('Original Demo Concept — Preview / Teacher Review Pending', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('plant-empty.png') });
    await plantDrag(page, [120, 205], [760, 510]);
    await expect(page.getByTestId('plant-part-1')).toHaveAttribute('data-slot', 'root');
    await plantMore(page); await button(page, 'Show whole plant').click();
    await expect(page.locator('[data-slot="tray"]')).toHaveCount(0);
    await page.getByTestId('plant-part-3').press('Enter');
    await expect(page.getByTestId('plant-explanation')).toHaveText('Use light, water and air to make food.');
    await page.screenshot({ path: info.outputPath('plant-completed.png') });
    await button(page, 'Water demonstration').click();
    await expect(page.locator('.plant-water-path')).toBeVisible();
    await page.screenshot({ path: info.outputPath('plant-water.png') });
    await button(page, 'Sunlight demonstration').click();
    await expect(page.locator('.plant-light-rays')).toBeVisible();
    await page.screenshot({ path: info.outputPath('plant-sunlight.png') });
    await plantMore(page); await button(page, 'Change plant language').click();
    await page.screenshot({ path: info.outputPath('plant-settings.png') });
    await button(page, 'Close plant settings').click();
    await expect(page.locator('.plant-title')).toHaveText('ഒരു ചെടി ഉണ്ടാക്കാം');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath('plant-malayalam.png') });
    for (const target of await page.locator('.plant-controls > button').all()) {
      expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(56);
      await expect(target).toBeInViewport({ ratio: 1 });
    }
    for (const target of await page.locator('.plant-part-hit').all()) {
      const box = (await target.boundingBox())!;
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(56);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await plantSaved(page); const before = await savedPlant(page);
    await button(page, 'Annotate').click();
    await expect(page.locator('.content-layer')).toHaveAttribute('inert', '');
    await drawDot(page);
    await button(page, 'Whiteboard').click(); await drawDot(page, true);
    await button(page, 'Explore').click(); await plantSaved(page);
    expect(await savedPlant(page)).toEqual(before);
    await button(page, 'Focus').click();
    await page.screenshot({ path: info.outputPath('plant-focus.png') });
    await button(page, 'Leave focus').click();
    await page.reload(); await plantSaved(page);
    expect(await savedPlant(page)).toEqual(before);
    await expect(inkSurface(page)).toHaveAttribute('data-ink-count', '1');
    await expect(page.locator('.plant-title')).toHaveText('ഒരു ചെടി ഉണ്ടാക്കാം');
    await expect(page.locator('[data-slot="tray"]')).toHaveCount(0);
    await button(page, 'Whiteboard').click();
    await expect(inkSurface(page, true)).toHaveAttribute('data-ink-count', '1');
  });
}
