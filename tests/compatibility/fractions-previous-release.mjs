// Real previous client, same browser profile/origin. No deployment or database access.
// Run after other browser suites: node tests/compatibility/fractions-previous-release.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve, join } from 'node:path';
import { createServer, request } from 'node:http';
import { chromium, expect } from '@playwright/test';

const baseline = '5b3808165989fe0c5df8cd1de7ed812af2a55a5d';
const root = process.cwd();
const output = resolve('test-results', 'fractions-compatibility-' + Date.now());
const oldRoot = join(output, 'previous-client'); mkdirSync(oldRoot, { recursive: true });
const archive = join(output, 'previous.tar');
execFileSync('git', ['archive', baseline, '-o', archive]); execFileSync('tar', ['-xf', archive, '-C', oldRoot]);
const processes = [];
let browser, proxy;
async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Server did not start: ' + url);
}
function vite(cwd, port) {
  const log = createWriteStream(join(output, port + '.log'));
  const child = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd, env: { ...process.env, VITE_API_ENABLED: 'false' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log); child.stderr.pipe(log); processes.push(child);
}
try {
  vite(root, 5186); vite(oldRoot, 5187); await Promise.all([waitFor('http://127.0.0.1:5186'), waitFor('http://127.0.0.1:5187')]);
  let target = 5186;
  proxy = createServer((req, res) => {
    const forward = request({ hostname: '127.0.0.1', port: target, path: req.url, method: req.method,
      headers: { ...req.headers, host: '127.0.0.1:' + target } }, reply => { res.writeHead(reply.statusCode, reply.headers); reply.pipe(res); });
    forward.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(forward);
  });
  await new Promise(resolve => proxy.listen(5188, '127.0.0.1', resolve));
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext(); await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage(); await page.goto('http://127.0.0.1:5188/catalog');
  const versions = async () => page.evaluate(async () => { const path='/contracts/catalog-content.ts'; return (await import(path)).bundledVersions; });
  const currentVersions = await versions();
  const original = await page.evaluate(async () => {
    const paths = ['/src/persistence/database.ts', '/src/persistence/serialization.ts', '/src/drawing/session.ts', '/contracts/fractions-content.ts', '/contracts/fractions.ts'];
    const [repository, serialization, sessions, content, model] = await Promise.all(paths.map(path => import(path)));
    const id = crypto.randomUUID(), p = content.FRACTIONS;
    const identity = { id, lessonVersionId: p.version, context: { classId:p.class, subjectId:p.subject, classLabel:'Standard 3', subjectLabel:'Mathematics' } };
    const session = sessions.createLessonSession({ sessionId:id,classId:p.class,subjectId:p.subject },content.fractionsVersion);
    const config = content.fractionsVersion.activities[0].config;
    session.lesson.progress.states[p.activity] = { ...model.placeFractionPiece(config, session.lesson.progress.states[p.activity], config.pieceIds[0], { lane:'bottom', start:2 }), language:'ml' };
    const record = repository.newRecord(serialization.serializeSession(session,identity,null));
    record.progressSync = { serverRevision:0,acknowledgedLocalRevision:-1,pending:{ mutationId:crypto.randomUUID(),baseServerRevision:0,progress:structuredClone(record.snapshot.lesson.progress) } };
    record.sync[record.snapshot.whiteboard.id] = { serverRevision:0, acknowledgedLocalRevision:-1, pending: { mutationId:crypto.randomUUID(), baseServerRevision:0, document:structuredClone(record.snapshot.whiteboard) } };
    // New local work must not rewrite the progress payload already queued for retry.
    record.snapshot.lesson.progress.localRevision = 1;
    record.snapshot.lesson.progress.states[p.activity] = model.placeFractionPiece(config, record.snapshot.lesson.progress.states[p.activity], config.pieceIds[2], {lane:'top', start:0});
    return new repository.SessionRepository().save(record);
  });
  const id = original.snapshot.identity.id, sessionURL = 'http://127.0.0.1:5188/workspace?session='+id;
  async function raw() { return page.evaluate(async id => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('meerkats-teaching-v1', 3); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return new Promise(resolve => { const tx = db.transaction('sessions'); const r = tx.objectStore('sessions').get(id); tx.oncomplete = () => { db.close(); resolve(r.result); }; });
  }, id); }
  writeFileSync(join(output, 'before.json'), JSON.stringify(original, null, 2));
  target = 5187; await page.goto(sessionURL);
  await expect(page.getByRole('heading', { name: 'Session recovery needs attention' })).toBeVisible();
  expect(await raw()).toEqual(original);
  const previousVersions = await versions();
  expect(currentVersions).toHaveLength(previousVersions.length + 1);
  expect(currentVersions.filter(v => v.id !== original.snapshot.lesson.version.id)).toEqual(previousVersions);
  await page.screenshot({ path: join(output, 'old-client-safe-rejection.png') });
  // Exercise the actual OLD save() guard with a valid old-format candidate at the same key.
  const result = await page.evaluate(async ({ id, generation }) => {
    const paths = ['/src/persistence/database.ts', '/src/persistence/serialization.ts', '/src/drawing/session.ts', '/contracts/physics.ts'];
    const [repository, serialization, sessions, physics] = await Promise.all(paths.map(path => import(path)));
    const context = { classId: '50000000-0000-4000-8000-000000000002', subjectId: physics.PHYSICS.subject, classLabel: 'Standard X', subjectLabel: 'Physics' };
    const identity = { id, context, lessonVersionId: physics.PHYSICS.version };
    const session = sessions.createLessonSession({ sessionId: id, classId: context.classId, subjectId: context.subjectId }, physics.physicsVersion);
    const candidate = repository.newRecord(serialization.serializeSession(session, identity, null)); candidate.generation = generation;
    const repo = new repository.SessionRepository(); let rejection = '';
    try { await repo.save(candidate); } catch (error) { rejection = error.constructor.name; }
    const recent = await repo.recentBoards(); return { rejection, unavailable: recent.unavailable };
  }, { id, generation: original.generation });
  expect(result.rejection).toBe('LocalConflict'); expect(result.unavailable).toBeGreaterThanOrEqual(1); expect(await raw()).toEqual(original);
  writeFileSync(join(output, 'after-old-client.json'), JSON.stringify(await raw(), null, 2));
  target = 5186; await page.goto('http://127.0.0.1:5188/');
  const recovered = await page.evaluate(async id => { const path='/src/persistence/database.ts'; const repo=await import(path);return new repo.SessionRepository().load(id); },id);
  expect(recovered).toEqual(original);
  expect(recovered.snapshot.lesson).toEqual(original.snapshot.lesson);
  expect(recovered.progressSync.pending).toEqual(original.progressSync.pending);
  expect(recovered.snapshot.whiteboard).toEqual(original.snapshot.whiteboard); expect(recovered.snapshot.annotations).toEqual(original.snapshot.annotations);
  await page.screenshot({ path: join(output, 'new-client-recovered.png') });
  await context.tracing.stop({ path: join(output, 'compatibility-trace.zip') });
  const report = { baseline, pass: true, assertions: ['old UI safe rejection', 'raw record unchanged', 'old save overwrite rejected', 'old recent list non-destructive', 'new recovery exact', 'pending progress and document mutations exact', 'existing lesson versions equal to baseline'], output };
  writeFileSync(join(output, 'result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally {
  await browser?.close(); if (proxy) await new Promise(resolve => proxy.close(resolve));
  for (const child of processes) child.kill();
}
