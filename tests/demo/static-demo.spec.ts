import { expect, test as base } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { launchChemistry } from '../helpers/chemistry';
import { launchPhysics } from '../helpers/physics';
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
